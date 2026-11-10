'use strict';
/** Kerangka aplikasi: login, tab, Beranda (dashboard), tanya kantor, pengaturan, dan data realtime (SSE). */
const state = { me: null, tab: 'beranda', agents: [], dash: null };
const TABS = { beranda: () => refreshDashboard(), dokumen: loadDocs, keuangan: loadKeuangan, proyek: loadProyek, tugas: loadTugas, laporan: loadLaporan, tanya: () => { renderPilihAgen(); return tanyaMode === 'perintah' ? loadAgen() : undefined; }, pengaturan: renderPengaturan };
const ACTIONS = {
  upload: 'mengunggah dokumen', ekstrak: 'agen selesai membaca dokumen', gagal: 'agen gagal membaca dokumen', verifikasi: 'memverifikasi dokumen', 'hapus-dokumen': 'menghapus dokumen', unduh: 'mengunduh dokumen asli',
  'kas-tambah': 'mencatat transaksi kas', 'kas-ubah': 'mengubah transaksi kas', 'kas-verifikasi': 'memverifikasi transaksi kas', 'kas-hapus': 'menghapus transaksi kas',
  'tagihan-tambah': 'menambah tagihan', 'tagihan-ubah': 'mengubah tagihan', 'tagihan-lunas': 'melunasi tagihan', 'tagihan-hapus': 'menghapus tagihan',
  'proyek-catat': 'mencatat progres proyek', 'proyek-hapus': 'menghapus data proyek', perintah: 'meminta agen mengerjakan perintah', 'hasil-hapus': 'menghapus hasil agen', 'tagihan-ganda': 'melewati tagihan ganda dari dokumen lain',
  'ekspor-kas': 'mengunduh CSV kas', 'ekspor-tagihan': 'mengunduh CSV tagihan', pengaturan: 'mengubah pengaturan', chat: 'bertanya ke kantor', 'ringkasan-kirim': 'mengirim ringkasan ke Telegram', 'ringkasan-terkirim': 'ringkasan harian terkirim',
  'tugas-tambah': 'menambah tugas', 'tugas-ubah': 'mengubah tugas', 'tugas-hapus': 'menghapus tugas', 'tugas-dikerjakan': 'meminta agen mengerjakan tugas', instruksi: 'memberi instruksi ke Manajer',
  'agen-buat': 'membuat agen baru', 'agen-ubah': 'mengubah agen', 'agen-hapus': 'menghapus agen', 'persetujuan-setuju': 'menyetujui pesan dari agen', 'persetujuan-tolak': 'menolak pesan dari agen',
  'berulang-tambah': 'menambah aturan berulang', 'berulang-ubah': 'mengubah aturan berulang', 'berulang-hapus': 'menghapus aturan berulang', 'berulang-dibuat': 'membuat tagihan/tugas rutin otomatis',
  'jadwal-ubah': 'mengubah jadwal laporan agen', 'laporan-agen-kirim': 'mengirim laporan rutin agen ke Telegram', 'laporan-agen-terkirim': 'laporan rutin agen terkirim', 'laporan-agen-gagal': 'laporan rutin agen gagal terkirim',
  'standup-kirim': 'mengirim standup ke Telegram', 'laporan-mingguan-kirim': 'mengirim laporan mingguan', backup: 'membuat backup data', 'ulang-dokumen': 'mengulang dokumen gagal', crash: 'server mati tak terduga',
};
let started = false, es = null, tanyaMode = 'tanya';

/* ---------- login ---------- */
function showLogin() { $('#login').classList.remove('hide'); }
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#lerr').textContent = '';
  try { await api('/api/login', { method: 'POST', body: { user: $('#lu').value, password: $('#lp').value } }); $('#lp').value = ''; $('#login').classList.add('hide'); start(); }
  catch (err) { $('#lerr').textContent = errText(err); }
});
$('#rapatBtn').addEventListener('click', panggilRapat);
const geserSkala = (d) => { const i = SKALA.indexOf(skalaSekarang()), j = Math.min(SKALA.length - 1, Math.max(0, i + d)); setSkala(SKALA[j]); toast('Ukuran tampilan ' + Math.round(SKALA[j] * 100) + '%'); };
$('#skalaKecil').addEventListener('click', () => geserSkala(-1)); $('#skalaBesar').addEventListener('click', () => geserSkala(1));
$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); location.reload(); });

/* ---------- tab ---------- */
function showTab(name) {
  if (name === 'agen') { name = 'tanya'; setTanyaMode('perintah', false); } // alamat lama #agen
  if (!TABS[name]) name = 'beranda';
  state.tab = name; if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  for (const b of $$('#tabs button')) { b.classList.toggle('on', b.dataset.tab === name); b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false'); }
  for (const s of $$('main > section')) s.classList.toggle('hide', s.id !== 'tab-' + name);
  Promise.resolve(TABS[name]()).catch((e) => toast(errText(e), 'bad'));
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });

/* ---------- header & badge ---------- */
function applyMe() {
  const me = state.me;
  document.body.className = 'role-' + me.role;
  $('#kantorName').textContent = me.kantor; document.title = me.kantor + ' — Kantor AI';
  $('#userBadge').textContent = `${me.user} · ${me.role}`;
  const mb = $('#modeBadge'); mb.className = 'chip ' + me.mode;
  mb.textContent = me.mode === 'ai' ? `AI · ${me.provider} · ${me.model} · ${Math.round(me.tokens / 1000)}k/${Math.round(me.limit / 1000)}k token` : 'MODE DEMO (tanpa AI)';
}
function applyBadges() {
  const d = state.dash; if (!d) return;
  const set = (tab, n, bad) => { const el = $(`#tabs [data-tab="${tab}"] .count`); el.textContent = n; el.classList.toggle('hide', !n); el.classList.toggle('bad', Boolean(bad)); };
  set('dokumen', d.dokumen.belum + d.dokumen.gagal, d.dokumen.gagal);
  set('keuangan', d.kas.draft + d.tagihan.terlambat, d.tagihan.terlambat);
  set('proyek', d.proyek.berisiko, d.proyek.bahaya);
  set('tugas', d.tugas.review + d.tugas.blocked + d.tugas.terlambat, d.tugas.terlambat);
}

/* ---------- Beranda ---------- */
async function refreshDashboard() {
  state.dash = await api('/api/dashboard');
  state.me = { ...state.me, ...(await api('/api/me')) }; applyMe(); applyBadges();
  if (state.tab === 'beranda') renderBeranda();
}
function stat(label, big, sub, tab, cls) {
  return h('button', { class: 'stat ' + (cls || ''), onclick: () => showTab(tab) }, h('div', { class: 'lbl' }, label), h('div', { class: 'big num' + (String(big).length > 9 ? ' long' : '') }, big), h('div', { class: 'sub' }, sub));
}
function renderBeranda() {
  const d = state.dash;
  const kas = d.kas, pending = d.dokumen.belum + kas.draft;
  const saldo = kas.masuk - kas.keluar;
  const tagihanAlert = d.tagihan.terlambat > 0;
  $('#stats').replaceChildren(
    stat('Kas ' + monthLabel(d.bulan), rp(saldo), `Masuk ${rp(kas.masuk)} · Keluar ${rp(kas.keluar)}${kas.draft ? ` · ${kas.draft} draft` : ''}`, 'laporan', saldo < 0 ? 'alert' : ''),
    stat('Tagihan terbuka', String(d.tagihan.jumlah), `Bayar ${rp(d.tagihan.bayar30)} · Terima ${rp(d.tagihan.tagih30)}${tagihanAlert ? ` · ${d.tagihan.terlambat} terlambat` : ''}`, 'keuangan', tagihanAlert ? 'alert' : d.tagihan.jumlah ? 'warn' : ''),
    stat('Dokumen', String(d.dokumen.total), `${d.dokumen.terverifikasi} OK · ${d.dokumen.belum} perlu cek${d.dokumen.gagal ? ' · ' + d.dokumen.gagal + ' gagal' : ''}`, 'dokumen', d.dokumen.gagal ? 'alert' : d.dokumen.belum ? 'warn' : ''),
    stat('Tugas', String(d.tugas.terbuka), d.tugas.terbuka ? `${d.tugas.review} dicek · ${d.tugas.blocked} blokir · ${d.tugas.terlambat} terlambat` : 'papan kosong', 'tugas', d.tugas.terlambat ? 'alert' : d.tugas.review + d.tugas.blocked ? 'warn' : ''),
    stat('Proyek', String(d.proyek.jumlah || 0), d.proyek.jumlah ? `${d.proyek.berisiko} berisiko${d.proyek.bahaya ? ' · ' + d.proyek.bahaya + ' bahaya' : ''}` : 'belum ada proyek', 'proyek', d.proyek.bahaya ? 'alert' : d.proyek.berisiko ? 'warn' : ''));
  renderVisual(d); renderAgentList(); loadRapat().catch(() => {}); Panel.muatPersetujuan(); Panel.muatBiaya();
  $('#onboarding').classList.toggle('hide', d.dokumen.total > 0 || kas.draft > 0);
  const md = $('#mendesak'); md.replaceChildren();
  if (!d.mendesak.length) md.append(h('div', { class: 'muted' }, 'Tidak ada yang jatuh tempo dalam 30 hari.'));
  for (const r of d.mendesak) md.append(h('div', { class: 'rem', role: 'button', tabindex: '0', onclick: () => showTab(r.kind === 'tagihan' ? 'keuangan' : r.kind === 'tugas' ? 'tugas' : 'dokumen') },
    h('div', {}, h('b', {}, r.label + (r.jumlah ? ' · ' + rp(r.jumlah) : '')), h('div', { class: 'muted' }, [r.judul, fmtDate(r.tanggal), r.status !== 'terverifikasi' && r.kind === 'dokumen' ? '⚠ belum diverifikasi' : ''].filter(Boolean).join(' · '))),
    h('div', { class: 'days ' + sisaClass(r.sisa_hari) }, sisaText(r.sisa_hari))));
  renderObrolan();
  const ak = $('#aktivitas'); ak.replaceChildren();
  if (!d.aktivitas.length) ak.append(h('div', { class: 'muted' }, 'Belum ada aktivitas.'));
  for (const l of d.aktivitas) {
    const t = new Date(l.t), time = (t.toDateString() === new Date().toDateString() ? '' : t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ') + t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    ak.append(h('div', { class: 'act' }, h('span', { class: 'num' }, time), h('span', {}, h('b', {}, l.user), ' ' + (ACTIONS[l.action] || l.action))));
  }
}
const feed = [];
const nameOf = (id) => (state.agents.find((a) => a.id === id) || {}).nama || id;
function renderObrolan() {
  const box = $('#obrolan'); box.replaceChildren();
  if (!feed.length) return box.append(h('div', { class: 'muted' }, 'Para agen belum mengobrol. Tunggu sebentar, atau unggah dokumen.'));
  for (const m of feed.slice(-10).reverse())
    box.append(h('div', { class: 'talk ' + m.tipe }, h('span', { class: 'who' }, nameOf(m.dari)), m.ke ? h('span', { class: 'arrow' }, ' → ') : null, m.ke ? h('span', { class: 'who' }, nameOf(m.ke)) : null, ': ', h('span', { class: 'txt' }, m.teks)));
}
const renderAgentList = () => Panel.renderAgen();

/* ---------- Tanya & Perintah (satu tab, dua mode) ---------- */
function setTanyaMode(mode, load = true) {
  tanyaMode = mode;
  for (const b of $$('#tanyaSeg button')) b.classList.toggle('on', b.dataset.mode === mode);
  $('#chatCard').classList.toggle('hide', mode !== 'tanya'); $('#agenBody').classList.toggle('hide', mode !== 'perintah');
  if (load && mode === 'perintah') loadAgen().catch((e) => toast(errText(e), 'bad'));
}
$('#tanyaSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-mode]'); if (b) setTanyaMode(b.dataset.mode); });

/* ---------- Tanya kantor ---------- */
const SUGGESTIONS = ['Tagihan apa yang jatuh tempo bulan ini?', 'Berapa pengeluaran bulan ini?', 'Kontrak mana yang segera berakhir?', 'Dokumen apa yang belum diverifikasi?'];
const SARAN_AGEN = ['Apa tugasmu dan apa yang sedang kamu kerjakan?', 'Ada masalah di bidangmu sekarang?', 'Ringkas kondisi bidangmu hari ini.'];
let askAgen = null; // agen yang ditanya; null = pertanyaan umum tentang kantor
function pilihAgen(a) { askAgen = a ? { id: a.id, nama: a.nama } : null; renderPilihAgen(); $('#q').placeholder = a ? `Tanya ${a.nama}…` : 'Tulis pertanyaan…'; }
function renderPilihAgen() {
  const tombol = (label, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: fn }, label);
  $('#agenPick').replaceChildren(tombol('Kantor (umum)', !askAgen, () => pilihAgen(null)), ...state.agents.map((a) => tombol(a.nama, askAgen && askAgen.id === a.id, () => pilihAgen(a))));
  $('#chips').replaceChildren(...(askAgen ? SARAN_AGEN : SUGGESTIONS).map((s) => h('button', { class: 'chip', type: 'button', onclick: () => ask(s) }, s)));
}
async function ask(q) {
  const box = $('#msgs'), target = askAgen; box.append(h('div', { class: 'm u' }, (target ? target.nama + ': ' : '') + q));
  const wait = h('div', { class: 'm a' }, target ? target.nama + ' sedang menjawab…' : 'Mencari…'); box.append(wait); box.scrollTop = box.scrollHeight;
  try {
    if (target) { const r = await api('/api/tanya-agen', { method: 'POST', body: { agen: target.id, pertanyaan: q } }); wait.replaceChildren(h('b', {}, r.agen.nama + ': '), r.jawaban); }
    else { const r = await api('/api/chat', { method: 'POST', body: { message: q } }); wait.replaceChildren(...(r.agen ? [h('b', {}, r.agen.nama + ': ')] : []), h('div', { class: 'md' }, Md.dom(r.answer, h))); }
  } catch (err) { wait.textContent = 'Gagal: ' + errText(err); }
  box.scrollTop = box.scrollHeight;
}
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#q').value.trim(); if (!q) return; $('#q').value = ''; ask(q); });
renderPilihAgen();

/* ---------- Pengaturan ---------- */
function renderPengaturan() {
  const me = state.me, box = $('#settingsBody'); box.replaceChildren();
  const nama = h('input', { value: me.kantor, maxlength: '80' }), kat = h('textarea', { value: me.kategori.join('\n'), rows: '8' });
  const barisKat = () => kat.value.split('\n').map((x) => x.trim()).filter(Boolean).join('|');
  const bid = h('select', { onchange: () => {
    const b = me.daftarBidang.find((x) => x.id === bid.value);
    if (b && (me.daftarBidang.some((x) => x.kategori.join('|') === barisKat()) || confirm('Ganti daftar kategori pengeluaran dengan bawaan bidang ini?'))) kat.value = b.kategori.join('\n');
  } }, me.daftarBidang.map((b) => h('option', { value: b.id, selected: b.id === me.bidang ? 'selected' : null }, b.nama)));
  const bhs = h('select', {}, [['id', 'Indonesia'], ['en', 'English']].map(([v, t]) => h('option', { value: v, selected: v === me.bahasa ? 'selected' : null }, t)));
  const save = h('button', { class: 'btn primary', onclick: async () => {
    save.disabled = true;
    try { await api('/api/settings', { method: 'PUT', body: { namaKantor: nama.value, bidang: bid.value, bahasa: bhs.value, kategori: kat.value.split('\n') } }); toast('Pengaturan tersimpan'); await refreshDashboard(); renderPengaturan(); }
    catch (e) { toast(errText(e), 'bad'); save.disabled = false; }
  } }, 'Simpan');
  const pct = Math.min(100, Math.round(me.tokens / me.limit * 100));
  const preview = h('pre', { class: 'digest hide' });
  box.append(
    h('div', { class: 'card' }, h('h3', {}, 'Kantor'), h('div', { class: 'fields' }, h('label', { class: 'f' }, 'Nama kantor (dipakai AI untuk menentukan uang masuk/keluar)', nama),
      h('label', { class: 'f' }, 'Bahasa tampilan dan jawaban agen (berlaku setelah server dijalankan ulang)', bhs),
      h('label', { class: 'f' }, 'Bidang usaha (agen dan pembaca dokumen memakai istilah dan prioritas bidang ini)', bid),
      h('label', { class: 'f' }, 'Kategori pengeluaran (satu per baris; "Lainnya" selalu ada)', kat)), save),
    h('div', { class: 'card' }, h('h3', {}, 'Penyedia AI'), h('div', { class: 'row' }, h('span', { class: 'chip ' + me.mode }, me.mode === 'ai' ? 'AI aktif' : 'Mode demo'), me.mode === 'ai' ? h('span', {}, `${me.provider} · ${me.model}`) : null),
      me.mode === 'ai' ? [h('div', { class: 'muted', style: 'margin-top:8px' }, `Token bulan ini: ${me.tokens.toLocaleString('id-ID')} dari ${me.limit.toLocaleString('id-ID')} (${pct}%)`), h('div', { class: 'meter', role: 'img', 'aria-label': `Pemakaian token ${pct}%` }, h('i', { style: `width:${pct}%` }))]
        : h('div', { class: 'muted' }, 'PDF dan foto belum dibaca sungguhan. Jalankan ulang lewat start.bat dan masukkan kunci API (Anthropic atau OpenAI).'),
      h('div', { class: 'muted', style: 'margin-top:8px' }, 'Pasang juga batas pengeluaran bulanan di dashboard penyedia AI.')),
    h('div', { class: 'card' }, h('h3', {}, 'Pikiran & obrolan agen'),
      h('div', { class: 'muted' }, `Agen berbicara dari kondisi nyata kantor (tagihan terlambat, dokumen belum diverifikasi, dan seterusnya) tiap ±${me.agentChatSeconds} detik selama ada yang membuka halaman. Ucapannya dibuat dari data, tanpa token.`),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'chip ' + (me.agentAi ? 'ok' : '') }, me.agentAi ? 'Dipoles AI' : 'Tanpa AI'),
        h('span', { class: 'muted' }, me.agentAi ? `Maks ${me.agentAiPerHour} kalimat per jam, ikut batas token bulanan.` : 'Untuk gaya bicara lebih hidup, jalankan dengan AGENT_AI=1 (opsional, memakai token).'))),
    h('div', { class: 'card' }, h('h3', {}, 'Notifikasi Telegram'), h('div', { class: 'row' }, h('span', { class: 'chip ' + (me.telegram ? 'ok' : 'warn') }, me.telegram ? 'Terhubung' : 'Belum diatur'),
      me.digestHour != null ? h('span', { class: 'muted' }, `Ringkasan otomatis tiap hari setelah jam ${me.digestHour}:00`) : null),
      me.telegram ? null : h('ol', { class: 'steps' }, h('li', {}, 'Di Telegram, chat @BotFather, kirim /newbot, ikuti langkahnya, simpan token.'), h('li', {}, 'Kirim satu pesan ke bot barumu. Buka api.telegram.org/bot<TOKEN>/getUpdates, catat angka "chat":{"id":…}.'),
        h('li', {}, 'Jalankan lewat start.bat dan isi token serta chat ID di sana. Jangan menempel token di chat atau file; jika sudah terlihat orang lain, buat ulang lewat @BotFather (/revoke).')),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: async () => { try { preview.textContent = (await api('/api/digest')).text; preview.classList.remove('hide'); } catch (e) { toast(errText(e), 'bad'); } } }, 'Pratinjau ringkasan'),
        h('button', { class: 'btn primary', disabled: me.telegram ? false : 'disabled', onclick: async () => { try { await api('/api/notify/digest', { method: 'POST' }); toast('Ringkasan terkirim ke Telegram'); } catch (e) { toast(errText(e), 'bad'); } } }, 'Kirim sekarang')), preview),
    h('div', { id: 'jadwalBox', class: 'stack' }),
    h('div', { class: 'card' }, h('h3', {}, 'Akses'), h('div', { class: 'muted' }, `Kamu masuk sebagai ${me.user} (${me.role}).`),
      h('ul', { class: 'steps' }, h('li', {}, 'admin — semua, termasuk hapus dan pengaturan.'), h('li', {}, 'staf — unggah, catat, verifikasi, lunasi.'), h('li', {}, 'pengamat — hanya melihat dan bertanya.')),
      h('div', { class: 'muted' }, 'Akun diatur saat server dijalankan, mis. bryan:sandi1|admin,keluarga:sandi2|pengamat (lewat start.bat → "Akun login").')),
    h('div', { id: 'sistemBox', class: 'stack' }),
    h('div', { class: 'card' }, h('h3', {}, 'Cadangan data'), h('div', { class: 'muted' }, 'Penjaga Sistem membuat backup otomatis ke data\\backup\\ (7 salinan terakhir). Untuk aman dari kerusakan komputer, salin juga folder data\\ secara rutin ke tempat lain. Kehilangan folder itu = kehilangan semuanya.')));
  loadSistem().catch((e) => toast(errText(e), 'bad'));
  loadJadwal().catch((e) => toast(errText(e), 'bad'));
}

/* ---------- realtime ---------- */
const editing = () => { const a = document.activeElement; return a && a.matches('input,textarea,select') && a.closest('#docs,#dlg,#tugasBody'); };
const refreshAll = debounce(() => {
  refreshDashboard().catch(() => {});
  if (editing()) return; // jangan hapus ketikan yang sedang berjalan
  if (state.tab === 'dokumen') loadDocs().catch(() => {});
  if (state.tab === 'keuangan') loadKeuangan().catch(() => {});
  if (state.tab === 'laporan') loadLaporan().catch(() => {});
  if (state.tab === 'proyek') loadProyek().catch(() => {});
  if (state.tab === 'tugas') loadTugas().catch(() => {});
  if (state.tab === 'pengaturan') loadSistem().catch(() => {});
}, 400);
function connect() {
  if (es) es.close();
  es = new EventSource('/api/events');
  es.addEventListener('agents', (ev) => { const baru = JSON.parse(ev.data), ganti = baru.length !== state.agents.length; state.agents = baru; Office.update(state.agents); renderAgentList(); if (ganti) renderPilihAgen(); });
  es.addEventListener('docs', refreshAll);
  es.addEventListener('keuangan', refreshAll);
  es.addEventListener('proyek', refreshAll);
  es.addEventListener('tugas', refreshAll);
  es.addEventListener('rapat', (ev) => { const d = JSON.parse(ev.data); if (d.fase === 'mulai') Office.rapatMulai(d.peserta); else { Office.rapatSelesai(); loadRapat().catch(() => {}); } });
  es.addEventListener('kesehatan', refreshAll);
  es.addEventListener('ngobrol', (ev) => { const m = JSON.parse(ev.data); feed.push(m); if (feed.length > 40) feed.shift(); Office.say(m); if (state.tab === 'beranda') renderObrolan(); });
}

async function start() {
  try { state.me = await api('/api/me'); } catch { return; }
  applyMe();
  if (!started) { started = true; Office.init(); Panel.bangun(); initDocs(); $('#dayNight').addEventListener('click', () => { const night = $('#dayNight').dataset.night !== '1'; $('#dayNight').dataset.night = night ? '1' : '0'; $('#dayNight').textContent = night ? '☀️ Siang' : '🌙 Malam'; Office.setNight(night); }); }
  feed.splice(0, feed.length, ...(await api('/api/obrolan').catch(() => []))); // riwayat saja, tidak dianimasikan
  connect();
  showTab(location.hash.slice(1));
  refreshDashboard().catch(() => {});
}
start();
