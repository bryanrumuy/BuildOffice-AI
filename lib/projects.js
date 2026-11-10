'use strict';
/**
 * Pelacak proyek: deret waktu progres fisik & anggaran per proyek (satu baris per bulan), dengan peringatan otomatis.
 * Data masuk dari laporan proyek yang SUDAH diverifikasi orang, atau diisi manual.
 */
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');
const { cleanStr, cleanPct, parseRupiah } = require('./extract');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const LATE_WARN = -5, LATE_DANGER = -10; // deviasi progres fisik terhadap rencana (poin persen)
const COST_WARN = 5;                     // biaya terserap melebihi progres fisik (poin persen)
const WORSEN = 2;                        // memburuknya deviasi antar bulan (poin persen)
const RANK = { aman: 0, waspada: 1, bahaya: 2 };

let proyek = readJson('proyek.json', []);
const save = () => writeJson('proyek.json', proyek);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fmt = (n) => String(Math.round(Math.abs(n) * 10) / 10).replace('.', ',');
const round1 = (n) => Math.round(n * 10) / 10;

function normalizePeriode(i) {
  const x = i && typeof i === 'object' ? i : {};
  if (!MONTH_RE.test(String(x.bulan || ''))) return { error: 'Bulan harus berformat YYYY-MM.' };
  const progres = cleanPct(x.progres);
  if (progres == null) return { error: 'Progres fisik harus angka 0 sampai 100.' };
  return { value: { bulan: x.bulan, progres, rencana: cleanPct(x.rencana), anggaran: parseRupiah(x.anggaran), realisasi: parseRupiah(x.realisasi) } };
}

/** Tambah atau ganti data satu bulan untuk sebuah proyek (dicocokkan lewat nama). */
function upsert(namaInput, input, meta) {
  const nama = cleanStr(namaInput, 120);
  if (!nama) return { error: 'Nama proyek wajib diisi.' };
  const r = normalizePeriode(input);
  if (r.error) return r;
  let p = proyek.find((x) => slug(x.nama) === slug(nama));
  if (!p) { p = { id: crypto.randomUUID(), nama, periode: [] }; proyek.push(p); }
  p.periode = p.periode.filter((x) => x.bulan !== r.value.bulan);
  p.periode.push({ ...r.value, docId: meta.docId || null, sumber: meta.sumber, oleh: meta.oleh, dibuat: new Date().toISOString() });
  p.periode.sort((a, b) => a.bulan.localeCompare(b.bulan));
  save();
  return { value: p.id };
}
function upsertFromDoc(doc, user) {
  const pr = doc.data && doc.data.proyek;
  if (!pr) return null;
  const r = upsert(pr.nama, { bulan: pr.periode, progres: pr.progres_fisik, rencana: pr.rencana_fisik, anggaran: pr.anggaran, realisasi: pr.realisasi_biaya }, { docId: doc.id, sumber: 'dokumen', oleh: user });
  return r.error ? null : { nama: pr.nama, bulan: pr.periode };
}
function removeDoc(docId) {
  for (const p of proyek) p.periode = p.periode.filter((x) => x.docId !== docId);
  proyek = proyek.filter((p) => p.periode.length);
  save();
}
function deleteProject(id) {
  const i = proyek.findIndex((p) => p.id === id);
  if (i < 0) return { error: 'Proyek tidak ditemukan.', code: 404 };
  proyek.splice(i, 1); save();
  return { value: true };
}
function deletePeriod(id, bulan) {
  const p = proyek.find((x) => x.id === id);
  if (!p || !p.periode.some((x) => x.bulan === bulan)) return { error: 'Data bulan itu tidak ditemukan.', code: 404 };
  p.periode = p.periode.filter((x) => x.bulan !== bulan);
  if (!p.periode.length) proyek = proyek.filter((x) => x.id !== id);
  save();
  return { value: true };
}

const deviasi = (x) => (x && x.rencana != null ? round1(x.progres - x.rencana) : null);
const serapan = (x) => (x && x.anggaran && x.realisasi != null ? round1(x.realisasi / x.anggaran * 100) : null);

/** Nilai kondisi proyek dari bulan terakhir (dan tren dibanding bulan sebelumnya). */
function assess(p) {
  const last = p.periode[p.periode.length - 1], prev = p.periode[p.periode.length - 2];
  const d = deviasi(last), s = serapan(last), warn = [];
  let level = 'aman';
  const raise = (l) => { if (RANK[l] > RANK[level]) level = l; };
  if (d != null && d <= LATE_DANGER) { raise('bahaya'); warn.push(`Terlambat ${fmt(d)} poin dari rencana`); }
  else if (d != null && d <= LATE_WARN) { raise('waspada'); warn.push(`Terlambat ${fmt(d)} poin dari rencana`); }
  if (s != null && s - last.progres >= COST_WARN) { raise('waspada'); warn.push(`Biaya terserap ${fmt(s - last.progres)} poin lebih cepat dari progres fisik`); }
  if (prev && deviasi(prev) != null && d != null && d - deviasi(prev) <= -WORSEN) { raise('waspada'); warn.push(`Keterlambatan makin besar dibanding ${prev.bulan}`); }
  return { level, peringatan: warn, deviasi: d, serapan: s };
}

function list() {
  return proyek.map((p) => ({
    id: p.id, nama: p.nama, status: assess(p),
    periode: p.periode.map((x) => ({ ...x, deviasi: deviasi(x), serapan: serapan(x) })),
  })).sort((a, b) => RANK[b.status.level] - RANK[a.status.level] || a.nama.localeCompare(b.nama));
}
function risks() {
  return list().filter((p) => p.status.level !== 'aman').map((p) => ({ nama: p.nama, level: p.status.level, pesan: p.status.peringatan[0] }));
}
function summary() {
  const l = list();
  return { jumlah: l.length, berisiko: l.filter((p) => p.status.level !== 'aman').length, bahaya: l.filter((p) => p.status.level === 'bahaya').length };
}

module.exports = { upsert, upsertFromDoc, removeDoc, deleteProject, deletePeriod, list, risks, summary, MONTH_RE };
