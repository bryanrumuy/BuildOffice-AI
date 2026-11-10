'use strict';
/** Buku kas, tagihan/termin, laporan bulanan, dan ekspor CSV. */
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');
const { today, cleanDate, cleanStr, parseRupiah } = require('./extract');

const PAID_JENIS = ['nota', 'kwitansi'];
const ARAH_TAGIHAN = ['bayar', 'tagih', 'lainnya'];
let kas = readJson('kas.json', []);
let tagihan = readJson('tagihan.json', []);
const saveKas = () => writeJson('kas.json', kas);
const saveTagihan = () => writeJson('tagihan.json', tagihan);
const nowIso = () => new Date().toISOString();
const notFound = (what) => ({ error: what + ' tidak ditemukan.', code: 404 });

// ---------- Buku kas ----------
function normalizeKas(input, kategori) {
  const i = input && typeof input === 'object' ? input : {};
  const uraian = cleanStr(i.uraian, 200);
  const jumlah = parseRupiah(i.jumlah);
  if (!uraian) return { error: 'Uraian wajib diisi.' };
  if (!jumlah) return { error: 'Jumlah harus angka lebih dari 0.' };
  return { value: { tanggal: cleanDate(i.tanggal) || today(), uraian, kategori: kategori.includes(i.kategori) ? i.kategori : 'Lainnya',
    arah: i.arah === 'masuk' ? 'masuk' : 'keluar', jumlah, pihak: cleanStr(i.pihak, 200) } };
}
function listKas(bulan) {
  return kas.filter((k) => !bulan || k.tanggal.startsWith(bulan))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.dibuat.localeCompare(a.dibuat));
}
function addKas(input, user, kategori) {
  const r = normalizeKas(input, kategori);
  if (r.error) return r;
  const entry = { id: crypto.randomUUID(), ...r.value, docId: null, tagihanId: null, status: 'draft', oleh: user, dibuat: nowIso() };
  kas.push(entry); saveKas();
  return { value: entry };
}
function updateKas(id, input, kategori) {
  const k = kas.find((x) => x.id === id);
  if (!k) return notFound('Transaksi');
  const r = normalizeKas({ ...k, ...input }, kategori);
  if (r.error) return r;
  Object.assign(k, r.value); saveKas();
  return { value: k };
}
function verifyKas(id, user) {
  const k = kas.find((x) => x.id === id);
  if (!k) return notFound('Transaksi');
  k.status = 'terverifikasi'; k.verifiedBy = user; k.verifiedAt = nowIso(); saveKas();
  return { value: k };
}
function deleteKas(id) {
  const i = kas.findIndex((x) => x.id === id);
  if (i < 0) return notFound('Transaksi');
  const [k] = kas.splice(i, 1);
  const t = k.tagihanId && tagihan.find((x) => x.id === k.tagihanId);
  if (t) { t.status = 'belum'; t.lunasAt = null; t.kasId = null; saveTagihan(); }
  saveKas();
  return { value: k };
}
// Dokumen sudah diverifikasi orang (nilai & tanggalnya dicek) -> draft kas dari dokumen itu ikut terverifikasi.
function verifyByDoc(docId, user) {
  let n = 0;
  for (const k of kas) if (k.docId === docId && !k.tagihanId && k.status === 'draft') { k.status = 'terverifikasi'; k.verifiedBy = user; k.verifiedAt = nowIso(); n++; }
  if (n) saveKas();
  return n;
}
const getKas = (id) => kas.find((x) => x.id === id) || null;
const draftCount = () => kas.filter((k) => k.status === 'draft').length;

// ---------- Tagihan & termin ----------
function normalizeTagihan(input, kategori) {
  const i = input && typeof input === 'object' ? input : {};
  const label = cleanStr(i.label, 150);
  const tanggal = cleanDate(i.tanggal);
  const jumlah = parseRupiah(i.jumlah);
  if (!label) return { error: 'Keterangan wajib diisi.' };
  if (!tanggal) return { error: 'Tanggal jatuh tempo wajib diisi.' };
  if (!jumlah) return { error: 'Jumlah harus angka lebih dari 0.' };
  return { value: { label, tanggal, jumlah, arah: ARAH_TAGIHAN.includes(i.arah) ? i.arah : 'bayar', pihak: cleanStr(i.pihak, 200),
    kategori: kategori.includes(i.kategori) ? i.kategori : null } };
}
function listTagihan(status = 'belum') {
  return tagihan.filter((t) => status === 'semua' || t.status === status).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}
function addTagihan(input, user, kategori) {
  const r = normalizeTagihan(input, kategori);
  if (r.error) return r;
  const t = { id: crypto.randomUUID(), ...r.value, docId: null, judulDok: null, auto: false, ruleId: input && input.ruleId ? String(input.ruleId).slice(0, 60) : null, status: 'belum', oleh: user, dibuat: nowIso() };
  tagihan.push(t); saveTagihan();
  return { value: t };
}
function updateTagihan(id, input, kategori) {
  const t = tagihan.find((x) => x.id === id);
  if (!t) return notFound('Tagihan');
  if (t.status === 'lunas') return { error: 'Tagihan yang sudah lunas tidak bisa diubah. Hapus transaksi kasnya dulu jika salah.' };
  const r = normalizeTagihan({ ...t, ...input }, kategori);
  if (r.error) return r;
  Object.assign(t, r.value, { auto: false }); saveTagihan();
  return { value: t };
}
function lunasi(id, user, tanggal) {
  const t = tagihan.find((x) => x.id === id);
  if (!t) return notFound('Tagihan');
  if (t.status === 'lunas') return { error: 'Tagihan ini sudah lunas.' };
  if (t.arah === 'lainnya') return { error: 'Pilih dulu arahnya: kita yang bayar, atau kita yang menagih.' };
  const entry = { id: crypto.randomUUID(), tanggal: cleanDate(tanggal) || today(),
    uraian: (t.arah === 'bayar' ? 'Bayar: ' : 'Terima: ') + t.label + (t.judulDok ? ' — ' + t.judulDok : ''),
    kategori: t.kategori || 'Lainnya', arah: t.arah === 'tagih' ? 'masuk' : 'keluar', jumlah: t.jumlah, pihak: t.pihak,
    docId: t.docId, tagihanId: t.id, status: 'terverifikasi', oleh: user, verifiedBy: user, verifiedAt: nowIso(), dibuat: nowIso() };
  kas.push(entry);
  t.status = 'lunas'; t.lunasAt = entry.tanggal; t.kasId = entry.id;
  saveKas(); saveTagihan();
  return { value: t, kas: entry };
}
function deleteTagihan(id) {
  const i = tagihan.findIndex((x) => x.id === id);
  if (i < 0) return notFound('Tagihan');
  const [t] = tagihan.splice(i, 1); saveTagihan();
  return { value: t };
}

// ---------- Sinkron dari dokumen ----------
// Nota/kwitansi -> transaksi kas draft. Jadwal bernilai / invoice -> tagihan otomatis (dibuat ulang tiap dokumen diubah).
// humanEdit = true saat orang menyimpan koreksi dokumen: catatan kas dari dokumen itu ikut dikoreksi walau sudah terverifikasi.
function syncFromDoc(doc, user, humanEdit = false) {
  const d = doc.data;
  if (!d) return { kas: false, tagihan: 0 };
  let kasMade = false;
  if (PAID_JENIS.includes(d.jenis) && d.nilai_angka) {
    const fields = { tanggal: d.tanggal || today(), uraian: d.judul, kategori: d.kategori || 'Lainnya', arah: d.arah_uang === 'masuk' ? 'masuk' : 'keluar', jumlah: d.nilai_angka, pihak: d.pihak };
    const existing = kas.find((k) => k.docId === doc.id && !k.tagihanId);
    if (!existing) { kas.push({ id: crypto.randomUUID(), ...fields, docId: doc.id, tagihanId: null, status: 'draft', oleh: user, dibuat: nowIso() }); kasMade = true; }
    else if (existing.status === 'draft' || humanEdit) { Object.assign(existing, fields); kasMade = true; }
    if (kasMade) saveKas();
  }
  tagihan = tagihan.filter((t) => !(t.docId === doc.id && t.auto && t.status === 'belum'));
  const arah = d.arah_uang === 'masuk' ? 'tagih' : d.arah_uang === 'keluar' ? 'bayar' : d.jenis === 'invoice' ? 'bayar' : 'lainnya';
  const items = d.jadwal.filter((j) => j.jumlah);
  if (!items.length && d.jenis === 'invoice' && d.nilai_angka && d.jatuh_tempo) items.push({ label: 'Pembayaran invoice', tanggal: d.jatuh_tempo, jumlah: d.nilai_angka });
  const taken = new Set(tagihan.filter((t) => t.docId === doc.id).map((t) => t.label + '|' + t.tanggal));
  let n = 0, dup = 0;
  for (const j of items) {
    if (taken.has(j.label + '|' + j.tanggal)) continue;
    // pembayaran yang sama (tanggal & jumlah) sudah dicatat dari dokumen lain, mis. termin yang disebut di kontrak dan di laporan
    if (tagihan.some((t) => t.docId !== doc.id && t.tanggal === j.tanggal && t.jumlah === j.jumlah)) { dup++; continue; }
    tagihan.push({ id: crypto.randomUUID(), label: j.label, tanggal: j.tanggal, jumlah: j.jumlah, arah: j.arah || arah, pihak: d.pihak, kategori: d.kategori,
      docId: doc.id, judulDok: d.judul, auto: true, status: 'belum', oleh: user, dibuat: nowIso() });
    n++;
  }
  saveTagihan();
  return { kas: kasMade, tagihan: n, dup };
}
// Dokumen dihapus: buang draft & tagihan yang belum lunas; catatan terverifikasi tetap disimpan.
function removeDoc(docId) {
  tagihan = tagihan.filter((t) => !(t.docId === docId && t.status === 'belum'));
  kas = kas.filter((k) => !(k.docId === docId && k.status === 'draft'));
  saveTagihan(); saveKas();
}

// ---------- Laporan ----------
const sumArah = (arr, arah) => arr.filter((k) => k.arah === arah).reduce((s, k) => s + k.jumlah, 0);
function monthSummary(bulan) {
  const ok = kas.filter((k) => k.status === 'terverifikasi' && k.tanggal.startsWith(bulan));
  return { masuk: sumArah(ok, 'masuk'), keluar: sumArah(ok, 'keluar') };
}
function laporan(bulan) {
  const inMonth = listKas(bulan);
  const ok = inMonth.filter((k) => k.status === 'terverifikasi');
  const draft = inMonth.filter((k) => k.status !== 'terverifikasi');
  const before = kas.filter((k) => k.status === 'terverifikasi' && k.tanggal < bulan + '-01');
  const saldoAwal = sumArah(before, 'masuk') - sumArah(before, 'keluar');
  const masuk = sumArah(ok, 'masuk'), keluar = sumArah(ok, 'keluar');
  const perKategori = [...new Set(ok.map((k) => k.kategori))]
    .map((kat) => { const rows = ok.filter((k) => k.kategori === kat); return { kategori: kat, masuk: sumArah(rows, 'masuk'), keluar: sumArah(rows, 'keluar') }; })
    .sort((a, b) => (b.keluar + b.masuk) - (a.keluar + a.masuk));
  return { bulan, saldoAwal, masuk, keluar, selisih: masuk - keluar, saldoAkhir: saldoAwal + masuk - keluar,
    draft: { jumlah: draft.length, masuk: sumArah(draft, 'masuk'), keluar: sumArah(draft, 'keluar') },
    perKategori, transaksi: inMonth, tagihan: tagihan.filter((t) => t.status === 'belum' && t.tanggal.startsWith(bulan)) };
}

// ---------- CSV (dibuka Excel; pemisah ; untuk Excel berbahasa Indonesia) ----------
function toCsv(cols, rows) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula dari isi dokumen
    return '"' + s.replace(/"/g, '""') + '"';
  };
  // Baris "sep=;" memaksa Excel memakai ; sebagai pemisah di semua pengaturan bahasa (tanpanya Excel berbahasa Inggris menumpuk semua kolom jadi satu).
  return '﻿sep=;\r\n' + [cols.map((c) => cell(c[0])).join(';'), ...rows.map((r) => cols.map((c) => cell(c[1](r))).join(';'))].join('\r\n');
}
const kasCsv = (bulan) => toCsv([['Tanggal', (k) => k.tanggal], ['Uraian', (k) => k.uraian], ['Kategori', (k) => k.kategori], ['Pihak', (k) => k.pihak],
  ['Masuk', (k) => (k.arah === 'masuk' ? k.jumlah : '')], ['Keluar', (k) => (k.arah === 'keluar' ? k.jumlah : '')], ['Status', (k) => k.status], ['Dicatat oleh', (k) => k.oleh]], listKas(bulan).reverse());
const tagihanCsv = () => toCsv([['Jatuh tempo', (t) => t.tanggal], ['Keterangan', (t) => t.label], ['Dokumen', (t) => t.judulDok], ['Pihak', (t) => t.pihak],
  ['Arah', (t) => t.arah], ['Jumlah', (t) => t.jumlah], ['Status', (t) => t.status], ['Lunas pada', (t) => t.lunasAt]], listTagihan('semua'));

module.exports = { listKas, addKas, updateKas, verifyKas, verifyByDoc, deleteKas, getKas, draftCount, listTagihan, addTagihan, updateTagihan, lunasi, deleteTagihan,
  syncFromDoc, removeDoc, monthSummary, laporan, toCsv, kasCsv, tagihanCsv };
