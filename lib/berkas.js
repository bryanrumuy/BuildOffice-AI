'use strict';
/**
 * Berkas buatan agen: txt, csv, html, docx (Word), xlsx (Excel), dan pdf (butuh Edge/Chrome). Disimpan di data\berkas\
 * dan dicatat di data\berkas.json. Word: lib/berkasword.js, Excel (rumus hidup): lib/berkasxlsx.js, PDF/HTML: lib/berkasdoc.js.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA, readJson, writeJson } = require('./store');
const laporanfile = require('./laporanfile');
const Md = require('../public/md.js');
const { htmlDari } = require('./berkasdoc');
const { docxBuffer } = require('./berkasword');
const { buatXlsx } = require('./berkasxlsx');

const DIR = path.join(DATA, 'berkas');
const MAX_BYTES = 2 * 1024 * 1024, KEEP = 200;
const FORMAT = {
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', html: 'text/html; charset=utf-8', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
let daftar = readJson('berkas.json', []);
const save = () => writeJson('berkas.json', daftar);

/* ---------- isi dari teks atau baris ---------- */
const csvCell = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = "'" + t; return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }; // netralkan rumus Excel
const parseCsv = (teks) => String(teks).split(/\r?\n/).filter((l) => l.length).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
const aman = (nama) => String(nama || 'berkas').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 60) || 'berkas';

/** { value: entri } atau { error }. isi: { teks }, { baris: [[...]] }, atau untuk xlsx { lembar: [...] } (lihat berkasxlsx.js). */
async function simpan({ nama, format, teks, baris, lembar, oleh, sumber, kantor, namaPenulis }) {
  const fmt = String(format || '').toLowerCase();
  if (!FORMAT[fmt]) return { error: `Format tidak dikenal. Pilih: ${Object.keys(FORMAT).join(', ')}.` };
  let rows = Array.isArray(baris) ? baris.map((r) => (Array.isArray(r) ? r : [r])) : null;
  const adaLembar = fmt === 'xlsx' && Array.isArray(lembar) && lembar.length;
  if (fmt === 'xlsx' || fmt === 'csv') { if (!rows && teks) rows = parseCsv(teks); if (!adaLembar && (!rows || !rows.length)) return { error: `Format ${fmt} butuh ${fmt === 'xlsx' ? '"lembar" (disarankan) atau ' : ''}"baris" (daftar baris, tiap baris daftar sel).` }; }
  else if (!teks || !String(teks).trim()) return { error: 'Isi berkas (teks) kosong.' };
  let buf;
  const judul = aman(nama);
  if (fmt === 'xlsx') {
    try { buf = await buatXlsx({ lembar: adaLembar ? lembar : null, baris: rows, judul, kantor, oleh: namaPenulis }); } catch (e) { return { error: String(e.message || e).slice(0, 1500) }; }
  } else if (fmt === 'csv') buf = Buffer.from('﻿' + rows.slice(0, 5000).map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');
  else if (fmt === 'docx') buf = await docxBuffer(judul, teks, { kantor, oleh: namaPenulis });
  else if (fmt === 'html') buf = Buffer.from(htmlDari(judul, teks, { kantor, oleh: namaPenulis }), 'utf8');
  else if (fmt === 'pdf') {
    buf = await laporanfile.toPdf(htmlDari(judul, teks, { kantor, oleh: namaPenulis }));
    if (!buf) return { error: 'PDF butuh Microsoft Edge atau Chrome di komputer ini. Pakai format docx atau html.' };
  } else buf = Buffer.from(Md.plain(teks), 'utf8');
  if (buf.length > MAX_BYTES) return { error: 'Berkas terlalu besar (maksimal 2 MB).' };
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomUUID(), entry = { id, nama: judul + '.' + fmt, format: fmt, ukuran: buf.length, oleh: oleh || null, sumber: sumber || null, t: new Date().toISOString() };
  fs.writeFileSync(path.join(DIR, id + '.' + fmt), buf);
  daftar.unshift(entry);
  for (const lama of daftar.splice(KEEP)) fs.rmSync(path.join(DIR, lama.id + '.' + lama.format), { force: true });
  save();
  return { value: entry };
}
const list = () => daftar;
const find = (id) => daftar.find((b) => b.id === id) || null;
const fileOf = (b) => path.join(DIR, b.id + '.' + b.format);
function remove(id) {
  const b = find(id); if (!b) return false;
  daftar = daftar.filter((x) => x.id !== id); fs.rmSync(fileOf(b), { force: true }); save();
  return true;
}

module.exports = { simpan, list, find, fileOf, remove, FORMAT };
