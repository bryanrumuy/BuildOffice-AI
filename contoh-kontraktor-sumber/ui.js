'use strict';
// Komponen HTML dokumen: kop surat, tabel, blok tanda tangan, pasal. Dicetak ke PDF A4.
const { rp, tgl } = require('./data');

const CSS = `@page{size:A4;margin:15mm 16mm 16mm}*{box-sizing:border-box}body{font:10pt/1.5 "Segoe UI",Arial,sans-serif;color:#1c2330;margin:0}
table{border-collapse:collapse;width:100%}.t{margin:8px 0;font-size:9pt}.t th{background:var(--w);color:#fff;text-align:left;padding:5px 7px;font-weight:600}.t td{padding:5px 7px;border-bottom:1px solid #d5d9df;vertical-align:top}
.t tr:nth-child(even) td{background:#f6f8fa}.r{text-align:right;white-space:nowrap}.c{text-align:center}.tot td{font-weight:700;border-top:2px solid var(--w);background:#eef1f5!important}
h1{font:700 14pt Georgia,serif;text-align:center;margin:6px 0 2px;letter-spacing:.3px}h2{font:700 11pt Arial;margin:14px 0 4px;color:var(--w);border-bottom:1px solid #cfd5dc;padding-bottom:2px}h3{font:700 10pt Arial;margin:10px 0 3px}
p{margin:4px 0;text-align:justify}.k{text-align:center;margin:0 0 10px}.pasal{font:10pt/1.5 Georgia,serif;margin:6px 0}.pasal b.j{display:block;text-align:center;margin-top:10px}
ol,ul{margin:3px 0 3px 20px;padding:0}li{margin:2px 0;text-align:justify}.kotak{border:1px solid #c5ccd6;padding:7px 10px;margin:8px 0;background:#fafbfc}.kuning{background:#fff8e1;border-color:#e0b84a}.merah{background:#fdecea;border-color:#d9534f}.hijau{background:#eaf5ec;border-color:#5aa469}
.meta td{padding:2px 6px;vertical-align:top;font-size:9.5pt}.meta td:first-child{width:150px;color:#44505f}.kecil{font-size:8.5pt;color:#5b6572}.ttd{display:flex;justify-content:space-around;margin-top:22px;text-align:center;font-size:9.5pt}.ttd div{width:44%}.ttd .sp{height:62px}.cap{font-size:8pt;color:#6b7684;margin-top:2px}
.bar{height:9px;background:#e3e7ec;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%}`;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (warna, body, extra = '') => `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>:root{--w:${warna}}${CSS}${extra}</style></head><body>${body}</body></html>`;
const kop = (p, ket = '') => `<div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid ${p.warna};padding-bottom:7px;margin-bottom:10px"><div style="width:46px;height:46px;border-radius:9px;background:${p.warna};color:#fff;display:flex;align-items:center;justify-content:center;font:700 16pt Georgia">${esc(p.nama.replace(/^(PT|CV|Dinas|Lembaga|BPJS)\s+/i, '').slice(0, 1))}</div><div style="flex:1"><div style="font:700 13pt Georgia,serif;color:${p.warna}">${esc(p.nama.toUpperCase())}</div><div class="kecil">${esc(p.alamat || '')}${p.telp ? ' &middot; Telp ' + esc(p.telp) : ''}${p.npwp ? ' &middot; NPWP ' + esc(p.npwp) : ''}</div></div>${ket ? `<div class="kecil" style="text-align:right">${ket}</div>` : ''}</div>`;
const tabel = (head, rows, { right = [], total = null, center = [] } = {}) => {
  const cls = (i) => (right.includes(i) ? ' class="r"' : center.includes(i) ? ' class="c"' : '');
  return `<table class="t"><thead><tr>${head.map((h, i) => `<th${cls(i)}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join('')}${total ? `<tr class="tot">${total.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>` : ''}</tbody></table>`;
};
const meta = (pairs) => `<table class="meta">${pairs.map(([k, v]) => `<tr><td>${k}</td><td>: ${v}</td></tr>`).join('')}</table>`;
const ttd = (kiri, kanan, kota = '') => `<div class="ttd"><div>${kota ? "&nbsp;<br>" : ""}${kiri.jabatan}<div class="sp"></div><b><u>${esc(kiri.nama)}</u></b><div class="cap">${esc(kiri.ket || '')}</div></div><div>${kota ? kota + '<br>' : ''}${kanan.jabatan}<div class="sp"></div><b><u>${esc(kanan.nama)}</u></b><div class="cap">${esc(kanan.ket || '')}</div></div></div>`;
const pasal = (no, judul, isi) => `<div class="pasal"><b class="j">Pasal ${no}<br>${esc(judul)}</b>${isi}</div>`;
const bar = (pct, warna) => `<div class="bar"><i style="width:${Math.min(100, pct)}%;background:${warna}"></i></div>`;
const kotak = (isi, kelas = '') => `<div class="kotak ${kelas}">${isi}</div>`;
const surat = (p, { nomor, lamp, hal, tanggal, kota, kepada, isi, penutup, ttdBlok }) => kop(p) + `<table class="meta" style="margin-bottom:8px"><tr><td>Nomor</td><td>: ${nomor}</td><td style="text-align:right;width:240px">${kota}, ${tgl(tanggal)}</td></tr><tr><td>Lampiran</td><td colspan="2">: ${lamp || '-'}</td></tr><tr><td>Perihal</td><td colspan="2">: <b>${hal}</b></td></tr></table><p style="margin-top:8px">Kepada Yth.<br>${kepada}</p><div style="margin-top:8px">${isi}</div>${penutup || ''}${ttdBlok || ''}`;

module.exports = { page, kop, tabel, meta, ttd, pasal, bar, kotak, surat, esc, rp, tgl };
