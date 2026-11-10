'use strict';
/** Tab Dokumen: unggah, daftar, edit field hasil baca AI, jadwal/termin, verifikasi. */
const JENIS = ['kontrak', 'invoice', 'nota', 'kwitansi', 'izin', 'surat', 'laporan', 'identitas', 'lainnya'];
const STATUS = { diproses: ['Diproses…', 'info'], belum_diverifikasi: ['Belum diverifikasi', 'warn'], terverifikasi: ['Terverifikasi', 'ok'], gagal: ['Gagal', 'bad'] };
const ARAH_UANG = [{ value: 'keluar', label: 'Kita bayar (uang keluar)' }, { value: 'masuk', label: 'Kita terima (uang masuk)' }, { value: 'lainnya', label: 'Tidak jelas / bukan uang' }];
const FILTERS = [['semua', 'Semua'], ['belum_diverifikasi', 'Perlu verifikasi'], ['terverifikasi', 'Terverifikasi'], ['gagal', 'Gagal']];
const docState = { docs: [], filter: 'semua', q: '', open: new Map() };

async function loadDocs() { docState.docs = await api('/api/docs'); renderDocs(); }

function renderDocs() {
  const { docs, filter, q } = docState;
  const bar = $('#docFilters'); bar.replaceChildren();
  for (const [key, label] of FILTERS) {
    const n = key === 'semua' ? docs.length : docs.filter((d) => d.status === key).length;
    bar.append(h('button', { class: filter === key ? 'on' : '', onclick: () => { docState.filter = key; renderDocs(); } }, `${label} (${n})`));
  }
  const needle = q.trim().toLowerCase();
  const shown = docs.filter((d) => (filter === 'semua' || d.status === filter) && (!needle || (d.originalName + ' ' + JSON.stringify(d.data || {})).toLowerCase().includes(needle)));
  const box = $('#docs'); box.replaceChildren();
  if (!shown.length) box.append(h('div', { class: 'empty' }, docs.length ? 'Tidak ada dokumen yang cocok.' : 'Belum ada dokumen. Unggah foto atau PDF di atas — agen akan membacanya.'));
  for (const d of shown) box.append(docCard(d));
}

function docCard(d) {
  const open = docState.open.has(d.id) ? docState.open.get(d.id) : d.status === 'belum_diverifikasi'; // belum diverifikasi = terbuka, kecuali ditutup pengguna
  const [stText, stCls] = STATUS[d.status] || [d.status, ''];
  const card = h('div', { class: 'card' });
  const toggle = () => { docState.open.set(d.id, !open); card.replaceWith(docCard(d)); };
  const meta = `${d.originalName} · diunggah ${d.uploadedBy} · ${new Date(d.uploadedAt).toLocaleString('id-ID')}` + (d.mode === 'demo' ? ' · hasil mode demo' : '') + (d.verifiedBy ? ` · diverifikasi ${d.verifiedBy}` : '');
  card.append(h('div', { class: 'doc-head', role: 'button', tabindex: '0', 'aria-expanded': String(open), onclick: toggle, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } },
    h('div', {}, h('b', {}, d.data ? d.data.judul : d.originalName), h('div', { class: 'muted' }, meta)),
    h('div', { class: 'row' }, d.data ? h('span', { class: 'chip info' }, d.data.jenis) : null, h('span', { class: 'chip ' + stCls }, stText))));
  if (d.status === 'gagal') card.append(h('div', { class: 'err' }, d.error || 'Gagal diproses'), h('button', { class: 'btn need-staf', onclick: async () => { await api('/api/docs/' + d.id + '/retry', { method: 'POST' }).catch((e) => toast(errText(e), 'bad')); loadDocs(); } }, 'Ulangi'));
  if (open && d.data) card.append(docBody(d));
  return card;
}

function docBody(d) {
  const inputs = {}, rows = d.data.jadwal.map((j) => ({ label: j.label, tanggal: j.tanggal, jumlah: j.jumlah == null ? '' : j.jumlah, arah: j.arah || '' }));
  const pr = d.data.proyek || {};
  const proyekIn = { nama: h('input', { value: pr.nama || '' }), periode: h('input', { type: 'month', value: pr.periode || '' }), progres: h('input', { value: pr.progres_fisik == null ? '' : pr.progres_fisik, inputmode: 'decimal' }),
    rencana: h('input', { value: pr.rencana_fisik == null ? '' : pr.rencana_fisik, inputmode: 'decimal' }), anggaran: h('input', { value: pr.anggaran == null ? '' : pr.anggaran, inputmode: 'decimal' }), realisasi: h('input', { value: pr.realisasi_biaya == null ? '' : pr.realisasi_biaya, inputmode: 'decimal' }) };
  const field = (key, label, el, wide) => { inputs[key] = el; return h('label', { class: 'f' + (wide ? ' wide' : '') }, label, el); };
  const txt = (key, type = 'text') => h('input', { type, value: d.data[key] == null ? '' : d.data[key] });
  const sel = (key, options) => h('select', { value: d.data[key] == null ? '' : d.data[key] }, options.map(optionOf));
  const kategori = [{ value: '', label: '— tanpa kategori —' }, ...state.me.kategori];
  const ringkasan = h('textarea', { value: d.data.ringkasan || '' });
  const poin = h('textarea', { value: d.data.poin.join('\n'), placeholder: 'Satu ketentuan per baris (denda, jaminan, masa berlaku…)' });
  const jadwalBox = h('div');
  const drawJadwal = () => {
    jadwalBox.replaceChildren(...rows.map((r, i) => h('div', { class: 'jadwal-row' },
      h('input', { value: r.label, placeholder: 'Keterangan (mis. Termin I)', 'aria-label': 'Keterangan', oninput: (e) => { r.label = e.target.value; } }),
      h('input', { type: 'date', value: r.tanggal, 'aria-label': 'Tanggal', oninput: (e) => { r.tanggal = e.target.value; } }),
      h('input', { value: r.jumlah, placeholder: 'Jumlah Rp (opsional)', inputmode: 'decimal', 'aria-label': 'Jumlah', oninput: (e) => { r.jumlah = e.target.value; } }),
      h('select', { value: r.arah, 'aria-label': 'Arah pembayaran', onchange: (e) => { r.arah = e.target.value; } }, [{ value: '', label: 'Arah: —' }, { value: 'bayar', label: 'Kita bayar' }, { value: 'tagih', label: 'Kita tagih' }].map(optionOf)),
      h('button', { class: 'btn small danger need-staf', type: 'button', 'aria-label': 'Hapus baris', onclick: () => { rows.splice(i, 1); drawJadwal(); } }, '✕'))));
  };
  drawJadwal();
  const save = async (ev) => {
    ev.target.disabled = true;
    const data = {}; for (const k in inputs) data[k] = inputs[k].value || null;
    data.ringkasan = ringkasan.value || null;
    data.poin = poin.value.split('\n').map((s) => s.trim()).filter(Boolean);
    data.jadwal = rows.filter((r) => r.tanggal).map((r) => ({ label: r.label, tanggal: r.tanggal, jumlah: r.jumlah === '' ? null : r.jumlah, arah: r.arah || null }));
    data.proyek = proyekIn.nama.value.trim() && proyekIn.periode.value ? { nama: proyekIn.nama.value, periode: proyekIn.periode.value, progres_fisik: proyekIn.progres.value, rencana_fisik: proyekIn.rencana.value, anggaran: proyekIn.anggaran.value, realisasi_biaya: proyekIn.realisasi.value } : null;
    try {
      const res = await api('/api/docs/' + d.id, { method: 'PATCH', body: { data } });
      toast('Tersimpan dan terverifikasi' + (res.proyek ? `. Proyek "${res.proyek.nama}" bulan ${res.proyek.bulan} dicatat.` : '') + (res.tagihanGandaDilewati ? ` ${res.tagihanGandaDilewati} tagihan ganda dilewati.` : ''));
    }
    catch (e) { toast(errText(e), 'bad'); }
    loadDocs();
  };
  const remove = async () => {
    if (!confirm(`Hapus "${d.data.judul}" beserta file aslinya? Catatan kas yang sudah terverifikasi tetap disimpan.`)) return;
    try { await api('/api/docs/' + d.id, { method: 'DELETE' }); toast('Dokumen dihapus'); } catch (e) { toast(errText(e), 'bad'); }
    loadDocs();
  };
  return h('div', { class: 'doc-body' },
    h('div', { class: 'fields' },
      field('jenis', 'Jenis', sel('jenis', JENIS)), field('judul', 'Judul', txt('judul')), field('nomor', 'Nomor', txt('nomor')),
      field('tanggal', 'Tanggal dokumen', txt('tanggal', 'date')), field('jatuh_tempo', 'Jatuh tempo / berakhir', txt('jatuh_tempo', 'date')),
      field('nilai', 'Nilai (teks)', txt('nilai')), field('nilai_angka', 'Nilai total (angka rupiah)', txt('nilai_angka')),
      field('arah_uang', 'Arah uang', sel('arah_uang', ARAH_UANG)), field('kategori', 'Kategori', sel('kategori', kategori)),
      field('pihak', 'Pihak terkait', txt('pihak'))),
    h('div', { class: 'fields' }, h('label', { class: 'f wide' }, 'Ringkasan', ringkasan), h('label', { class: 'f wide' }, 'Ketentuan penting', poin)),
    h('div', { class: 'muted' }, 'Jadwal bayar / tenggat (yang punya jumlah otomatis jadi tagihan di tab Keuangan)'),
    jadwalBox,
    h('button', { class: 'btn small need-staf', type: 'button', onclick: () => { rows.push({ label: '', tanggal: '', jumlah: '', arah: '' }); drawJadwal(); } }, '+ Tambah baris'),
    h('div', { class: 'muted', style: 'margin-top:12px' }, 'Data proyek (hanya untuk laporan progres proyek; kosongkan jika bukan). Setelah diverifikasi, ini masuk ke halaman Proyek.'),
    h('div', { class: 'fields' }, [['nama', 'Nama proyek'], ['periode', 'Bulan laporan'], ['progres', 'Progres fisik kumulatif (%)'], ['rencana', 'Rencana kumulatif (%)'], ['anggaran', 'Anggaran biaya (Rp)'], ['realisasi', 'Biaya terserap kumulatif (Rp)']].map(([k, l]) => h('label', { class: 'f' }, l, proyekIn[k]))),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn primary need-staf', onclick: save }, d.status === 'terverifikasi' ? 'Simpan perubahan' : 'Simpan & verifikasi'),
      h('a', { class: 'btn', href: '/api/docs/' + d.id + '/file' }, 'Unduh asli'),
      h('button', { class: 'btn danger need-admin', onclick: remove }, 'Hapus')));
}

async function sendFiles(files) {
  if (!files.length) return;
  $('#uerr').textContent = '';
  const fd = new FormData(); for (const f of files) fd.append('files', f);
  try {
    const r = await api('/api/docs', { method: 'POST', body: fd });
    if (r.rejected.length) $('#uerr').textContent = 'Ditolak (jenis file tidak didukung): ' + r.rejected.join(', ');
    else toast(`${r.docs.length} dokumen diterima — agen mulai bekerja`);
  } catch (e) { $('#uerr').textContent = errText(e); }
  loadDocs();
}

function initDocs() {
  const drop = $('#drop'), fileIn = $('#file');
  drop.addEventListener('click', () => fileIn.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { sendFiles([...fileIn.files]); fileIn.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); sendFiles([...e.dataTransfer.files]); });
  $('#docSearch').addEventListener('input', debounce((e) => { docState.q = e.target.value; renderDocs(); }, 200));
}
