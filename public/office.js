'use strict';
/**
 * Kantor pixel hidup: 10 agen duduk di meja, berjalan antar 14 ruangan (A*), duduk di pantry/sofa,
 * mengobrol saat ada pesan dari server (Office.say), dan berkeliaran sendiri saat menganggur.
 * Gerak murni visual (tanpa token); isi ucapan datang dari server.
 */
const Office = (() => {
  const { W, H } = Pathing;
  const IDS = Pathing.SEAT_ORDER;
  const CHAIN = ['penerima', 'pembaca', 'arsip', 'keuangan', 'pengingat']; // arah kertas berpindah saat dokumen diproses
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = 36, MAX_QUEUE = 12, MAX_QUEUE_RAPAT = 40, WANDER_AFTER_MS = 8000, WANDER_CHANCE = 0.2, MAX_AWAY = 3;
  const seatOf = (id) => { const [dx, dy, w] = Pathing.SEATS[id]; return { dx, dy, w, x: Math.round(dx + (w - 10) / 2), y: dy - 11 }; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const speechMs = (t) => Math.min(7500, 1500 + t.length * 42);

  let cv, ctx, icv, ictx, night = false, frame = 0, ticks = 0, last = performance.now(), box;
  let view = 'iso', rot = 0, focusId = null, cam = { tx: 0, ty: 0, s: 1 }, camGoal = cam, onFocus = null;
  const labels = [], bar = {};
  let agents = {};                       // status dari server: id -> { status, tugas, kode, nama }
  const stateOf = (id) => (agents[id] && agents[id].status) || 'idle';
  const actors = {}, tagEl = {}, papers = [], occupied = new Set();
  let rapat = null; // { siap: Promise, selesai: bool, peserta: [id] } selama rapat berlangsung
  for (const id of IDS) {
    const s = seatOf(id);
    actors[id] = { id, seat: s, look: Avatars.LOOKS[id], mode: 'seat', x: s.x + 5, y: s.dy + 4, path: [], arrive: null, sit: null, at: null, homing: false, activity: null, bubble: null, idleSince: Date.now() };
  }

  /* ---------- gerak ---------- */
  function startPos(a) {
    if (a.mode === 'seat') return { x: a.seat.x + 5, y: a.seat.dy + 4 };
    if (a.mode === 'sit') return { x: Pathing.SIT[a.sit][0] + 5, y: Pathing.SIT[a.sit][1] + 14 };
    return { x: a.x, y: a.y };
  }
  /** Jalan mengikuti titik-titik. Resolve true jika tiba, false jika dibatalkan oleh perintah gerak baru. */
  function moveTo(a, pts) {
    return new Promise((resolve) => {
      if (a.arrive) a.arrive(false);
      if (!pts.length || REDUCED) { if (pts.length) { a.x = pts[pts.length - 1].x; a.y = pts[pts.length - 1].y; } a.path = []; a.arrive = null; return resolve(true); }
      a.path = pts.slice(); a.arrive = resolve;
    });
  }
  function walkTo(a, goal) {
    const from = startPos(a), lead = [];
    if (a.mode === 'seat') lead.push(Pathing.stand(a.id));
    if (a.mode === 'sit') lead.push(Pathing.sitApproach(a.sit));
    const base = lead.length ? lead[lead.length - 1] : from;
    const pts = [...lead, ...(Pathing.find(base, goal) || [])];
    a.x = from.x; a.y = from.y; a.mode = 'walk'; a.sit = null;
    return moveTo(a, pts);
  }
  async function sitAt(a, name) {
    if (!(await walkTo(a, Pathing.sitApproach(name)))) return false;
    if (!(await moveTo(a, [{ x: Pathing.SIT[name][0] + 5, y: Pathing.SIT[name][1] + 14 }]))) return false;
    a.mode = 'sit'; a.sit = name; return true;
  }
  async function goHome(a) {
    if (a.homing || a.mode === 'seat') return;
    a.homing = true;
    try {
      if (!(await walkTo(a, Pathing.stand(a.id)))) return;
      if (!(await moveTo(a, [{ x: a.seat.x + 5, y: a.seat.dy + 4 }]))) return;
      a.mode = 'seat'; a.at = null; a.activity = null; a.idleSince = Date.now();
    } finally { a.homing = false; }
  }
  function step(a, dt) {
    if (!a.path.length) return;
    let dist = SPEED * dt;
    while (dist > 0 && a.path.length) {
      const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
      if (d <= dist) { a.x = p.x; a.y = p.y; a.path.shift(); dist -= d; } else { a.x += dx / d * dist; a.y += dy / d * dist; dist = 0; }
    }
    if (!a.path.length && a.arrive) { const r = a.arrive; a.arrive = null; r(true); }
  }
  function fastForward() { // tab tersembunyi: selesaikan semua gerakan agar sutradara tidak menunggu tanpa akhir
    for (const a of Object.values(actors)) if (a.path.length) { const p = a.path[a.path.length - 1]; a.x = p.x; a.y = p.y; a.path = []; if (a.arrive) { const r = a.arrive; a.arrive = null; r(true); } }
  }

  /* ---------- ucapan ---------- */
  function speak(a, text, ms = speechMs(text)) {
    if (a.bubble) a.bubble.el.remove();
    const el = h('div', { class: 'bubble', role: 'status' }, text);
    box.append(el);
    a.bubble = { el, until: performance.now() + ms + 400 };
  }

  /* ---------- sutradara obrolan ---------- */
  const queue = []; let directing = false;
  const isWorking = (id) => stateOf(id) === 'working';
  async function perform(m, next) {
    const A = actors[m.dari], B = m.ke ? actors[m.ke] : null;
    if (!A) return;
    if (m.tipe === 'rapat' && rapat) await rapat.siap; // bicara setelah semua duduk di ruang rapat
    if (B && !REDUCED && !rapat && !isWorking(m.dari) && !isWorking(m.ke) && B.mode === 'seat' && A.at !== m.ke && !A.homing) {
      A.activity = null;
      if (await walkTo(A, Pathing.front(m.ke))) A.at = m.ke;
    }
    speak(A, m.teks);
    await sleep(speechMs(m.teks));
    for (const a of Object.values(actors)) { // pulang kecuali percakapan berlanjut dengan dia
      if (a.at && !(next && (a.id === next.dari || a.id === next.ke))) { a.at = null; goHome(a); }
    }
  }
  async function direct() {
    directing = true;
    try { while (queue.length) { const m = queue.shift(); await perform(m, queue[0]); } } finally { directing = false; cekBubar(); }
  }
  function say(m) {
    if (!actors[m.dari]) return;
    if (rapat && (m.tipe === 'pikiran' || m.tipe === 'obrolan')) return; // selama rapat, tidak ada obrolan sampingan
    queue.push(m); const batas = rapat ? MAX_QUEUE_RAPAT : MAX_QUEUE; if (queue.length > batas) queue.splice(0, queue.length - batas);
    if (!directing) direct();
  }

  /* ---------- rapat: semua agen, termasuk Manajer, berkumpul di sekeliling meja panjang Ruang Rapat ---------- */
  async function rapatMulai(peserta) {
    const ids = IDS.filter((id) => !peserta || peserta.includes(id)); // Manajer ikut berjalan ke Ruang Rapat
    rapat = { selesai: false, peserta: ids };
    if (view === 'iso') focusRoom('rapat'); // kamera mengikuti ke Ruang Rapat
    queue.length = 0; // antrean lama (obrolan atau ucapan rapat sebelumnya) dibuang; ucapan rapat baru menyusul setelah peristiwa "mulai"
    ids.forEach((id, i) => { const a = actors[id]; a.meeting = true; a.kursi = 'kursi' + (i + 1); a.at = null; a.activity = null; });
    const tiba = ids.map((id, i) => sleep(i * 250).then(() => (rapat && rapat.peserta.includes(id) ? walkTo(actors[id], Pathing.spot(actors[id].kursi)) : false)));
    rapat.siap = Promise.race([Promise.all(tiba), sleep(25000)]); // jangan menunggu selamanya bila ada yang tersangkut
  }
  // Pengatur waktu mengikat pada rapat tertentu (r): rapat lama tidak boleh membubarkan rapat baru.
  function rapatSelesai() { if (!rapat) return; const r = rapat; r.selesai = true; cekBubar(); setTimeout(() => { if (rapat === r && r.selesai) bubar(); }, 120000); }
  function cekBubar() { const r = rapat; if (r && r.selesai && !directing && !queue.length) setTimeout(() => { if (rapat === r && r.selesai && !directing && !queue.length) bubar(); }, 1500); }
  function bubar() {
    const ids = rapat ? rapat.peserta : []; rapat = null;
    if (focusId === 'rapat') focusRoom(null);
    ids.forEach((id, i) => setTimeout(() => { const a = actors[id]; a.meeting = false; if (stateOf(id) !== 'working') goHome(a); else { a.at = null; a.activity = null; goHome(a); } }, i * 350));
  }

  /* ---------- berkeliaran saat menganggur ---------- */
  const ACTIVITIES = [
    { spot: 'coffee', emoji: '☕' }, { spot: 'whiteboard', emoji: '💡' }, { spot: 'printer', emoji: '🖨️' }, { spot: 'lobi', emoji: '🚶' },
    { spot: 'jendela1', emoji: '🌤️' }, { spot: 'jendela2', emoji: '🌤️' }, { spot: 'jendela3', emoji: '🌤️' }, { spot: 'jendela4', emoji: '🌤️' },
    { spot: 'ruangrapat', emoji: '📋' }, { spot: 'sofamanajer', emoji: '🛋️' },
    { sit: 'makan1', emoji: '🍱' }, { sit: 'makan2', emoji: '🍱' }, { sit: 'santai1', emoji: '📺' }, { sit: 'santai2', emoji: '📺' },
    // ruangan sayap kanan dan baris bawah; who = hanya agen yang cocok dengan tempat itu
    { spot: 'server', emoji: '🖥️', who: ['penjaga'] }, { spot: 'jendela5', emoji: '🌤️' },
    { spot: 'perpus', emoji: '📚', who: ['pembaca', 'pelapor', 'pelaksana', 'manajer'] }, { spot: 'gudang', emoji: '📦', who: ['arsip', 'pembaca', 'keuangan', 'pelaksana'] },
    { spot: 'kolam', emoji: '🐟' }, { spot: 'taman', emoji: '🌳' },
    { sit: 'baca1', emoji: '📖' }, { sit: 'baca2', emoji: '📖' }, { sit: 'taman1', emoji: '☀️' }, { sit: 'taman2', emoji: '☀️' }];
  const PAIRS = [['makan1', 'makan2'], ['santai1', 'santai2'], ['baca1', 'baca2'], ['taman1', 'taman2']];
  const keyOf = (act) => act.spot || act.sit;
  async function doActivity(a, act) {
    const key = keyOf(act); occupied.add(key); a.activity = key;
    try {
      if (!(act.sit ? await sitAt(a, act.sit) : await walkTo(a, Pathing.spot(act.spot)))) return;
      speak(a, act.emoji, 2200);
      await sleep(3000 + Math.random() * 4500);
      if (a.activity !== key) return;
      if (act.sit) { speak(a, act.emoji, 1800); await sleep(2500); }
      if (a.activity === key) await goHome(a);
    } finally { occupied.delete(key); }
  }
  function invitePartner(a, act) { // makan/santai berdua: ajak rekan yang sedang menganggur
    const pair = act.sit && PAIRS.find((p) => p.includes(act.sit));
    if (!pair) return;
    const other = pair.find((p) => p !== act.sit && !occupied.has(p));
    const friend = IDS.find((id) => id !== a.id && stateOf(id) === 'idle' && actors[id].mode === 'seat' && !actors[id].homing);
    if (other && friend) setTimeout(() => { if (stateOf(friend) === 'idle' && actors[friend].mode === 'seat') doActivity(actors[friend], ACTIVITIES.find((x) => x.sit === other)); }, 700);
  }
  function wanderTick() {
    if (REDUCED || document.hidden || directing || queue.length || rapat) return;
    if (IDS.filter((id) => actors[id].mode !== 'seat').length >= MAX_AWAY) return;
    for (const id of IDS) {
      const a = actors[id];
      if (stateOf(id) !== 'idle' || a.mode !== 'seat' || a.homing || Date.now() - a.idleSince < WANDER_AFTER_MS || Math.random() > WANDER_CHANCE) continue;
      const free = ACTIVITIES.filter((x) => !occupied.has(keyOf(x)) && (!x.who || x.who.includes(id)));
      if (!free.length) return;
      const favs = free.filter((x) => x.who), pool = favs.length && Math.random() < 0.45 ? favs : free; // agen suka mampir ke tempat yang cocok dengannya
      const act = pool[Math.floor(Math.random() * pool.length)];
      doActivity(a, act); invitePartner(a, act); return;
    }
  }

  /* ---------- kertas terbang saat dokumen diproses ---------- */
  function spawnPapers(prev) {
    for (let i = 1; i < CHAIN.length; i++) {
      const id = CHAIN[i], before = CHAIN[i - 1];
      if (stateOf(id) === 'working' && !(prev[id] && prev[id].status === 'working') && stateOf(before) === 'done') papers.push({ from: actors[before].seat, to: actors[id].seat, t0: performance.now() });
    }
  }
  function drawPapers() {
    const now = performance.now(), R = Scene.R;
    for (let i = papers.length - 1; i >= 0; i--) {
      const p = papers[i], k = (now - p.t0) / 1100;
      if (k >= 1) { papers.splice(i, 1); continue; }
      const x = Math.round(p.from.x + 2 + (p.to.x - p.from.x) * k), y = Math.round(p.from.dy + (p.to.dy - p.from.dy) * k - Math.sin(Math.PI * k) * 24);
      R(ctx, x, y, 7, 8, '#fff'); R(ctx, x, y + 7, 7, 1, '#c3c9d4'); R(ctx, x + 1, y + 2, 5, 1, '#9aa5b5'); R(ctx, x + 1, y + 4, 4, 1, '#9aa5b5');
    }
  }

  /* ---------- gambar ---------- */
  function seatedExtras(a, st) {
    const R = Scene.R, s = a.seat, px = s.x, t = (frame >> 1) % 2, skin = a.look.skin;
    R(ctx, px - 1, s.dy + 2, 12, 2, '#e6e8ee');
    if (st === 'working') { R(ctx, px + 1, s.dy + 1 + t, 2, 2, skin); R(ctx, px + 7, s.dy + 2 - t, 2, 2, skin); }
    else { R(ctx, px + 1, s.dy + 1, 2, 2, skin); if (st !== 'done') R(ctx, px + 7, s.dy + 1, 2, 2, skin); }
    if (st !== 'idle') return;
    for (let i = 0, k = (frame >> 3) % 3; i <= k; i++) { // zZ saat tidur
      const zx = px + 12 + i * 3, zy = s.y - i * 4;
      R(ctx, zx, zy, 3, 1, '#9fb3d1'); R(ctx, zx + 1, zy + 1, 1, 1, '#9fb3d1'); R(ctx, zx, zy + 2, 3, 1, '#9fb3d1');
    }
  }
  function headOf(a) { // titik atas kepala (dunia) untuk label & balon
    if (a.mode === 'seat') return { x: a.seat.x + 5, y: a.seat.y };
    if (a.mode === 'sit') return { x: Pathing.SIT[a.sit][0] + 5, y: Pathing.SIT[a.sit][1] };
    return { x: a.x, y: a.y - 17 };
  }
  /** Posisi overlay (persen kotak) dari persen kanvas iso, sudah memperhitungkan kamera. */
  const camPct = (p) => { const bw = box.clientWidth || 1, bh = box.clientHeight || 1; return { left: p.left * cam.s + cam.tx / bw * 100, top: p.top * cam.s + cam.ty / bh * 100 }; };
  const TAG_GAP = 1, TAG_MAX_SHIFT = 10;
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function syncBubbles(now, left, top, a) {
    if (!a.bubble) return;
    if (now > a.bubble.until) { a.bubble.el.remove(); a.bubble = null; } else { a.bubble.el.style.left = left; a.bubble.el.style.top = top; }
  }
  /** Tampilan datar: posisi label dan balon langsung dari koordinat denah. */
  function syncFlat(now) {
    for (const id of IDS) {
      const a = actors[id], p = headOf(a), left = (p.x / W * 100) + '%', top = ((p.y - 3) / H * 100) + '%', tag = tagEl[id];
      if (tag) { tag.classList.remove('kecil'); tag.style.left = left; tag.style.top = top; tag.style.transform = ''; }
      syncBubbles(now, left, top, a);
    }
    for (const { r, el } of labels) { el.classList.remove('on'); el.style.visibility = ''; el.style.left = ((r.x + 4) / W * 100) + '%'; el.style.top = ((r.y + 3) / H * 100) + '%'; el.style.transform = ''; }
  }
  /**
   * Tampilan 2.5D: tag agen disusun agar tidak saling menimpa (yang paling depan tetap di kepalanya, yang di belakang digeser ke atas),
   * tag diringkas jadi nama saja saat kamera menampilkan semua ruangan, dan nama ruangan disembunyikan bila bertabrakan dengan tag.
   */
  function syncIsoOverlay(now) {
    const bw = box.clientWidth, bh = box.clientHeight, kecil = !focusId, tags = [];
    for (const id of IDS) { // 1) ubah isi/kelas, 2) baru baca ukuran: satu kali tata letak per bingkai
      const tag = tagEl[id]; if (tag && tag.classList.contains('kecil') !== kecil) tag.classList.toggle('kecil', kecil);
    }
    for (const id of IDS) {
      const a = actors[id], p = camPct(Iso.kepala(a, rot)), x = p.left / 100 * bw, y = (p.top - 1) / 100 * bh, tag = tagEl[id];
      syncBubbles(now, p.left + '%', (p.top - 1) + '%', a);
      if (tag) tags.push({ el: tag, x, y, w: tag.offsetWidth, h: tag.offsetHeight });
    }
    const placed = [];
    for (const t of tags.sort((m, n) => n.y - m.y)) { // depan dulu
      let shift = 0, rect;
      for (; shift <= TAG_MAX_SHIFT; shift++) {
        const y1 = t.y - shift * (t.h + TAG_GAP);
        rect = { x0: t.x - t.w / 2 - TAG_GAP, x1: t.x + t.w / 2 + TAG_GAP, y0: y1 - t.h - TAG_GAP, y1: y1 + TAG_GAP };
        if (!placed.some((q) => overlap(rect, q))) break;
      }
      placed.push(rect); t.top = rect.y1 - TAG_GAP;
    }
    const labelRects = [];
    const lab = labels.map(({ r, el }) => { const p = camPct(Iso.kePersen(r.x + r.w / 2, r.y + 3, 0, rot)); return { r, el, x: p.left / 100 * bw, y: p.top / 100 * bh, w: el.offsetWidth, h: el.offsetHeight }; });
    for (const l of lab.sort((m, n) => (n.r.id === focusId) - (m.r.id === focusId))) { // ruangan terfokus didahulukan
      const kotak = (dy) => ({ x0: l.x - l.w / 2 - TAG_GAP, x1: l.x + l.w / 2 + TAG_GAP, y0: l.y + dy - TAG_GAP, y1: l.y + dy + l.h + TAG_GAP });
      const bebas = (rect) => !placed.some((q) => overlap(rect, q)) && !labelRects.some((q) => overlap(rect, q)) && rect.x0 >= 0 && rect.x1 <= bw && rect.y0 >= 0 && rect.y1 <= bh;
      const fokus = l.r.id === focusId;
      const geser = fokus ? [0, 1, 2, 3, -1, -2, 4, 5, -3].map((k) => k * (l.h + TAG_GAP)).find((dy) => bebas(kotak(dy))) : (bebas(kotak(0)) ? 0 : undefined); // ruangan terfokus dicarikan celah terdekat
      l.dy = geser === undefined ? 0 : geser; l.tampil = fokus || geser !== undefined;
      if (l.tampil) labelRects.push(kotak(l.dy));
    }
    for (const t of tags) { t.el.style.left = t.x + 'px'; t.el.style.top = t.top + 'px'; }
    for (const l of lab) { l.el.classList.toggle('on', l.r.id === focusId); l.el.style.visibility = l.tampil ? '' : 'hidden'; l.el.style.left = l.x + 'px'; l.el.style.top = (l.y + (l.dy || 0)) + 'px'; l.el.style.transform = 'translateX(-50%)'; }
  }
  const syncOverlay = (now) => (view === 'iso' ? syncIsoOverlay(now) : syncFlat(now));
  /* ---------- tampilan 2.5D ---------- */
  const ZOOM_RUANG = 2.1, CAM_EASE = 0.18;
  const buatKanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function setCamTarget() {
    const w = box.clientWidth, h = box.clientHeight;
    camGoal = focusId ? Iso.fokus(focusId, rot, w, h, ZOOM_RUANG) : { tx: 0, ty: 0, s: 1 };
  }
  function stepCam() {
    const k = REDUCED ? 1 : CAM_EASE;
    cam = { tx: cam.tx + (camGoal.tx - cam.tx) * k, ty: cam.ty + (camGoal.ty - cam.ty) * k, s: cam.s + (camGoal.s - cam.s) * k };
    if (Math.abs(cam.s - camGoal.s) < 0.002 && Math.abs(cam.tx - camGoal.tx) < 0.3 && Math.abs(cam.ty - camGoal.ty) < 0.3) cam = { ...camGoal };
    icv.style.transform = `translate(${cam.tx}px,${cam.ty}px) scale(${cam.s})`;
  }
  function drawIso() {
    stepCam();
    const aktor = IDS.map((id) => { const a = actors[id]; return { id, look: a.look, mode: a.mode, x: a.x, y: a.y, seat: a.seat, sit: a.sit, state: stateOf(id) }; });
    const now = performance.now();
    const kertas = papers.filter((p) => now - p.t0 < 1100).map((p) => ({ from: p.from, to: p.to, k: (now - p.t0) / 1100 }));
    for (let i = papers.length - 1; i >= 0; i--) if (now - papers[i].t0 >= 1100) papers.splice(i, 1);
    Iso.render(ictx, { rot, frame, night, sorot: focusId, aktor, kertas }, buatKanvas);
  }
  function applyView() {
    const iso = view === 'iso';
    box.classList.toggle('iso', iso); icv.classList.toggle('hide', !iso); cv.classList.toggle('hide', iso);
    box.style.aspectRatio = iso ? `${Iso.CW} / ${Iso.CH}` : '480 / 320';
    box.style.setProperty('--rasio', iso ? (Iso.CW / Iso.CH).toFixed(4) : '1.5'); // lebar kantor dibatasi tinggi layar
    cam = { tx: 0, ty: 0, s: 1 }; camGoal = cam; if (iso) { setCamTarget(); } else { focusId = null; }
    for (const [k, b] of Object.entries(bar)) if (b.dataset.view) b.classList.toggle('on', b.dataset.view === view);
    barSync();
  }
  function barSync() {
    for (const b of Object.values(bar)) { if (b.dataset.room !== undefined) b.classList.toggle('on', (b.dataset.room || null) === focusId); if (b.dataset.rot) b.disabled = view !== 'iso'; }
  }
  function setView(v) { view = v === 'flat' ? 'flat' : 'iso'; try { localStorage.setItem('kantorView', view); } catch { /* penyimpanan dimatikan: tidak masalah */ } applyView(); }
  function rotate(d) { rot = (rot + d + 4) & 3; setCamTarget(); }
  function layarPenuh() {
    const el = box.parentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function focusRoom(id) { focusId = id && Iso.ruang(id) ? id : null; if (view !== 'iso' && focusId) setView('iso'); setCamTarget(); barSync(); if (onFocus) onFocus(focusId); }
  function buildBar(el) {
    const mk = (txt, attrs, fn, title) => { const b = h('button', { type: 'button', class: 'ob', ...attrs, title: title || '' }, txt); b.addEventListener('click', fn); el.append(b); bar[Object.values(attrs).join(':') + txt] = b; return b; };
    mk('Semua', { 'data-room': '' }, () => focusRoom(null), 'Tampilkan seluruh kantor');
    for (const r of Pathing.ROOMS) mk(r.nama.replace(/^Ruang /, ''), { 'data-room': r.id }, () => focusRoom(r.id), r.nama);
    const sp = h('span', { class: 'ob-gap' }); el.append(sp);
    mk('⟲', { 'data-rot': '-1' }, () => rotate(-1), 'Putar kiri');
    mk('⟳', { 'data-rot': '1' }, () => rotate(1), 'Putar kanan');
    mk('2.5D', { 'data-view': 'iso' }, () => setView('iso'), 'Tampilan isometrik');
    mk('Datar', { 'data-view': 'flat' }, () => setView('flat'), 'Tampilan dari atas');
    mk('⛶', { 'data-full': '1' }, layarPenuh, 'Layar penuh (Esc untuk keluar)');
  }
  function draw() {
    const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
    const hidden = document.hidden || (view === 'iso' ? icv : cv).offsetParent === null;
    if (hidden) { fastForward(); return; }
    ticks++; if (ticks % 3 === 0) frame++;
    for (const a of Object.values(actors)) step(a, dt);
    if (view === 'iso') { drawIso(); syncOverlay(now); return; }
    const sitting = Object.values(actors).filter((a) => a.mode === 'sit');
    const sitNames = sitting.map((a) => a.sit);
    Scene.floors(ctx); Scene.walls(ctx, night); Scene.furniture(ctx, frame, sitNames);
    for (const id of IDS) {
      const a = actors[id], st = stateOf(id), at = a.mode === 'seat';
      if (at) Avatars.seated(ctx, a.seat.x, a.seat.y, a.look, st, frame); else Avatars.emptyChair(ctx, a.seat.x, a.seat.y);
      Scene.desk(ctx, a.seat, at && st === 'working', frame);
      if (at) seatedExtras(a, st);
    }
    for (const a of sitting) Avatars.seated(ctx, Pathing.SIT[a.sit][0], Pathing.SIT[a.sit][1], a.look, 'happy', frame, { chair: false });
    Scene.foreground(ctx, frame, sitNames);
    Object.values(actors).filter((a) => a.mode === 'walk').sort((p, q) => p.y - q.y).forEach((a) => Avatars.walker(ctx, a.x, a.y, a.look, frame, stateOf(a.id) === 'done' ? 'happy' : 'walk'));
    drawPapers();
    if (night) {
      Scene.R(ctx, 0, 0, W, H, 'rgba(8,12,40,.5)');
      for (const id of IDS) {
        if (stateOf(id) !== 'working' || actors[id].mode !== 'seat') continue;
        const s = actors[id].seat, gx = s.dx + s.w / 2, gy = s.dy - 4, g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 40);
        g.addColorStop(0, 'rgba(255,230,150,.38)'); g.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = g; ctx.fillRect(gx - 44, gy - 44, 88, 88);
      }
    }
    syncOverlay(now);
  }

  function refreshTags() {
    for (const id of IDS) {
      const a = agents[id]; if (!a) continue;
      const label = a.status === 'working' && a.tugas ? a.tugas : a.status === 'done' && a.tugas ? '✓ ' + a.tugas : 'Idle';
      const el = tagEl[id] || (tagEl[id] = box.appendChild(h('div', { class: 'tag' })));
      el.className = 'tag ' + a.status; el.title = a.ringkas || a.nama; el.replaceChildren(h('b', {}, a.nama), label === 'Idle' ? '' : h('span', { class: 'tg' }, label));
    }
  }

  return {
    init() {
      cv = $('#cv'); ctx = cv.getContext('2d'); box = $('#office');
      icv = h('canvas', { id: 'icv', width: Iso.CW * Iso.RES, height: Iso.CH * Iso.RES, role: 'img', 'aria-label': 'Kantor 2.5D dengan empat belas ruangan; agen AI bekerja, berjalan, dan mengobrol' });
      ictx = icv.getContext('2d'); box.prepend(icv);
      for (const r of Pathing.ROOMS) { const el = h('div', { class: 'room-label' }, r.nama); box.append(el); labels.push({ r, el }); }
      const barEl = $('#officeBar'); if (barEl) buildBar(barEl);
      try { if (localStorage.getItem('kantorView') === 'flat') view = 'flat'; } catch { /* abaikan */ }
      applyView(); addEventListener('resize', setCamTarget); document.addEventListener('fullscreenchange', setCamTarget);
      setInterval(draw, 40); setInterval(wanderTick, 4000);
    },
    setView, rotate, focusRoom,
    onFocus(fn) { onFocus = fn; },
    /** Ruangan tempat agen berada sekarang (di meja = ruang mejanya; berjalan = ruangan yang dilewati). */
    ruangDari(id) { const a = actors[id]; if (!a) return null; const p = a.mode === 'walk' ? { x: a.x, y: a.y } : a.mode === 'sit' ? { x: Pathing.SIT[a.sit][0] + 5, y: Pathing.SIT[a.sit][1] + 10 } : { x: a.seat.x + 5, y: a.seat.dy + 4 }; return Pathing.ROOMS.find((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) || null; },
    update(list) {
      const prev = agents; agents = {}; for (const a of list) agents[a.id] = a;
      spawnPapers(prev);
      for (const id of IDS) {
        const a = actors[id];
        if (stateOf(id) === 'working' && a.mode !== 'seat') { a.at = null; a.activity = null; goHome(a); } // dapat kerja: kembali ke meja
        if (stateOf(id) === 'idle' && prev[id] && prev[id].status !== 'idle') a.idleSince = Date.now();
      }
      refreshTags();
      // peserta yang tadi dikirim kembali ke meja karena mendapat pekerjaan, bergabung lagi begitu bebas
      if (rapat) for (const id of rapat.peserta) { const a = actors[id]; if (a.meeting && stateOf(id) !== 'working' && a.mode === 'seat' && !a.homing && !a.rejoining) { a.rejoining = true; walkTo(a, Pathing.spot(a.kursi)).finally(() => { a.rejoining = false; }); } }
    },
    setNight(b) { night = b; },
    rapatMulai, rapatSelesai,
    say,
    snapshot() { return { queue: queue.length, directing, rapat: rapat ? { selesai: rapat.selesai, peserta: rapat.peserta.length } : null, actors: Object.fromEntries(IDS.map((id) => [id, { mode: actors[id].mode, meeting: Boolean(actors[id].meeting), x: Math.round(actors[id].x), y: Math.round(actors[id].y), at: actors[id].at, activity: actors[id].activity, sit: actors[id].sit, bubble: actors[id].bubble ? actors[id].bubble.el.textContent : null }])) }; },
  };
})();
