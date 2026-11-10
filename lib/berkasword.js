'use strict';
/**
 * Word (docx) bergaya laporan resmi, memakai pustaka `docx` (sama seperti skill docx publik anthropics/skills): gaya judul sungguhan
 * (Heading 1-4, muncul di Navigasi Word), daftar bernomor asli, tabel bergaris tipis dengan kepala berulang, header kantor,
 * footer "Halaman X dari Y", dan halaman sampul untuk dokumen panjang. Gayanya sama dengan PDF (berkasdoc.js): judul serif,
 * satu warna tinta, tanpa bentuk dekoratif; warna lain hanya bermakna (merah = peringatan).
 */
const D = require('docx');
const Md = require('../public/md.js');
const { pecah, tanggalPanjang } = require('./berkasdoc');

const C = { tinta: '16213A', teks: '1F2630', abu: '4B5563', redup: '7A828C', garis: 'D6D9DE', merah: '8C2F39' };
const FONT = 'Calibri', SERIF = 'Georgia', MONO = 'Consolas';
const PAGE_W = 11906, MARGIN_X = 1247, ISI_W = PAGE_W - MARGIN_X * 2; // A4 dalam twip
const SALAH = /\b(terlambat|bahaya|gagal|blokir|macet|ditolak)\b/i;
const polos = { style: D.BorderStyle.NONE, size: 0, color: 'auto' };
const garis = (warna = C.garis, size = 4, space) => ({ style: D.BorderStyle.SINGLE, size, color: warna, space });

const runDari = (r, o = {}) => new D.TextRun({
  text: r.t, bold: r.b || o.bold, italics: r.i || o.italics, font: r.c ? MONO : o.font, size: o.size, color: o.color, allCaps: o.allCaps, characterSpacing: o.spasi,
  shading: r.c ? { type: D.ShadingType.CLEAR, fill: 'EEF0F2', color: 'auto' } : undefined,
});
const para = (runs, o = {}) => new D.Paragraph({
  children: runs.map((r) => runDari(r, o)), alignment: o.align, keepNext: o.keepNext, keepLines: o.keepLines, indent: o.indent, numbering: o.numbering,
  spacing: { before: o.before || 0, after: o.after == null ? 100 : o.after, line: o.line },
  shading: o.fill ? { type: D.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, border: o.border,
});
const teks = (t, o = {}) => para([{ t }], o);

function tabel(b) {
  const n = b.head.length, panjang = (rs) => rs.map((r) => r.t).join('').length, polosTeks = (rs) => rs.map((r) => r.t).join('').trim();
  const bobot = b.head.map((h, k) => Math.min(40, Math.max(6, panjang(h), ...b.rows.map((r) => panjang(r[k] || [])))));
  const total = bobot.reduce((a, c) => a + c, 0), lebar = bobot.map((w) => Math.max(900, Math.floor(ISI_W * w / total)));
  lebar[lebar.length - 1] += ISI_W - lebar.reduce((a, c) => a + c, 0);
  const num = b.head.map((_, k) => b.rows.length > 0 && b.rows.every((r) => Md.angka(r[k] || []) || !polosTeks(r[k] || [])));
  const kanan = D.AlignmentType.RIGHT, nol = { top: polos, bottom: polos, left: polos, right: polos };
  const sel = (rs, k, jenis, akhir, jumlahBaris) => {
    const kepala = jenis === 'kepala', salah = !kepala && SALAH.test(polosTeks(rs));
    return new D.TableCell({
      width: { size: lebar[k], type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, margins: { top: 80, bottom: 80, left: 100, right: 100 },
      borders: { ...nol, top: kepala ? garis(C.tinta, 8) : jumlahBaris ? garis(C.tinta, 4) : polos, bottom: kepala ? garis(C.tinta, 4) : akhir ? garis(C.tinta, 4) : garis(C.garis, 2) },
      children: [para(rs.length ? rs : [{ t: '' }], { size: kepala ? 15 : 19, bold: kepala || jumlahBaris || salah, allCaps: kepala, spasi: kepala ? 24 : undefined, color: kepala ? C.abu : salah ? C.merah : jumlahBaris ? C.tinta : C.teks, after: 0, align: num[k] ? kanan : undefined })],
    });
  };
  const baris = [new D.TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, k) => sel(h, k, 'kepala')) }),
    ...b.rows.map((r, i) => new D.TableRow({ cantSplit: true, children: Array.from({ length: n }, (_, k) => sel(r[k] || [], k, 'isi', i === b.rows.length - 1, /^total\b/i.test(polosTeks(r[0] || [])))) }))];
  return [new D.Table({ width: { size: ISI_W, type: D.WidthType.DXA }, columnWidths: lebar, borders: { ...nol, insideHorizontal: polos, insideVertical: polos }, rows: baris }), teks('', { after: 120 })];
}

function blok(b, nomor, lead) {
  switch (b.t) {
    case 'h': return [new D.Paragraph({ heading: [null, D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][b.n], children: b.runs.map((r) => runDari(r)) })];
    case 'p': return b.lines.map((l) => para(l, lead ? { font: SERIF, size: 23, color: C.tinta, after: 160, line: 330 } : {}));
    case 'quote': return b.lines.map((l) => para(l, { font: SERIF, italics: true, size: 21, color: C.abu, indent: { left: 300 }, border: { left: garis(C.tinta, 12, 10) }, after: 60 }));
    case 'ul': return b.items.map((x) => para(x.runs, { numbering: { reference: 'poin', level: x.level }, after: 50 }));
    case 'ol': { const inst = nomor.n++; return b.items.map((x) => para(x.runs, { numbering: { reference: 'angka', level: x.level, instance: inst }, after: 50 })); }
    case 'table': return tabel(b);
    case 'hr': return [para([{ t: '' }], { border: { bottom: garis(C.garis, 6) }, after: 160 })];
    case 'code': return b.text.split('\n').map((l) => para([{ t: l || ' ', c: true }], { fill: 'F6F7F8', after: 0, size: 18, line: 260 }));
    default: return [];
  }
}

const gayaJudul = (id, nama, run, before, after, extra = {}) => ({ id, name: nama, basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { color: C.tinta, ...run }, paragraph: { spacing: { before, after }, keepNext: true, keepLines: true, ...extra } });
const bullets = ['•', '–', '◦'], tingkat = (fmt, teksFn) => [0, 1, 2].map((l) => ({ level: l, format: fmt, text: teksFn(l), alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 400 + l * 360, hanging: 280 } } } }));
const kecil = (t, o = {}) => teks(t, { size: 16, color: C.abu, allCaps: true, spasi: 50, ...o });

/** Markdown agen -> Buffer docx. meta: { kantor, oleh, tanggal, sampul, status }. */
async function docxBuffer(judulNama, md, meta = {}) {
  const { judul, blocks } = pecah(judulNama, md);
  const panjang = blocks.length > 13 || Md.plain(md).length > 2200;
  const pakaiSampul = meta.sampul == null ? panjang : meta.sampul;
  const tanggal = meta.tanggal || tanggalPanjang(), kantor = meta.kantor || '';
  const lead = blocks.find((b) => b.t === 'p' && b.lines.length === 1);
  const leadTeks = lead && lead.lines[0].map((r) => r.t).join('').length <= 220 ? lead.lines[0].map((r) => r.t).join('') : '';
  const isi = pakaiSampul && leadTeks ? blocks.filter((b) => b !== lead) : blocks;
  const nomor = { n: 1 }, tinta = garis(C.tinta, 6, 6), tabKanan = [{ type: D.TabStopType.RIGHT, position: ISI_W }];
  const halaman = { size: { width: PAGE_W, height: 16838 }, margin: { top: 1250, right: MARGIN_X, bottom: 1134, left: MARGIN_X, header: 560, footer: 520 } };

  const meta3 = [['Tanggal', tanggal], ['Disusun oleh', meta.oleh || 'Kantor AI'], ['Status', meta.status || 'Draf, perlu diperiksa']];
  const sel3 = ([k, v]) => new D.TableCell({ width: { size: Math.floor(ISI_W / 3), type: D.WidthType.DXA }, margins: { top: 120, bottom: 0, left: 0, right: 160 }, borders: { top: garis(C.tinta, 6), bottom: polos, left: polos, right: polos }, children: [kecil(k, { size: 14, color: C.redup, after: 40 }), teks(v, { size: 19, after: 0 })] });
  const sampul = pakaiSampul ? {
    properties: { type: D.SectionType.NEXT_PAGE, page: halaman },
    children: [
      kecil(kantor || 'Laporan', { border: { bottom: garis(C.tinta, 6, 8) }, after: 0 }),
      teks(judul, { font: SERIF, size: 68, color: C.tinta, before: 3600, after: 360, line: 780 }),
      ...(leadTeks ? [teks(leadTeks, { font: SERIF, italics: true, size: 25, color: C.abu, before: 200, after: 0, line: 360, border: { top: garis(C.garis, 4, 12) } })] : []),
      teks('', { before: leadTeks ? 3600 : 5200, after: 0 }),
      new D.Table({ width: { size: ISI_W, type: D.WidthType.DXA }, columnWidths: [Math.floor(ISI_W / 3), Math.floor(ISI_W / 3), ISI_W - 2 * Math.floor(ISI_W / 3)], borders: { top: polos, bottom: polos, left: polos, right: polos, insideHorizontal: polos, insideVertical: polos }, rows: [new D.TableRow({ children: meta3.map(sel3) })] }),
    ],
  } : null;

  const kop = pakaiSampul ? [] : [
    ...(kantor ? [kecil(kantor, { after: 100 })] : []),
    teks(judul, { font: SERIF, size: 52, color: C.tinta, after: 120, line: 600 }),
    teks(tanggal + (meta.oleh ? '   ·   Disusun oleh ' + meta.oleh : ''), { size: 18, color: C.abu, after: 280, border: { bottom: garis(C.tinta, 6, 8) } }),
  ];

  const garisBawah = garis(C.garis, 6);
  const badan = {
    properties: { type: D.SectionType.NEXT_PAGE, page: halaman },
    headers: { default: new D.Header({ children: [new D.Paragraph({ tabStops: tabKanan, border: { bottom: garisBawah }, spacing: { after: 0 }, children: [
      new D.TextRun({ text: kantor || 'Kantor AI', size: 15, color: C.redup, allCaps: true, characterSpacing: 40 }),
      new D.TextRun({ text: '\t' + tanggal, size: 15, color: C.redup }),
    ] })] }) },
    footers: { default: new D.Footer({ children: [new D.Paragraph({ tabStops: tabKanan, border: { top: garisBawah }, spacing: { before: 60 }, children: [
      new D.TextRun({ text: judul.slice(0, 70), size: 15, color: C.redup }),
      new D.TextRun({ children: ['\tHalaman ', D.PageNumber.CURRENT, ' dari ', D.PageNumber.TOTAL_PAGES], size: 15, color: C.redup }),
    ] })] }) },
    children: [...kop, ...isi.flatMap((b, i) => blok(b, nomor, !pakaiSampul && i === 0 && b.t === 'p' && b.lines.length === 1)), teks('Dokumen ini disusun otomatis oleh agen AI. Periksa angka dan tanggal sebelum dipakai.', { size: 15, color: C.redup, before: 320, border: { top: garisBawah } })],
  };

  const dok = new D.Document({
    creator: meta.oleh || 'Kantor AI', title: judul, description: kantor ? `${kantor} — ${judul}` : judul,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: C.teks }, paragraph: { spacing: { line: 300, after: 100 } } } },
      paragraphStyles: [
        gayaJudul('Heading1', 'Heading 1', { font: SERIF, size: 40 }, 360, 160, { outlineLevel: 0 }),
        gayaJudul('Heading2', 'Heading 2', { font: SERIF, size: 30 }, 420, 140, { outlineLevel: 1, border: { top: tinta } }),
        gayaJudul('Heading3', 'Heading 3', { font: FONT, size: 17, bold: true, allCaps: true, characterSpacing: 40, color: C.abu }, 300, 80, { outlineLevel: 2 }),
        gayaJudul('Heading4', 'Heading 4', { font: FONT, size: 21, bold: true }, 220, 60, { outlineLevel: 3 }),
      ],
    },
    numbering: { config: [
      { reference: 'poin', levels: tingkat(D.LevelFormat.BULLET, (l) => bullets[l]) },
      { reference: 'angka', levels: tingkat(D.LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
    ] },
    sections: [...(sampul ? [sampul] : []), badan],
  });
  return Buffer.from(await D.Packer.toBuffer(dok));
}

module.exports = { docxBuffer };
