'use strict';
/**
 * Laporan berkala sebagai file: HTML mandiri (siap cetak) dan PDF (dirender oleh Microsoft Edge atau Chrome yang
 * sudah ada di komputer; jika tidak ada, HTML tetap bisa dicetak jadi PDF dari browser). Semua isi di-escape.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { CSS, varHalaman } = require('./berkasdoc');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tgl = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${+d} ${BULAN[m - 1].slice(0, 3)} ${y}`; };
const kapan = (n) => (n < 0 ? `lewat ${-n} hari` : n === 0 ? 'hari ini' : `${n} hari lagi`);
const PDF_TIMEOUT_MS = 40000;

function table(heads, rows, right = []) {
  if (!rows.length) return '<p class="muted">Tidak ada.</p>';
  return `<table><thead><tr>${heads.map((h, i) => `<th${right.includes(i) ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => { const kls = [right.includes(i) ? 'r' : '', /\b(lewat|terlambat|bahaya)\b/i.test(String(c)) ? 'neg' : ''].filter(Boolean).join(' '); return `<td${kls ? ` class="${kls}"` : ''}>${esc(c)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
/** Grafik garis kecil (SVG) rencana vs progres untuk satu proyek. */
function chart(p) {
  const per = p.periode; if (per.length < 2) return '';
  const W = 520, H = 120, L = 30, R = 8, T = 8, B = 20, n = per.length, vals = per.flatMap((q) => [q.progres, q.rencana]).filter((v) => v != null);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 4) / 5) * 5), hi = Math.min(100, Math.max(lo + 20, Math.ceil((Math.max(...vals) + 4) / 5) * 5)), x = (i) => L + (W - L - R) * i / (n - 1), y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const path = (get, dash) => { const pts = per.map((q, i) => (get(q) == null ? null : `${x(i).toFixed(1)},${y(get(q)).toFixed(1)}`)).filter(Boolean); return pts.length > 1 ? `<polyline fill="none" stroke="${dash ? '#7a828c' : '#16213a'}" stroke-width="${dash ? 1.5 : 2.2}" ${dash ? 'stroke-dasharray="5 3"' : ''} points="${pts.join(' ')}"/>` : ''; };
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Grafik progres ${esc(p.nama)}"><line x1="${L}" x2="${W - R}" y1="${y(lo)}" y2="${y(lo)}" stroke="#d6d9de"/><text x="2" y="${y(lo) + 4}" font-size="9" fill="#7a828c">${lo}%</text><text x="2" y="${y(hi) + 4}" font-size="9" fill="#7a828c">${hi}%</text>${path((q) => q.rencana, true)}${path((q) => q.progres, false)}${per.map((q, i) => `<text x="${x(i)}" y="${H - 6}" font-size="9" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" fill="#7a828c">${esc(q.bulan)}</text>`).join('')}</svg><p class="muted">Garis putus-putus: rencana · garis tebal: progres fisik</p>`;
}

/** data: { kantor, judul, dibuat, periodeTeks, kas:{masuk,keluar,draft}, tagihan:[{tanggal,label,pihak,arah,jumlah,sisa}], proyek:[...], tugas:{...,terlambat:[],review:[]}, dokumen:{baru,belum,gagal} } */
const LEVEL = { bahaya: 'Bahaya', waspada: 'Waspada', aman: 'Aman' };
const CSS_LAPORAN = `.kpi{display:grid;grid-template-columns:repeat(4,1fr);margin:3mm 0 4mm;border-top:.5mm solid var(--tinta);border-bottom:.3mm solid var(--tinta)}
.kpi div{padding:3mm 3mm 3mm 0;border-right:.2mm solid var(--garis);margin-right:3mm}.kpi div:last-child{border-right:0;margin-right:0}
.kpi span{display:block;font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;color:var(--abu)}.kpi b{display:block;margin-top:1mm;font:400 15pt Georgia,Cambria,serif;color:var(--tinta);white-space:nowrap}.kpi b.neg{color:var(--merah)}.kpi div:first-child b{font-size:19pt}
.muted{color:var(--redup);font-size:8.5pt}.lvl{margin-left:3mm;font-weight:600;color:var(--abu)}.lvl.bahaya{color:var(--merah)}svg{display:block;margin:2mm 0 1mm;max-width:118mm}.proyek{break-inside:avoid}`;
function buildHtml(d) {
  const t = d.tugas || {}, k = d.kas || { masuk: 0, keluar: 0, draft: 0 }, dok = d.dokumen || {}, terlambat = (t.terlambat || []).length;
  const proyekHtml = (d.proyek || []).map((p) => {
    const last = p.periode[p.periode.length - 1], lv = String(p.status.level);
    return `<section class="proyek"><h3>${esc(p.nama)}<span class="lvl ${esc(lv)}">${esc(LEVEL[lv] || lv)}</span></h3><p>Bulan terakhir ${esc(last.bulan)}: progres ${last.progres}% dari rencana ${last.rencana == null ? '—' : last.rencana + '%'}${last.serapan != null ? `, biaya terserap ${last.serapan}%` : ''}.</p>${p.status.peringatan.length ? `<ul>${p.status.peringatan.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}${chart(p)}</section>`;
  }).join('') || '<p class="muted">Tidak ada proyek yang dipantau.</p>';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(d.judul)}</title><style>${varHalaman({ kantor: d.kantor, judul: d.judul, tanggal: d.periodeTeks })}${CSS}${CSS_LAPORAN}</style></head><body>
<header class="kop"><div class="k-kantor">${esc(d.kantor)}</div><h1>${esc(d.judul)}</h1><div class="k-meta">${esc(d.periodeTeks)}  ·  Dibuat ${esc(d.dibuat)} oleh agen Pelapor</div></header>
<main><h2>Ringkasan</h2><div class="kpi"><div><span>Uang masuk</span><b>${rp(k.masuk)}</b></div><div><span>Uang keluar</span><b>${rp(k.keluar)}</b></div><div><span>Tugas terlambat</span><b${terlambat ? ' class="neg"' : ''}>${terlambat}</b></div><div><span>Dokumen belum diverifikasi</span><b>${dok.belum || 0}</b></div></div>
<p class="muted">Angka kas hanya yang sudah diverifikasi.${k.draft ? ` ${k.draft} transaksi masih draft dan belum dihitung.` : ''}</p>
<h2>Tagihan dan pembayaran terdekat</h2>${table(['Jatuh tempo', 'Keterangan', 'Pihak', 'Arah', 'Jumlah'], (d.tagihan || []).map((x) => [`${tgl(x.tanggal)} (${kapan(x.sisa)})`, x.label, x.pihak || '—', x.arah === 'tagih' ? 'Kita tagih' : x.arah === 'bayar' ? 'Kita bayar' : '?', rp(x.jumlah)]), [4])}
<h2>Proyek</h2>${proyekHtml}
<h2>Tugas</h2><p>Terbuka ${t.terbuka || 0}  ·  menunggu dicek ${t.review || 0}  ·  terblokir ${t.blocked || 0}  ·  selesai pekan ini ${(t.selesaiPekanIni || []).length}.</p>
${table(['Tugas terlambat', 'Penanggung jawab', 'Tenggat'], (t.terlambat || []).map((x) => [x.judul, x.pemilik, `${tgl(x.tenggat)} (${kapan(x.sisa)})`]))}
<h2>Dokumen</h2><p>${dok.baru || 0} dokumen baru pekan ini  ·  ${dok.belum || 0} belum diverifikasi  ·  ${dok.gagal || 0} gagal dibaca.</p>
<div class="catatan">Dokumen ini disusun otomatis oleh agen AI. Periksa angka dan tanggal sebelum dipakai.</div></main></body></html>`;
}

function browserPath() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) return process.env.BROWSER_PATH;
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const rel = ['Microsoft\\Edge\\Application\\msedge.exe', 'Google\\Chrome\\Application\\chrome.exe'];
  for (const base of pf) for (const r of rel) { const p = path.join(base, r); if (fs.existsSync(p)) return p; }
  return null;
}
/** HTML -> Buffer PDF, atau null bila tidak ada Edge/Chrome atau gagal. */
async function toPdf(html) {
  const exe = browserPath();
  if (!exe) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-pdf-'));
  const src = path.join(dir, 'laporan.html'), out = path.join(dir, 'laporan.pdf');
  try {
    fs.writeFileSync(src, html, 'utf8');
    await new Promise((resolve, reject) => execFile(exe, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(dir, 'profil')}`, '--no-pdf-header-footer', `--print-to-pdf=${out}`, 'file:///' + src.replace(/\\/g, '/')], { timeout: PDF_TIMEOUT_MS, windowsHide: true }, (e) => (e ? reject(e) : resolve())));
    return fs.existsSync(out) ? fs.readFileSync(out) : null;
  } catch { return null; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

module.exports = { buildHtml, toPdf, browserPath, esc };
