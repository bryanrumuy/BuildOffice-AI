'use strict';
/** Menyusun isi dokumen (Markdown dari agen) menjadi HTML/PDF yang rapi. Word ada di berkasword.js. */
const Md = require('../public/md.js');

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tanggalPanjang = (d = new Date()) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;

/** Judul dokumen: "# Judul" pertama bila ada (lalu dibuang dari isi), kalau tidak pakai nama berkas. */
function pecah(judul, md) {
  const blocks = Md.parse(md);
  if (blocks[0] && blocks[0].t === 'h' && blocks[0].n === 1) return { judul: blocks[0].runs.map((r) => r.t).join('') || judul, blocks: blocks.slice(1) };
  return { judul, blocks };
}

/**
 * Gaya laporan resmi. Sumber konvensi: laporan keuangan ilustratif IFRS dari PwC (angka rata kanan, negatif dalam kurung, subtotal tebal,
 * satuan satu kali di bawah judul), kerangka pandoc "Eisvogel" (header berisi kantor+tanggal, footer berisi judul+halaman), prinsip
 * Tufte/ruang baca (lebar baris teks 65-75 huruf, tabel tanpa jeruji), dan tata sampul kertas krem dari kandidat laporan Canva.
 * Satu warna tinta; warna lain hanya bermakna (merah anggur = peringatan).
 */
const KOTAK = (isi, ekstra = '') => `font:7pt "Segoe UI",Calibri,sans-serif;color:#7a828c;${ekstra}${isi}`;
const CSS = `@page{size:A4;margin:25mm 20mm 25mm;
@top-left{content:var(--kantor);${KOTAK('letter-spacing:.22em;text-transform:uppercase;vertical-align:bottom;padding-bottom:5mm;')}}
@top-right{content:var(--tgl);${KOTAK('vertical-align:bottom;padding-bottom:5mm;')}}
@bottom-left{content:var(--kaki) "\\A Disusun otomatis oleh agen AI. Periksa angka dan tanggal sebelum dipakai.";white-space:pre;${KOTAK('line-height:1.55;vertical-align:top;padding-top:5mm;')}}
@bottom-right{content:"Halaman " counter(page) " dari " counter(pages);${KOTAK('vertical-align:top;padding-top:5mm;')}}}
@page sampul{margin:0;@top-left{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}
:root{--tinta:#16213a;--teks:#1f2630;--abu:#4b5563;--redup:#7a828c;--garis:#d6d9de;--merah:#8c2f39;--kertas:#f5f2ea}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:10pt/1.62 "Segoe UI",Calibri,Arial,sans-serif;color:var(--teks);margin:0;font-variant-numeric:tabular-nums;hyphens:manual}
h1,h2,.serif{font-family:Georgia,Cambria,"Times New Roman",serif;font-weight:400;color:var(--tinta)}
.sampul{page:sampul;width:210mm;height:297mm;padding:26mm 24mm 22mm 26mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page;background:var(--kertas)}
.s-kop{font-size:8.5pt;letter-spacing:.24em;text-transform:uppercase;color:var(--abu);padding-bottom:4mm;border-bottom:.3mm solid var(--tinta)}
.s-badan{margin-top:-30mm}
.sampul h1{font-size:34pt;line-height:1.12;margin:0 0 9mm;max-width:150mm;letter-spacing:-.01em}
.s-lead{font:italic 12.5pt/1.55 Georgia,Cambria,serif;color:var(--abu);max-width:132mm;margin:0;padding-top:6mm;border-top:.3mm solid #cfcabd}
.s-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:0 8mm;margin:0;border-top:.3mm solid var(--tinta);padding-top:4mm}
.s-meta div{font-size:9pt}.s-meta dt{font-size:7.5pt;letter-spacing:.16em;text-transform:uppercase;color:var(--redup);margin-bottom:1mm}.s-meta dd{margin:0;color:var(--teks)}
.kop{margin:0 0 9mm;padding-bottom:5mm;border-bottom:.3mm solid var(--tinta)}
.k-kantor{font-size:8pt;letter-spacing:.24em;text-transform:uppercase;color:var(--abu);margin-bottom:5mm}
.kop h1{font-size:25pt;line-height:1.15;margin:0 0 4mm;letter-spacing:-.01em}.k-meta{font-size:9pt;color:var(--abu)}
h2{font-size:15pt;line-height:1.25;margin:10mm 0 3.5mm;padding-top:3.2mm;border-top:.3mm solid var(--tinta);break-after:avoid}
.kop+main>h2:first-child{margin-top:0;border-top:0;padding-top:0}
h3{font:600 8.5pt "Segoe UI",Calibri,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--abu);margin:6mm 0 1.5mm;break-after:avoid}
h4{font-size:10pt;font-weight:600;color:var(--tinta);margin:4mm 0 1mm;break-after:avoid}
p,ul,ol,blockquote{max-width:142mm}
p{margin:2.2mm 0;orphans:3;widows:3}p:has(+h3),p:has(+table),p:has(+ul),p:has(+ol){break-after:avoid}strong{font-weight:600;color:var(--tinta)}
ul,ol{margin:2mm 0 3.5mm;padding-left:5.5mm}li{margin:.9mm 0;padding-left:.8mm;break-inside:avoid}li::marker{color:var(--redup)}ol li::marker{color:var(--abu);font-variant-numeric:tabular-nums}
li.l1{margin-left:5mm}li.l2{margin-left:10mm}
table{border-collapse:collapse;width:100%;margin:4mm 0 6mm;font-size:9.2pt}thead{display:table-header-group}tr{break-inside:avoid}
tbody tr:nth-child(-n+3):not(:last-child){break-after:avoid}tbody tr:nth-last-child(-n+2):not(:first-child){break-before:avoid}
th{text-align:left;font-weight:600;font-size:7.8pt;letter-spacing:.1em;text-transform:uppercase;color:var(--abu);padding:2.2mm 2.5mm 2mm;border-top:.5mm solid var(--tinta);border-bottom:.3mm solid var(--tinta)}
td{padding:2.1mm 2.5mm;border-bottom:.2mm solid var(--garis);vertical-align:top}tbody tr:last-child td{border-bottom:.3mm solid var(--tinta)}
th.r,td.r{text-align:right;white-space:nowrap}tr.jum td{font-weight:600;color:var(--tinta);border-top:.3mm solid var(--tinta)}td.neg{color:var(--merah);font-weight:600}
.kop+main>p:first-child{font:11.5pt/1.6 Georgia,Cambria,serif;color:var(--tinta);margin:0 0 2mm}
blockquote{margin:4.5mm 0;padding:.5mm 0 .5mm 5mm;border-left:.7mm solid var(--tinta);color:var(--abu);font:italic 10.5pt/1.6 Georgia,Cambria,serif;break-inside:avoid}
hr{border:0;border-top:.3mm solid var(--garis);margin:6mm 0}
pre,code{font-family:Consolas,monospace;font-size:8.8pt}code{background:#f1f2f4;padding:0 1mm}pre{background:#f6f7f8;padding:3mm;white-space:pre-wrap;border-left:.5mm solid var(--garis);break-inside:avoid}svg{break-inside:avoid}
@media print{.catatan{display:none}}.catatan{margin-top:11mm;padding-top:2.5mm;border-top:.3mm solid var(--garis);font-size:7.8pt;color:var(--redup)}`;

const kunciCss = (s) => String(s == null ? '' : s).replace(/[<>&"'\\\r\n]/g, '').slice(0, 60);
/** Variabel CSS untuk header/footer halaman cetak (nama kantor, tanggal, judul). */
const varHalaman = ({ kantor, judul, tanggal }) => `:root{--kantor:"${kunciCss(kantor || 'Kantor AI')}";--tgl:"${kunciCss(tanggal)}";--kaki:"${kunciCss(kantor || 'Kantor AI')}  ·  ${kunciCss(judul)}"}`;

/** HTML lengkap (siap dicetak jadi PDF). meta: { kantor, oleh, tanggal, sampul, status }. Dokumen panjang diberi halaman sampul. */
function htmlDari(judulNama, md, meta = {}) {
  const { judul, blocks } = pecah(judulNama, md);
  const panjang = blocks.length > 13 || Md.plain(md).length > 2200; // kira-kira lebih dari satu setengah halaman
  const pakaiSampul = meta.sampul == null ? panjang : meta.sampul;
  const tanggal = meta.tanggal || tanggalPanjang(), kantor = meta.kantor || '';
  const lead = blocks.find((b) => b.t === 'p' && b.lines.length === 1), leadTeks = lead && lead.lines[0].map((r) => r.t).join('').length <= 220 ? lead.lines[0].map((r) => r.t).join('') : '';
  const kop = pakaiSampul
    ? `<section class="sampul"><div class="s-kop">${Md.esc(kantor || 'Laporan')}</div><div class="s-badan"><h1>${Md.esc(judul)}</h1>${leadTeks ? `<p class="s-lead">${Md.esc(leadTeks)}</p>` : ''}</div><dl class="s-meta"><div><dt>Tanggal</dt><dd>${Md.esc(tanggal)}</dd></div><div><dt>Disusun oleh</dt><dd>${Md.esc(meta.oleh || 'Kantor AI')}</dd></div><div><dt>Status</dt><dd>${Md.esc(meta.status || 'Draf, perlu diperiksa')}</dd></div></dl></section>`
    : `<header class="kop">${kantor ? `<div class="k-kantor">${Md.esc(kantor)}</div>` : ''}<h1>${Md.esc(judul)}</h1><div class="k-meta">${Md.esc(tanggal)}${meta.oleh ? '  ·  Disusun oleh ' + Md.esc(meta.oleh) : ''}</div></header>`;
  const isi = pakaiSampul && leadTeks ? blocks.filter((b) => b !== lead) : blocks;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${Md.esc(judul)}</title><style>${varHalaman({ kantor, judul, tanggal })}${CSS}</style></head><body>
${kop}
<main>${Md.html(null, isi).replace(/<td>([^<]*\b(?:terlambat|bahaya|gagal|blokir|macet|ditolak)\b[^<]*)<\/td>/gi, '<td class="neg">$1</td>')}
<div class="catatan">Dokumen ini disusun otomatis oleh agen AI. Periksa angka dan tanggal sebelum dipakai.</div></main></body></html>`;
}

module.exports = { htmlDari, pecah, tanggalPanjang, CSS, varHalaman };
