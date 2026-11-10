'use strict';
/** Tab Proyek: deret waktu progres fisik & biaya per proyek, grafik rencana vs realisasi, dan peringatan otomatis. */
const LEVEL = { aman: ['Aman', 'ok'], waspada: ['Waspada', 'warn'], bahaya: ['Bahaya', 'bad'] };
const pctText = (n) => (n == null ? '—' : String(n).replace('.', ',') + '%');
const monthShort = (b) => { const [y, m] = b.split('-'); return MONTHS[+m - 1] + ' ' + y.slice(2); };

async function loadProyek() {
  const list = await api('/api/proyek');
  const box = $('#proyekBody'); box.replaceChildren();
  box.append(h('div', { class: 'row between' },
    h('div', { class: 'muted' }, 'Data masuk dari laporan proyek yang sudah diverifikasi, atau dicatat manual. Peringatan otomatis: terlambat ≥ 5 poin, biaya terserap ≥ 5 poin lebih cepat dari progres, atau keterlambatan makin besar.'),
    h('button', { class: 'btn primary need-staf', onclick: () => proyekForm() }, '+ Catat progres')));
  if (!list.length) return box.append(h('div', { class: 'empty' }, 'Belum ada proyek. Unggah laporan progres proyek di tab Dokumen lalu verifikasi, atau klik "+ Catat progres".'));
  for (const p of list) box.append(proyekCard(p));
}

function proyekForm(nama) {
  openForm({
    title: nama ? `Catat progres: ${nama}` : 'Catat progres proyek', submitLabel: 'Simpan', note: 'Jika bulan itu sudah ada, datanya diganti. Nama proyek yang sama (huruf besar/kecil diabaikan) digabung.',
    fields: [
      { key: 'nama', label: 'Nama proyek', wide: true, default: nama || '' },
      { key: 'bulan', label: 'Bulan laporan', type: 'month', default: thisMonth() },
      { key: 'progres', label: 'Progres fisik kumulatif (%)', inputmode: 'decimal', placeholder: 'mis. 41,5' },
      { key: 'rencana', label: 'Rencana kumulatif (%)', inputmode: 'decimal', placeholder: 'mis. 48,3' },
      { key: 'anggaran', label: 'Anggaran biaya (Rp)', inputmode: 'decimal', placeholder: 'mis. 5,4 miliar' },
      { key: 'realisasi', label: 'Biaya terserap kumulatif (Rp)', inputmode: 'decimal', placeholder: 'mis. 2310000000' },
    ],
    onSubmit: async (v) => { await api('/api/proyek', { method: 'POST', body: v }); toast('Progres tercatat'); loadProyek(); refreshDashboard(); },
  });
}

function chartFor(p) {
  const W = 640, H2 = 230, L = 42, R = 14, T = 14, B = 34, pw = W - L - R, ph = H2 - T - B, per = p.periode, n = per.length;
  // sumbu Y menyesuaikan rentang data (kelipatan 20 poin, 5 garis bantu) supaya selisih rencana vs realisasi terlihat
  const vals = per.flatMap((q) => [q.progres, q.rencana, q.serapan]).filter((v) => v != null);
  let lo = Math.max(0, Math.floor((Math.min(...vals) - 4) / 5) * 5), span = Math.max(20, Math.ceil((Math.max(...vals) + 4 - lo) / 20) * 20);
  let hi = Math.min(100, lo + span); if (hi === 100) lo = Math.max(0, hi - span); span = hi - lo;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + i * span / 4);
  const x = (i) => L + (n === 1 ? pw / 2 : pw * i / (n - 1)), y = (v) => T + ph * (1 - (v - lo) / span);
  const path = (get) => per.map((q, i) => ({ i, v: get(q) })).filter((o) => o.v != null).map((o, k) => `${k ? 'L' : 'M'}${x(o.i).toFixed(1)} ${y(o.v).toFixed(1)}`).join(' ');
  const dots = (get, cls) => per.map((q, i) => (get(q) == null ? null : svg('circle', { cx: x(i), cy: y(get(q)), r: 3.5, class: cls })));
  const grid = ticks.map((v) => [svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }), svg('text', { x: L - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, v + '%')]);
  const labels = per.map((q, i) => svg('text', { x: x(i), y: H2 - 12, class: 'axis', 'text-anchor': 'middle' }, monthShort(q.bulan)));
  const last = per[n - 1];
  return svg('svg', { viewBox: `0 0 ${W} ${H2}`, class: 'chart', role: 'img', 'aria-label': `Grafik ${p.nama}: bulan terakhir progres ${pctText(last.progres)}, rencana ${pctText(last.rencana)}, biaya terserap ${pctText(last.serapan)}` },
    grid, labels,
    svg('path', { d: path((q) => q.rencana), class: 'ln plan' }), svg('path', { d: path((q) => q.serapan), class: 'ln cost' }), svg('path', { d: path((q) => q.progres), class: 'ln real' }),
    dots((q) => q.rencana, 'plan'), dots((q) => q.serapan, 'cost'), dots((q) => q.progres, 'real'));
}

function proyekCard(p) {
  const [lvText, lvCls] = LEVEL[p.status.level], last = p.periode[p.periode.length - 1];
  const del = guard(async () => { if (confirm(`Hapus proyek "${p.nama}" beserta seluruh data bulanannya?`)) { await api('/api/proyek/' + p.id, { method: 'DELETE' }); toast('Proyek dihapus'); loadProyek(); refreshDashboard(); } });
  const rows = [...p.periode].reverse().map((q) => h('tr', {},
    td(monthShort(q.bulan)), tdR(pctText(q.rencana)), tdR(pctText(q.progres)),
    h('td', { class: 'r num' + (q.deviasi != null && q.deviasi < 0 ? ' neg' : '') }, q.deviasi == null ? '—' : (q.deviasi > 0 ? '+' : '') + String(q.deviasi).replace('.', ',') + ' poin'),
    tdR(q.anggaran ? rp(q.anggaran) : '—'), tdR(q.realisasi != null ? rp(q.realisasi) : '—'), tdR(pctText(q.serapan)),
    td(h('span', { class: 'muted' }, q.sumber === 'dokumen' ? '📎 laporan' : 'manual')),
    actionCell(h('button', { class: 'btn small danger need-admin', onclick: guard(async () => { if (confirm(`Hapus data ${monthShort(q.bulan)}?`)) { await api(`/api/proyek/${p.id}/periode/${q.bulan}`, { method: 'DELETE' }); loadProyek(); refreshDashboard(); } }) }, 'Hapus'))));
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('div', { class: 'row' }, h('b', { style: 'font-size:16px' }, p.nama), h('span', { class: 'chip ' + lvCls }, lvText), h('span', { class: 'muted' }, `data terakhir ${monthShort(last.bulan)} · progres ${pctText(last.progres)} dari rencana ${pctText(last.rencana)}`)),
      h('div', { class: 'row' }, h('button', { class: 'btn small need-staf', onclick: () => proyekForm(p.nama) }, '+ Bulan'), h('button', { class: 'btn small danger need-admin', onclick: del }, 'Hapus proyek'))),
    p.status.peringatan.length ? h('ul', { class: 'warns' }, p.status.peringatan.map((w) => h('li', { class: lvCls }, '⚠ ' + w))) : h('div', { class: 'muted', style: 'margin-top:6px' }, 'Tidak ada peringatan: progres sesuai rencana dan biaya sejalan.'),
    h('div', { class: 'legend' }, h('span', { class: 'lg plan' }, 'Rencana'), h('span', { class: 'lg real' }, 'Progres fisik'), h('span', { class: 'lg cost' }, 'Biaya terserap')),
    chartFor(p),
    h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Bulan'), h('th', { class: 'r' }, 'Rencana'), h('th', { class: 'r' }, 'Progres'), h('th', { class: 'r' }, 'Deviasi'), h('th', { class: 'r' }, 'Anggaran'), h('th', { class: 'r' }, 'Biaya terserap'), h('th', { class: 'r' }, 'Terserap'), h('th', {}, 'Sumber'), h('th', {}))), h('tbody', {}, ...rows))));
}
