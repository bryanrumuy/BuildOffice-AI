'use strict';
/**
 * Tampilan 2.5D (isometrik) kantor. Memakai denah, perabot, dan posisi agen yang SAMA dengan tampilan 2D (Pathing + Office),
 * jadi agen dan gerakannya tidak ditulis ulang: ini hanya cara menggambarnya. Mendukung 4 arah pandang (putar 90 derajat),
 * dinding belakang tinggi dan dinding depan rendah supaya isi ruangan selalu terlihat, dan fokus kamera ke satu ruangan.
 * Bagian proyeksi murni (tanpa kanvas) bisa dimuat di Node untuk uji.
 */
const Iso = (() => {
  const P = typeof Pathing !== 'undefined' ? Pathing : require('./pathing.js');
  const { W, H, ROOMS, WALLS, LAYOUT, SIZES, SEATS, SEAT_ORDER, SIT } = P;
  const M = 10, RES = 2, ZTOP = 58, SP = 1.4, SEGMEN = 16;
  const CW = W + H + 2 * M, CH = (W + H) / 2 + ZTOP + M; // ukuran logis kanvas, sama untuk keempat arah pandang

  /* ---------- proyeksi (murni) ---------- */
  const dims = (rot) => (rot & 1 ? [H, W] : [W, H]);
  /** Putar titik denah searah jarum jam sebesar rot x 90 derajat; hasilnya tetap di dalam bidang dims(rot). */
  const putar = (x, y, rot = 0) => { switch (rot & 3) { case 1: return [H - y, x]; case 2: return [W - x, H - y]; case 3: return [y, W - x]; default: return [x, y]; } };
  const proj = (X, Y, z, PH) => ({ x: M + PH + (X - Y), y: ZTOP + (X + Y) / 2 - z }); // X,Y sudah diputar
  /** Titik denah (x, y, tinggi z) -> piksel logis kanvas. */
  const proyeksi = (x, y, z = 0, rot = 0) => { const [X, Y] = putar(x, y, rot); return proj(X, Y, z, dims(rot)[1]); };
  const kotakPutar = (x, y, w, d, rot) => { const a = putar(x, y, rot), b = putar(x + w, y + d, rot); return { X0: Math.min(a[0], b[0]), Y0: Math.min(a[1], b[1]), X1: Math.max(a[0], b[0]), Y1: Math.max(a[1], b[1]) }; };
  /** Urutan gambar (pelukis): makin besar makin dekat ke penonton. */
  const kedalaman = (x, y, rot = 0) => { const [X, Y] = putar(x, y, rot); return X + Y; };
  const kePersen = (x, y, z, rot) => { const p = proyeksi(x, y, z, rot); return { left: p.x / CW * 100, top: p.y / CH * 100 }; };
  const ruang = (id) => ROOMS.find((r) => r.id === id) || null;
  /** Transformasi kamera (translate + scale, dalam piksel tampilan vw x vh) yang memusatkan ruangan id; id kosong = tampak semua. */
  function fokus(id, rot, vw, vh, zoom = 2.1) {
    const r = ruang(id); if (!r) return { tx: 0, ty: 0, s: 1 };
    const c = proyeksi(r.x + r.w / 2, r.y + r.h / 2, 0, rot), k = vw / CW, cx = c.x * k, cy = c.y * k;
    return { tx: Math.min(0, Math.max(vw - vw * zoom, vw / 2 - cx * zoom)), ty: Math.min(0, Math.max(vh - vh * zoom, vh / 2 - cy * zoom)), s: zoom };
  }
  /** Ruangan tempat meja agen berada (untuk mengelompokkan agen per ruangan); null bila agen tak punya meja. */
  const ruangAgen = (id) => { const s = SEATS[id]; return s ? ROOMS.find((r) => s[0] + 5 >= r.x && s[0] + 5 < r.x + r.w && s[1] >= r.y && s[1] < r.y + r.h) || null : null; };

  /* ---------- warna & primitif gambar ---------- */
  const cache = new Map();
  const warna = (c, f) => { const k = c + f; if (!cache.has(k)) { const v = [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f)))); cache.set(k, `rgb(${v})`); } return cache.get(k); };
  function poly(ctx, pts, fill, garis = true) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (garis) { ctx.strokeStyle = 'rgba(10,16,32,.28)'; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  /** Balok: z0 = tinggi alas, h = tinggi. Mengembalikan kotak yang sudah diputar (untuk detail di permukaannya). */
  function balok(ctx, rot, x, y, w, d, z0, h, base, o = {}) {
    const r = kotakPutar(x, y, w, d, rot), PH = dims(rot)[1], pt = (X, Y, z) => proj(X, Y, z, PH), z1 = z0 + h;
    poly(ctx, [pt(r.X0, r.Y1, z0), pt(r.X1, r.Y1, z0), pt(r.X1, r.Y1, z1), pt(r.X0, r.Y1, z1)], o.kiri || warna(base, 0.86)); // sisi selatan
    poly(ctx, [pt(r.X1, r.Y0, z0), pt(r.X1, r.Y1, z0), pt(r.X1, r.Y1, z1), pt(r.X1, r.Y0, z1)], o.kanan || warna(base, 0.68)); // sisi timur
    poly(ctx, [pt(r.X0, r.Y0, z1), pt(r.X1, r.Y0, z1), pt(r.X1, r.Y1, z1), pt(r.X0, r.Y1, z1)], o.atas || warna(base, 1.14));
    return { ...r, PH, z0, z1 };
  }
  /** Persegi panjang di sisi selatan balok (u0..u1 sepanjang lebar, z0..z1 tinggi mutlak) dan sisi timur. */
  const sisiS = (ctx, b, u0, u1, z0, z1, c) => poly(ctx, [[u0, z0], [u1, z0], [u1, z1], [u0, z1]].map(([u, z]) => proj(b.X0 + (b.X1 - b.X0) * u, b.Y1, z, b.PH)), c, false);
  const sisiT = (ctx, b, u0, u1, z0, z1, c) => poly(ctx, [[u0, z0], [u1, z0], [u1, z1], [u0, z1]].map(([u, z]) => proj(b.X1, b.Y0 + (b.Y1 - b.Y0) * u, z, b.PH)), c, false);
  const elips = (ctx, p, rx, ry, c) => { ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };

  /* ---------- lantai (disimpan sekali per arah pandang) ---------- */
  const LANTAI = { baca: ['plank', '#8a5a36'], arsip: ['karpet', '#35557f'], keuangan: ['karpet', '#2f6b57'], manajer: ['karpet', '#4a3b30'], pengingat: ['karpet', '#7d4141'], lobi: ['catur', '#dfe3ea', '#c3c9d4', 8],
    pelapor: ['karpet', '#5b4a82'], pantry: ['catur', '#efe6cf', '#d9cfae', 6], santai: ['karpet', '#2f6b6b'], server: ['catur', '#243148', '#1d2840', 8], rapat: ['karpet', '#2e4a63'],
    perpus: ['plank', '#6b4a30'], gudang: ['catur', '#7a828e', '#6c7480', 10], taman: ['rumput', '#3f7f40'] };
  const PERMADANI = [[286, 76, 56, 32, '#7d2f2f'], [112, 172, 56, 22, '#8c3b3b'], [284, 180, 56, 46, '#3a5f8f'], [366, 146, 94, 64, '#27506b'], [36, 276, 56, 30, '#3d5a80']];
  const SETAPAK = [[274, 246, 24, 32], [274, 270, 130, 8], [402, 246, 24, 32], [300, 262, 30, 6]];
  const lantaiCache = {};
  function lantaiKanvas(rot, buatKanvas) {
    if (lantaiCache[rot]) return lantaiCache[rot];
    const cv = buatKanvas(CW * RES, CH * RES), g = cv.getContext('2d'); g.scale(RES, RES);
    const PH = dims(rot)[1], pt = (x, y) => proyeksi(x, y, 0, rot);
    const rect = (x, y, w, d, c, garis) => poly(g, [pt(x, y), pt(x + w, y), pt(x + w, y + d), pt(x, y + d)], c, garis);
    rect(0, 0, W, H, '#7c5230', false); // lorong dan lantai dasar
    for (let yy = 4; yy < H; yy += 6) { const a = pt(0, yy), b = pt(W, yy); g.strokeStyle = 'rgba(60,35,15,.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    for (const r of ROOMS) {
      const [jenis, c1, c2, s] = LANTAI[r.id] || ['karpet', '#445'];
      rect(r.x, r.y, r.w, r.h, c1, false);
      if (jenis === 'catur') { for (let yy = r.y; yy < r.y + r.h; yy += s) for (let xx = r.x; xx < r.x + r.w; xx += s) if (((xx - r.x) / s + (yy - r.y) / s) % 2) rect(xx, yy, Math.min(s, r.x + r.w - xx), Math.min(s, r.y + r.h - yy), c2, false); }
      else if (jenis === 'plank') { for (let yy = r.y + 6; yy < r.y + r.h; yy += 6) { const a = pt(r.x, yy), b = pt(r.x + r.w, yy); g.strokeStyle = 'rgba(40,22,8,.4)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } }
      else if (jenis === 'rumput') { for (let yy = r.y + 3; yy < r.y + r.h; yy += 7) for (let xx = r.x + ((yy / 7) % 2) * 3; xx < r.x + r.w; xx += 9) { const a = pt(xx, yy); g.fillStyle = '#4d9a4d'; g.fillRect(a.x, a.y, 1.2, 1.2); } }
      else { for (let yy = r.y; yy < r.y + r.h; yy += 5) for (let xx = r.x + (((yy - r.y) / 5) % 2) * 2.5; xx < r.x + r.w; xx += 5) { const a = pt(xx, yy); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(a.x, a.y, 1, 1); } }
    }
    for (const [x, y, w, d, c] of PERMADANI) { rect(x, y, w, d, c, false); rect(x + 2, y + 2, w - 4, d - 4, warna(c, 1.18), false); }
    for (const [x, y, w, d] of SETAPAK) rect(x, y, w, d, '#c9b48a', false);
    lantaiCache[rot] = cv; return cv;
  }

  /* ---------- perabot ---------- */
  const SAMPUL = ['#c0392b', '#3a7bd5', '#f2c14e', '#2e9e6b', '#7d4fc4', '#e0833a'];
  const FURN = {
    bookshelf: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 28, '#8a5a2e'); for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) sisiS(g, b, i / 6 + 0.04, (i + 1) / 6 - 0.04, 3 + r * 8, 9 + r * 8, SAMPUL[(i + r * 2) % 6]); },
    cabinet: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 22, '#7d8796'); sisiS(g, b, 0.08, 0.92, 3, 10, warna('#7d8796', 0.7)); sisiS(g, b, 0.08, 0.92, 12, 19, warna('#7d8796', 0.7)); },
    safe: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 18, '#3b4150'); sisiS(g, b, 0.25, 0.75, 4, 14, '#566074'); },
    plant: (g, o) => { balok(g, o.rot, o.x + 2, o.y + 5, 8, 6, 0, 6, '#b5651d'); const p = proyeksi(o.x + o.w / 2, o.y + o.h / 2, 12, o.rot); elips(g, p, 7, 6, '#2f7a3c'); elips(g, { x: p.x - 1, y: p.y - 3 }, 5, 4, '#3b8f4a'); elips(g, { x: p.x - 2, y: p.y - 4 }, 2, 1.5, '#58b062'); },
    coffee: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 14, '#6b4a30'); sisiS(g, b, 0.2, 0.8, 5, 9, '#2b2f3a'); },
    printer: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 10, '#cfd3d8'); sisiS(g, b, 0.15, 0.85, 3, 5, '#8a8f98'); },
    fridge: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 34, '#e3e7ec'); sisiS(g, b, 0, 1, 16.5, 17.5, '#9aa0aa'); sisiS(g, b, 0.8, 0.9, 22, 30, '#8a8f98'); sisiS(g, b, 0.8, 0.9, 6, 12, '#8a8f98'); },
    counter: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 12, '#b98a55', { atas: '#e0b47c' }); },
    table: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 9, '#c9985f'); },
    readtable: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 9, '#c9985f'); },
    bench: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 6, '#8a5a2e'); },
    sofa: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, 6, 0, 16, '#a0524a'); balok(g, o.rot, o.x, o.y + 6, o.w, o.d - 6, 0, 7, '#bd6a60'); balok(g, o.rot, o.x, o.y + 6, 4, o.d - 6, 0, 12, '#8e433b'); balok(g, o.rot, o.x + o.w - 4, o.y + 6, 4, o.d - 6, 0, 12, '#8e433b'); },
    couch: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, 5, 0, 15, '#4f6fa5'); balok(g, o.rot, o.x, o.y + 5, o.w, o.d - 5, 0, 7, '#6a8ac4'); balok(g, o.rot, o.x, o.y + 5, 3, o.d - 5, 0, 11, '#3f5d92'); balok(g, o.rot, o.x + o.w - 3, o.y + 5, 3, o.d - 5, 0, 11, '#3f5d92'); },
    tv: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 4, 14, '#20242e'); balok(g, o.rot, o.x + o.w / 2 - 4, o.y + 3, 8, 4, 0, 4, '#20242e'); sisiS(g, b, 0.04, 0.96, 6, 16.5, o.santai ? ((o.f >> 2) % 2 ? '#7fd0ff' : '#ffd98a') : '#1b2a3a'); },
    longtable: (g, o) => {
      for (let i = 0; i < 5; i++) { const cx = 383 + i * 12 - 5; balok(g, o.rot, cx, o.y - 8, 10, 7, 0, 7, '#3d8f55'); balok(g, o.rot, cx, o.y + 29, 10, 7, 0, 7, '#3d8f55'); }
      const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 9, '#a8733c', { atas: '#e0b04a' });
      for (const [px, py] of [[8, 6], [22, 15], [36, 6], [50, 15], [60, 6]]) balok(g, o.rot, o.x + px, o.y + py, 7, 5, 9, 1.5, '#2b2f3a', { atas: '#4a90c0' });
      balok(g, o.rot, o.x + 30, o.y + 11, 6, 5, 9, 0.6, '#ffffff'); void b;
    },
    rack: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 32, '#2b303b'); for (let i = 0; i < 6; i++) { sisiS(g, b, 0.1, 0.9, 3 + i * 5, 6.5 + i * 5, '#222833'); sisiS(g, b, 0.18, 0.34, 4.2 + i * 5, 5.4 + i * 5, ((o.f >> 2) + i + o.x) % 3 ? '#43c17a' : '#f2b84b'); sisiS(g, b, 0.62, 0.78, 4.2 + i * 5, 5.4 + i * 5, ((o.f >> 3) + i) % 4 ? '#5aa9ff' : '#2b303b'); } },
    tree: (g, o) => { balok(g, o.rot, o.x + 8, o.y + 18, 6, 6, 0, 16, '#6b4426'); const p = proyeksi(o.x + 11, o.y + 21, 30, o.rot); elips(g, { x: p.x, y: p.y + 4 }, 14, 10, '#2a6b35'); elips(g, p, 12, 9, '#2f7a3c'); elips(g, { x: p.x - 2, y: p.y - 5 }, 8, 6, '#3b8f4a'); elips(g, { x: p.x - 4, y: p.y - 7 }, 3, 2, '#58b062'); },
    pond: (g, o) => { balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 2, '#8aa0b5'); const r = kotakPutar(o.x + 3, o.y + 3, o.w - 6, o.d - 6, o.rot), pt = (X, Y) => proj(X, Y, 2.2, dims(o.rot)[1]); poly(g, [pt(r.X0, r.Y0), pt(r.X1, r.Y0), pt(r.X1, r.Y1), pt(r.X0, r.Y1)], '#3a86b8', false); const t = (o.f >> 2) % 3, q = proyeksi(o.x + 12 + t * 2, o.y + 8, 2.4, o.rot); g.fillStyle = '#8fd0f2'; g.fillRect(q.x, q.y, 7, 1); elips(g, proyeksi(o.x + 30, o.y + 9, 3, o.rot), 3, 1.6, '#f28c3a'); },
    box: (g, o) => { const b = balok(g, o.rot, o.x, o.y, o.w, o.d, 0, 10, '#b88a55'); sisiS(g, b, 0.44, 0.56, 0, 10, '#8a6538'); },
  };
  const KURSI_MAKAN = [[301, 143], [315, 143]], KURSI_BACA = [[49, 279], [67, 279]];

  /* ---------- daftar benda statis per arah pandang ---------- */
  const statisCache = {};
  function statis(rot) {
    if (statisCache[rot]) return statisCache[rot];
    const list = [];
    for (const [kind, x, y] of LAYOUT) { const [w, d] = SIZES[kind]; list.push({ k: kedalaman(x + w, y + d, rot), gambar: (g, st) => FURN[kind](g, { rot, x, y, w, d, h: d, f: st.frame, santai: st.santai }) }); }
    for (const [x, y] of [...KURSI_MAKAN, ...KURSI_BACA]) list.push({ k: kedalaman(x + 12, y + 9, rot) - 0.1, gambar: (g) => balok(g, rot, x - 1, y, 12, 9, 0, 7, '#9a6a38') });
    // dinding: dipecah per segmen supaya urutan gambar benar; dinding perimeter di sisi jauh tinggi (dengan jendela), selainnya rendah
    WALLS.forEach(([x, y, w, d], idx) => {
      const perimeter = idx < 4, mendatar = w >= d, r = kotakPutar(x, y, w, d, rot);
      const jauh = perimeter && (mendatar ? (rot & 1 ? r.X0 : r.Y0) : (rot & 1 ? r.Y0 : r.X0)) < 2;
      const tinggi = perimeter ? (jauh ? 36 : 5) : 15, dasar = perimeter ? (jauh ? '#3b5278' : '#2b3e5c') : '#5a6f94';
      const n = Math.max(1, Math.ceil((mendatar ? w : d) / SEGMEN));
      for (let i = 0; i < n; i++) {
        const sx = mendatar ? x + (w / n) * i : x, sy = mendatar ? y : y + (d / n) * i, sw = mendatar ? w / n : w, sd = mendatar ? d : d / n;
        const jendela = jauh && perimeter && i % 3 === 1;
        list.push({ k: kedalaman(sx + sw, sy + sd, rot), gambar: (g, st) => {
          const b = balok(g, rot, sx, sy, sw, sd, 0, tinggi, dasar);
          if (jendela) { const langit = st.night ? '#1b2a4a' : '#9fd8f5'; if (mendatar === !(rot & 1)) sisiS(g, b, 0.18, 0.82, 14, 29, langit); else sisiT(g, b, 0.18, 0.82, 14, 29, langit); }
        } });
      }
    });
    return (statisCache[rot] = list);
  }

  /* ---------- gambar satu bingkai ---------- */
  /** st: { rot, frame, night, sorot, aktor:[{id,look,mode,x,y,seat,sit,state}], kertas:[{from,to,k}], ctxBuat } */
  function render(ctx, st, buatKanvas) {
    const rot = st.rot & 3, f = st.frame || 0, items = statis(rot).map((it) => ({ k: it.k, g: (g) => it.gambar(g, { frame: f, night: st.night, santai: (st.aktor || []).some((a) => a.mode === 'sit' && String(a.sit).startsWith('santai')) }) }));
    ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#0f1b2d'; ctx.fillRect(0, 0, CW, CH);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lantaiKanvas(rot, buatKanvas), 0, 0); ctx.setTransform(RES, 0, 0, RES, 0, 0);
    if (st.sorot) { const r = ruang(st.sorot); if (r) { const pt = (x, y) => proyeksi(x, y, 0.5, rot); ctx.beginPath(); [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].forEach(([x, y], i) => { const p = pt(x, y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fillStyle = 'rgba(255,214,102,.12)'; ctx.fill(); ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1.6; ctx.stroke(); } }
    const aktor = st.aktor || [], byId = Object.fromEntries(aktor.map((a) => [a.id, a]));
    for (const id of SEAT_ORDER) { // meja, monitor, kursi, dan penghuni yang sedang duduk di mejanya
      const s = SEATS[id], dx = s[0], dy = s[1], w = s[2], a = byId[id], hadir = a && a.mode === 'seat', kerja = hadir && a.state === 'working', sx = dx + (w - 10) / 2;
      items.push({ k: kedalaman(dx + w, dy + 13, rot), g: (g) => {
        balok(g, rot, dx, dy, w, 13, 0, 9, '#9a6a38', { atas: '#e0b47c' });
        for (const mx of [dx + 2, dx + w - 14]) {
          const b = balok(g, rot, mx, dy + 1, 12, 2, 9, 9, '#2b2f3a');
          sisiS(g, b, 0.08, 0.92, 10.5, 17, kerja ? '#0f4b4b' : '#141c2e');
          if (kerja) for (let i = 0; i < 3; i++) sisiS(g, b, 0.14, 0.14 + 0.2 + ((i * 5 + f) % 7) / 14, 11.5 + i * 1.8, 12.3 + i * 1.8, '#5eead4');
        }
      } });
      items.push({ k: kedalaman(sx + 11, dy - 1, rot), g: (g) => { balok(g, rot, sx - 1, dy - 8, 12, 9, 0, 7, '#2f7d4a'); } });
      if (hadir && a.look) items.push({ k: kedalaman(sx + 5, dy - 3, rot) - 0.05, g: (g) => { const p = proyeksi(sx + 5, dy - 4, 6, rot); sprite(g, p, a, f, true); } });
    }
    for (const a of aktor) {
      if (a.mode === 'walk') items.push({ k: kedalaman(a.x, a.y, rot) + 0.2, g: (g) => sprite(g, proyeksi(a.x, a.y, 0, rot), a, f, false) });
      else if (a.mode === 'sit' && SIT[a.sit]) { const sx = SIT[a.sit][0] + 5, sy = SIT[a.sit][1] + 10; items.push({ k: kedalaman(sx, sy, rot) + 0.2, g: (g) => sprite(g, proyeksi(sx, sy, 5, rot), a, f, true, 'happy') }); }
    }
    for (const p of st.kertas || []) { const k = p.k, x = p.from.x + 2 + (p.to.x - p.from.x) * k, y = p.from.dy + (p.to.dy - p.from.dy) * k, z = 16 + Math.sin(Math.PI * k) * 22; items.push({ k: kedalaman(x, y, rot) + 5, g: (g) => { const q = proyeksi(x, y, z, rot); g.fillStyle = '#fff'; g.fillRect(q.x - 3, q.y - 4, 7, 8); g.fillStyle = '#9aa5b5'; g.fillRect(q.x - 2, q.y - 2, 5, 1); g.fillRect(q.x - 2, q.y, 4, 1); } }); }
    items.sort((a, b) => a.k - b.k);
    for (const it of items) it.g(ctx);
    if (st.night) {
      ctx.fillStyle = 'rgba(8,12,40,.5)'; ctx.fillRect(0, 0, CW, CH);
      for (const id of SEAT_ORDER) {
        const a = byId[id]; if (!a || a.mode !== 'seat' || a.state !== 'working') continue;
        const s = SEATS[id], p = proyeksi(s[0] + s[2] / 2, s[1] + 4, 12, rot), g = ctx.createRadialGradient(p.x, p.y, 3, p.x, p.y, 60);
        g.addColorStop(0, 'rgba(255,230,150,.4)'); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - 64, p.y - 64, 128, 128);
      }
    }
  }
  /** Avatar piksel (sprite yang sama dengan tampilan 2D) berdiri tegak di titik p. duduk = setengah badan. */
  function sprite(g, p, a, frame, duduk, suasana) {
    if (typeof Avatars === 'undefined') return;
    g.save(); g.translate(Math.round(p.x), Math.round(p.y)); g.scale(SP, SP); g.imageSmoothingEnabled = false;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2); g.fill();
    if (duduk) Avatars.seated(g, -5, -15, a.look, suasana || a.state || 'idle', frame, { chair: false }); else Avatars.walker(g, 0, 0, a.look, frame, a.state === 'done' ? 'happy' : 'walk');
    g.restore();
  }
  /** Titik di atas kepala agen (untuk label dan balon): { left, top } dalam persen kanvas. */
  function kepala(a, rot) {
    if (a.mode === 'seat') return kePersen(a.seat.x + 5, a.seat.dy - 4, 6 + 24, rot);
    if (a.mode === 'sit') return kePersen(SIT[a.sit][0] + 5, SIT[a.sit][1] + 10, 5 + 24, rot);
    return kePersen(a.x, a.y, 26, rot);
  }

  const api = { CW, CH, RES, dims, putar, proyeksi, kotakPutar, kedalaman, kePersen, fokus, ruang, ruangAgen, render, kepala, warna };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Iso;
