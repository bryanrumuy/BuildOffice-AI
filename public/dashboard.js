'use strict';
/** Kartu visual di Beranda: tren kas 6 bulan, status Papan Tugas, progres proyek, dan kesehatan sistem. */
const TUGAS_WARNA = { todo: '#8da2bf', doing: '#5aa9ff', review: '#f2b84b', blocked: '#ee6b6b', done: '#43c17a' };
const TUGAS_LABEL = { todo: 'Akan dikerjakan', doing: 'Dikerjakan', review: 'Perlu dicek', blocked: 'Terblokir', done: 'Selesai' };
const LEVEL_WARNA = { aman: '#43c17a', waspada: '#f2b84b', bahaya: '#ee6b6b' };
const shortRp = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' M' : n >= 1e6 ? Math.round(n / 1e6) + ' jt' : n >= 1e3 ? Math.round(n / 1e3) + ' rb' : String(n));
const kartu = (judul, tab, ...isi) => h('div', { class: 'card viz', role: tab ? 'button' : null, tabindex: tab ? '0' : null, onclick: tab ? () => showTab(tab) : null }, h('h3', {}, judul), ...isi);

function kasChart(tren) {
  const max = Math.max(1, ...tren.flatMap((t) => [t.masuk, t.keluar])), W = 300, H = 120, base = 100, bw = 14, gap = W / tren.length;
  const bars = tren.flatMap((t, i) => {
    const x = i * gap + (gap - bw * 2 - 3) / 2, hm = Math.round(t.masuk / max * (base - 14)), hk = Math.round(t.keluar / max * (base - 14));
    return [svg('rect', { x, y: base - hm, width: bw, height: hm, rx: 2, fill: '#43c17a' }, svg('title', {}, `Masuk ${rp(t.masuk)}`)),
      svg('rect', { x: x + bw + 3, y: base - hk, width: bw, height: hk, rx: 2, fill: '#ee6b6b' }, svg('title', {}, `Keluar ${rp(t.keluar)}`)),
      svg('text', { x: x + bw + 1.5, y: 114, 'text-anchor': 'middle', fill: '#8da2bf', 'font-size': 10 }, MONTHS[+t.bulan.slice(5) - 1])];
  });
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Kas masuk dan keluar enam bulan terakhir', class: 'chart' }, svg('line', { x1: 0, x2: W, y1: base, y2: base, stroke: '#29425f' }), svg('text', { x: 0, y: 10, fill: '#8da2bf', 'font-size': 10 }, 'maks ' + shortRp(max)), bars);
}
function vizKas(d) {
  const ada = d.kasTren.some((t) => t.masuk || t.keluar), saldo = d.kas.masuk - d.kas.keluar;
  return kartu('Kas 6 bulan terakhir', 'laporan', ada ? kasChart(d.kasTren) : h('div', { class: 'muted' }, 'Belum ada transaksi terverifikasi. Verifikasi nota atau tagihan agar grafik terisi.'),
    h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#43c17a' }), 'Masuk'), h('span', {}, h('i', { style: 'background:#ee6b6b' }), 'Keluar'), h('b', { class: 'num' }, `Saldo bulan ini ${rp(saldo)}`)));
}
function vizTugas(d) {
  const st = d.tugas.status, total = d.tugas.total;
  return kartu('Papan tugas', 'tugas', total ? [
    h('div', { class: 'stackbar', role: 'img', 'aria-label': 'Jumlah tugas per status' }, Object.keys(TUGAS_WARNA).filter((k) => st[k]).map((k) => h('i', { style: `flex:${st[k]};background:${TUGAS_WARNA[k]}`, title: `${TUGAS_LABEL[k]}: ${st[k]}` }))),
    h('div', { class: 'legend wrap' }, Object.keys(TUGAS_WARNA).map((k) => h('span', {}, h('i', { style: 'background:' + TUGAS_WARNA[k] }), `${TUGAS_LABEL[k]} ${st[k]}`))),
    h('div', { class: 'muted' }, d.tugas.terlambat ? `${d.tugas.terlambat} tugas lewat tenggat.` : 'Tidak ada tugas yang terlambat.')]
    : h('div', { class: 'muted' }, 'Belum ada tugas. Beri instruksi ke Manajer Proyek di tab Tugas.'));
}
function vizProyek(d) {
  const l = d.proyek.daftar;
  return kartu('Proyek', 'proyek', l.length ? l.map((p) => h('div', { class: 'pbar' }, h('div', { class: 'row between' }, h('b', {}, clipText(p.nama, 34)), h('span', { class: 'num muted' }, `${p.progres}%${p.rencana != null ? ' dari rencana ' + p.rencana + '%' : ''}`)),
    h('div', { class: 'track', role: 'img', 'aria-label': `Progres ${p.progres}%` }, p.rencana != null ? h('u', { style: `left:${Math.min(100, p.rencana)}%` }) : null, h('i', { style: `width:${Math.min(100, p.progres)}%;background:${LEVEL_WARNA[p.level]}` }))))
    : h('div', { class: 'muted' }, 'Belum ada proyek dipantau. Unggah laporan progres proyek.'));
}
function vizSehat(d) {
  const teks = { ok: ['Sehat', 'ok'], peringatan: ['Perhatian', 'warn'], bahaya: ['Bahaya', 'bad'] }[d.sehat] || ['?', ''];
  return h('div', { class: 'sys-chip ' + teks[1], role: state.me.role === 'admin' ? 'button' : null, tabindex: state.me.role === 'admin' ? '0' : null, onclick: state.me.role === 'admin' ? () => showTab('pengaturan') : null },
    h('span', { class: 'dot ' + teks[1] }), h('span', {}, 'Sistem: ' + teks[0]));
}
function renderVisual(d) { $('#visual').replaceChildren(vizKas(d), vizTugas(d), vizProyek(d)); $('#sysHealth').replaceChildren(vizSehat(d)); }
