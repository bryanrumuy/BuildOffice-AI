'use strict';
/** Tab Keuangan (tagihan & termin, buku kas) dan Laporan bulanan. */
const keu = { sub: 'tagihan', status: 'belum', bulan: thisMonth() };
const lap = { bulan: thisMonth() };
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const monthLabel = (m) => { const [y, mo] = m.split('-'); return BULAN[+mo - 1] + ' ' + y; };
const ARAH_TAGIHAN = [{ value: 'bayar', label: 'Kita bayar' }, { value: 'tagih', label: 'Kita tagih / terima' }, { value: 'lainnya', label: 'Belum jelas' }];
const ARAH_KAS = [{ value: 'keluar', label: 'Uang keluar' }, { value: 'masuk', label: 'Uang masuk' }];
const arahChip = (a) => h('span', { class: 'chip ' + (a === 'bayar' ? 'warn' : a === 'tagih' ? 'ok' : '') }, a === 'bayar' ? 'Bayar' : a === 'tagih' ? 'Tagih' : '?');
const kategoriOptions = (blank) => (blank ? [{ value: '', label: '— tanpa kategori —' }] : []).concat(state.me.kategori);
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(errText(e), 'bad'); } };
const monthPicker = (value, onChange) => h('input', { type: 'month', value, 'aria-label': 'Bulan', style: 'width:auto', onchange: (e) => { if (e.target.value) onChange(e.target.value); } });
const td = (...kids) => h('td', {}, ...kids);
const tdR = (...kids) => h('td', { class: 'r num' }, ...kids);
const actionCell = (...btns) => h('td', { class: 'r' }, h('div', { class: 'row', style: 'justify-content:flex-end;flex-wrap:nowrap' }, ...btns));

async function loadKeuangan() {
  $('#keuSeg').replaceChildren(...[['tagihan', 'Tagihan & termin'], ['kas', 'Buku kas']].map(([k, l]) =>
    h('button', { class: keu.sub === k ? 'on' : '', onclick: () => { keu.sub = k; loadKeuangan(); } }, l)));
  if (keu.sub === 'tagihan') { await renderTagihan(); await renderBerulang(); } else await renderKas();
}

/* ---------- Tagihan & tugas berulang ---------- */
const FREKUENSI_BERULANG = [{ value: 'bulanan', label: 'Tiap bulan' }, { value: 'mingguan', label: 'Tiap minggu' }, { value: 'tahunan', label: 'Tiap tahun' }];
const HARI_MINGGU = [['1', 'Senin'], ['2', 'Selasa'], ['3', 'Rabu'], ['4', 'Kamis'], ['5', 'Jumat'], ['6', 'Sabtu'], ['0', 'Minggu']].map(([value, label]) => ({ value, label }));
const berulangForm = () => openForm({
  title: 'Aturan berulang', submitLabel: 'Simpan aturan',
  note: 'Tagihan dibuat otomatis 14 hari sebelum jatuh tempo, tugas 3 hari sebelumnya. Cocok untuk sewa, listrik, pajak, asuransi, atau cek kas mingguan.',
  fields: [
    { key: 'jenis', label: 'Jenis', type: 'select', options: [{ value: 'tagihan', label: 'Tagihan' }, { value: 'tugas', label: 'Tugas' }] },
    { key: 'frekuensi', label: 'Berulang', type: 'select', options: FREKUENSI_BERULANG },
    { key: 'judul', label: 'Keterangan', wide: true, placeholder: 'mis. Listrik ruko' },
    { key: 'hariBulan', label: 'Tanggal (bulanan/tahunan, 1-31; 31 = akhir bulan)', type: 'number', default: '1' },
    { key: 'hariMinggu', label: 'Hari (mingguan)', type: 'select', options: HARI_MINGGU },
    { key: 'bulan', label: 'Bulan (tahunan, 1-12)', type: 'number', default: '1' },
    { key: 'mulai', label: 'Mulai', type: 'date', default: today() },
    { key: 'jumlah', label: 'Jumlah (Rp), untuk tagihan', inputmode: 'decimal', placeholder: 'mis. 750000' },
    { key: 'arah', label: 'Arah (tagihan)', type: 'select', options: ARAH_TAGIHAN.slice(0, 2) },
    { key: 'pihak', label: 'Pihak (tagihan)', wide: true },
  ],
  onSubmit: async (v) => { await api('/api/berulang', { method: 'POST', body: { ...v, hari: v.frekuensi === 'mingguan' ? v.hariMinggu : v.hariBulan } }); toast('Aturan berulang tersimpan'); loadKeuangan(); refreshDashboard(); },
});
async function renderBerulang() {
  const aturan = await api('/api/berulang'), box = $('#keuBody');
  const baris = aturan.map((a) => h('tr', { class: a.aktif ? '' : 'muted' },
    td(h('div', {}, a.judul), h('div', { class: 'muted' }, `${a.ringkas}${a.jenis === 'tugas' ? ' · tugas' : ''}`)), td(a.jenis === 'tagihan' ? arahChip(a.arah) : '—'), tdR(a.jenis === 'tagihan' ? rp(a.jumlah) : '—'),
    td(h('span', { class: 'chip ' + (a.aktif ? 'ok' : '') }, a.aktif ? 'Aktif' : 'Dimatikan')),
    actionCell(h('button', { class: 'btn small need-staf', onclick: guard(async () => { await api('/api/berulang/' + a.id, { method: 'PATCH', body: { aktif: !a.aktif } }); loadKeuangan(); }) }, a.aktif ? 'Matikan' : 'Aktifkan'),
      h('button', { class: 'btn small danger need-admin', onclick: guard(async () => { if (confirm(`Hapus aturan "${a.judul}"? Tagihan yang sudah dibuat tidak ikut terhapus.`)) { await api('/api/berulang/' + a.id, { method: 'DELETE' }); loadKeuangan(); } }) }, 'Hapus'))));
  box.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h3', {}, 'Tagihan & tugas berulang'), h('button', { class: 'btn primary need-staf', onclick: berulangForm }, '+ Aturan berulang')),
    aturan.length ? h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Aturan'), h('th', {}, 'Arah'), h('th', { class: 'r' }, 'Jumlah'), h('th', {}, 'Status'), h('th', {}))), h('tbody', {}, ...baris)))
      : h('div', { class: 'muted' }, 'Belum ada. Tambahkan aturan untuk tagihan rutin seperti sewa, listrik, dan pajak; agen mencatatnya sendiri setiap kali jatuh tempo mendekat.')));
}

/* ---------- Tagihan & termin ---------- */
function tagihanFields() {
  return [
    { key: 'label', label: 'Keterangan', wide: true, placeholder: 'mis. Termin II kontrak semen' },
    { key: 'tanggal', label: 'Jatuh tempo', type: 'date', default: today() },
    { key: 'jumlah', label: 'Jumlah (Rp)', inputmode: 'decimal', placeholder: 'mis. 4200000 atau 4,2 juta' },
    { key: 'arah', label: 'Arah', type: 'select', options: ARAH_TAGIHAN },
    { key: 'kategori', label: 'Kategori', type: 'select', options: kategoriOptions(true) },
    { key: 'pihak', label: 'Pihak', wide: true },
  ];
}
const tagihanForm = (t) => openForm({
  title: t ? 'Ubah tagihan' : 'Tambah tagihan', fields: tagihanFields(), values: t || {}, submitLabel: t ? 'Simpan' : 'Tambah',
  onSubmit: async (v) => { await api(t ? '/api/tagihan/' + t.id : '/api/tagihan', { method: t ? 'PATCH' : 'POST', body: v }); toast('Tagihan tersimpan'); loadKeuangan(); refreshDashboard(); },
});
function lunasForm(t) {
  if (t.arah === 'lainnya') return toast('Tentukan dulu arahnya (kita bayar / kita tagih) lewat tombol Ubah.', 'bad');
  openForm({
    title: (t.arah === 'bayar' ? 'Tandai sudah dibayar: ' : 'Tandai sudah diterima: ') + t.label, note: rp(t.jumlah) + ' akan dicatat otomatis di buku kas (terverifikasi).',
    fields: [{ key: 'tanggal', label: 'Tanggal ' + (t.arah === 'bayar' ? 'bayar' : 'terima'), type: 'date', default: today() }], submitLabel: 'Catat lunas',
    onSubmit: async (v) => { await api('/api/tagihan/' + t.id + '/lunas', { method: 'POST', body: v }); toast('Lunas dan tercatat di buku kas'); loadKeuangan(); refreshDashboard(); },
  });
}
async function renderTagihan() {
  const list = await api('/api/tagihan?status=' + keu.status);
  const box = $('#keuBody'); box.replaceChildren();
  const bayar = list.filter((t) => t.arah === 'bayar').reduce((s, t) => s + t.jumlah, 0), tagih = list.filter((t) => t.arah === 'tagih').reduce((s, t) => s + t.jumlah, 0);
  box.append(h('div', { class: 'row between' },
    h('div', { class: 'seg' }, [['belum', 'Belum lunas'], ['lunas', 'Lunas'], ['semua', 'Semua']].map(([k, l]) => h('button', { class: keu.status === k ? 'on' : '', onclick: () => { keu.status = k; loadKeuangan(); } }, l))),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '/api/tagihan.csv' }, 'Unduh CSV'), h('button', { class: 'btn primary need-staf', onclick: () => tagihanForm() }, '+ Tambah tagihan'))));
  box.append(h('div', { class: 'muted' }, `${list.length} tagihan · harus dibayar ${rp(bayar)} · akan diterima ${rp(tagih)}`));
  if (!list.length) return box.append(h('div', { class: 'empty' }, keu.status === 'belum' ? 'Tidak ada tagihan terbuka. Tagihan dibuat otomatis dari invoice dan jadwal termin kontrak, atau tambahkan manual.' : 'Belum ada data.'));
  const rows = list.map((t) => {
    const sisa = daysUntil(t.tanggal), open = t.status === 'belum';
    return h('tr', { class: open && sisa < 0 ? 'late' : '' },
      td(h('div', {}, fmtDate(t.tanggal)), open ? h('div', { class: 'days ' + sisaClass(sisa), style: 'text-align:left;font-size:12px;min-width:0' }, sisaText(sisa)) : h('div', { class: 'muted' }, 'Lunas ' + fmtDate(t.lunasAt))),
      td(h('div', {}, t.label), t.judulDok ? h('div', { class: 'muted' }, t.judulDok) : null), td(t.pihak || '—'), td(arahChip(t.arah)), tdR(rp(t.jumlah)),
      actionCell(open ? h('button', { class: 'btn small need-staf', onclick: () => lunasForm(t) }, 'Lunasi') : null, open ? h('button', { class: 'btn small need-staf', onclick: () => tagihanForm(t) }, 'Ubah') : null,
        h('button', { class: 'btn small danger need-admin', onclick: guard(async () => { if (confirm(`Hapus tagihan "${t.label}"?`)) { await api('/api/tagihan/' + t.id, { method: 'DELETE' }); loadKeuangan(); refreshDashboard(); } }) }, 'Hapus')));
  });
  box.append(h('div', { class: 'card tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Jatuh tempo', 'Keterangan', 'Pihak', 'Arah'].map((x) => h('th', {}, x)), h('th', { class: 'r' }, 'Jumlah'), h('th', {}))), h('tbody', {}, ...rows))));
}

/* ---------- Buku kas ---------- */
const kasFields = () => [
  { key: 'tanggal', label: 'Tanggal', type: 'date', default: today() },
  { key: 'arah', label: 'Jenis', type: 'select', options: ARAH_KAS },
  { key: 'uraian', label: 'Uraian', wide: true, placeholder: 'mis. Beli semen 40 sak' },
  { key: 'jumlah', label: 'Jumlah (Rp)', inputmode: 'decimal', placeholder: 'mis. 4200000 atau 4,2 juta' },
  { key: 'kategori', label: 'Kategori', type: 'select', options: kategoriOptions(false) },
  { key: 'pihak', label: 'Pihak', wide: true },
];
const kasForm = (k) => openForm({
  title: k ? 'Ubah transaksi' : 'Catat transaksi', fields: kasFields(), values: k || {}, submitLabel: 'Simpan',
  note: k && k.status === 'terverifikasi' ? 'Transaksi ini sudah terverifikasi; perubahan langsung berlaku di laporan.' : 'Transaksi baru berstatus draft sampai diverifikasi.',
  onSubmit: async (v) => { await api(k ? '/api/kas/' + k.id : '/api/kas', { method: k ? 'PATCH' : 'POST', body: v }); toast('Transaksi tersimpan'); loadKeuangan(); refreshDashboard(); },
});
async function renderKas() {
  const list = await api('/api/kas?bulan=' + keu.bulan);
  const box = $('#keuBody'); box.replaceChildren();
  const ok = list.filter((k) => k.status === 'terverifikasi'), sum = (arr, a) => arr.filter((k) => k.arah === a).reduce((s, k) => s + k.jumlah, 0);
  const draft = list.length - ok.length;
  box.append(h('div', { class: 'row between' },
    h('div', { class: 'row' }, monthPicker(keu.bulan, (m) => { keu.bulan = m; loadKeuangan(); }), h('span', { class: 'muted' }, `Masuk ${rp(sum(ok, 'masuk'))} · Keluar ${rp(sum(ok, 'keluar'))} (terverifikasi)`)),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '/api/kas.csv?bulan=' + keu.bulan }, 'Unduh CSV (Excel)'), h('button', { class: 'btn primary need-staf', onclick: () => kasForm() }, '+ Catat transaksi'))));
  if (draft) box.append(h('div', { class: 'muted' }, `${draft} transaksi masih draft — belum dihitung di laporan sampai diverifikasi.`));
  if (!list.length) return box.append(h('div', { class: 'empty' }, 'Belum ada transaksi bulan ini. Unggah nota di tab Dokumen, atau catat manual.'));
  const rows = list.map((k) => h('tr', {},
    td(fmtDate(k.tanggal)), td(h('div', {}, k.uraian), k.pihak ? h('div', { class: 'muted' }, k.pihak) : null, k.docId ? h('div', { class: 'muted' }, '📎 dari dokumen') : null), td(k.kategori),
    tdR(k.arah === 'masuk' ? h('span', { class: 'in' }, rp(k.jumlah)) : ''), tdR(k.arah === 'keluar' ? rp(k.jumlah) : ''),
    td(h('span', { class: 'chip ' + (k.status === 'terverifikasi' ? 'ok' : 'warn') }, k.status === 'terverifikasi' ? 'Terverifikasi' : 'Draft')),
    actionCell(k.status === 'draft' ? h('button', { class: 'btn small primary need-staf', onclick: guard(async () => { await api('/api/kas/' + k.id + '/verify', { method: 'POST' }); toast('Terverifikasi'); loadKeuangan(); refreshDashboard(); }) }, 'Verifikasi') : null,
      h('button', { class: 'btn small need-staf', onclick: () => kasForm(k) }, 'Ubah'),
      h('button', { class: 'btn small danger need-admin', onclick: guard(async () => { if (confirm(`Hapus transaksi "${k.uraian}"?`)) { await api('/api/kas/' + k.id, { method: 'DELETE' }); loadKeuangan(); refreshDashboard(); } }) }, 'Hapus'))));
  box.append(h('div', { class: 'card tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Tanggal', 'Uraian', 'Kategori'].map((x) => h('th', {}, x)), h('th', { class: 'r' }, 'Masuk'), h('th', { class: 'r' }, 'Keluar'), h('th', {}, 'Status'), h('th', {}))), h('tbody', {}, ...rows))));
}

/* ---------- Laporan bulanan ---------- */
async function loadLaporan() {
  const r = await api('/api/laporan?bulan=' + lap.bulan);
  const box = $('#laporanBody'); box.replaceChildren();
  const kv = (label, val, cls) => h('div', {}, h('span', { class: 'muted' }, label), h('b', { class: 'num ' + (cls || '') }, rp(val)));
  box.append(h('div', { class: 'row between no-print' },
    h('div', { class: 'row' }, monthPicker(lap.bulan, (m) => { lap.bulan = m; loadLaporan(); }), h('b', {}, 'Laporan ' + monthLabel(r.bulan))),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '/api/kas.csv?bulan=' + r.bulan }, 'Unduh CSV (Excel)'), h('button', { class: 'btn primary', onclick: () => window.print() }, 'Cetak / simpan PDF'))));
  box.append(h('div', { class: 'card' }, h('h3', {}, `${state.me.kantor} — ${monthLabel(r.bulan)}`),
    h('div', { class: 'kv' }, kv('Saldo awal', r.saldoAwal), kv('Uang masuk', r.masuk, 'in'), kv('Uang keluar', r.keluar), kv('Selisih bulan ini', r.selisih, r.selisih < 0 ? 'out' : 'in'), kv('Saldo akhir', r.saldoAkhir))));
  if (r.draft.jumlah) box.append(h('div', { class: 'card' }, h('b', { class: 'chip warn' }, 'Belum lengkap'), ` ${r.draft.jumlah} transaksi belum diverifikasi (masuk ${rp(r.draft.masuk)}, keluar ${rp(r.draft.keluar)}) belum dihitung di atas.`));
  const maxVal = Math.max(1, ...r.perKategori.map((c) => c.keluar + c.masuk));
  box.append(h('div', { class: 'card' }, h('h3', {}, 'Per kategori'), r.perKategori.length
    ? r.perKategori.map((c) => h('div', { style: 'margin:8px 0' }, h('div', { class: 'row between' }, h('span', {}, c.kategori), h('span', { class: 'num muted' }, `${c.masuk ? 'masuk ' + rp(c.masuk) + ' · ' : ''}keluar ${rp(c.keluar)}`)), h('div', { class: 'bar', role: 'img', 'aria-label': c.kategori }, h('i', { style: `width:${Math.round((c.keluar + c.masuk) / maxVal * 100)}%` }))))
    : h('div', { class: 'muted' }, 'Belum ada transaksi terverifikasi bulan ini.')));
  box.append(h('div', { class: 'card tbl-wrap' }, h('h3', {}, 'Tagihan jatuh tempo bulan ini'), r.tagihan.length
    ? h('table', {}, h('tbody', {}, ...r.tagihan.map((t) => h('tr', {}, td(fmtDate(t.tanggal)), td(t.label, t.judulDok ? h('div', { class: 'muted' }, t.judulDok) : null), td(arahChip(t.arah)), tdR(rp(t.jumlah))))))
    : h('div', { class: 'muted' }, 'Tidak ada.')));
  const ok = r.transaksi.filter((k) => k.status === 'terverifikasi');
  box.append(h('div', { class: 'card tbl-wrap' }, h('h3', {}, 'Rincian transaksi terverifikasi'), ok.length
    ? h('table', {}, h('tbody', {}, ...ok.map((k) => h('tr', {}, td(fmtDate(k.tanggal)), td(k.uraian), td(k.kategori), tdR(k.arah === 'masuk' ? rp(k.jumlah) : ''), tdR(k.arah === 'keluar' ? rp(k.jumlah) : '')))))
    : h('div', { class: 'muted' }, 'Tidak ada.')));
}
