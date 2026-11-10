'use strict';
/**
 * Perkiraan pemakaian token per jenis pekerjaan (rapat, instruksi ke Manajer, kerjakan tugas, perintah, tanya agen), dihitung dari
 * pemakaian NYATA yang tercatat di kantor ini. Sebelum ada riwayat dipakai angka awal. Hanya angka dan pemakaian; tidak menyimpan isi percakapan.
 */
const { readJson, writeJson } = require('./store');

const JENIS = {
  rapat: { nama: 'Rapat kantor', awal: 14000 },
  instruksi: { nama: 'Instruksi ke Manajer', awal: 6000 },
  kerjakan: { nama: 'Mengerjakan tugas', awal: 9000 },
  perintah: { nama: 'Perintah dengan alat', awal: 8000 },
  tanyaAgen: { nama: 'Tanya satu agen', awal: 1500 },
};
const RIWAYAT_MAKS = 12;
let riwayat = readJson('biaya.json', {});
const simpan = () => writeJson('biaya.json', riwayat);

/** Catat pemakaian satu pekerjaan; abaikan jenis tak dikenal dan pemakaian nol (mode demo atau gagal sebelum memanggil AI). */
function catat(jenis, token) {
  if (!JENIS[jenis] || !(token > 0)) return false;
  riwayat = { ...riwayat, [jenis]: [...(riwayat[jenis] || []), Math.round(token)].slice(-RIWAYAT_MAKS) };
  simpan(); return true;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** { jenis, nama, token, min, maks, dasar: 'riwayat'|'awal', n, persenBulan } ; aiAktif=false (mode demo) berarti tanpa token. */
function perkiraan(jenis, { aiAktif = true, terpakai = 0, batas = 0 } = {}) {
  const j = JENIS[jenis]; if (!j) return null;
  const data = riwayat[jenis] || [];
  const token = !aiAktif ? 0 : data.length ? median(data) : j.awal;
  return { jenis, nama: j.nama, token, min: !aiAktif ? 0 : data.length ? Math.min(...data) : Math.round(j.awal * 0.6), maks: !aiAktif ? 0 : data.length ? Math.max(...data) : Math.round(j.awal * 1.6),
    dasar: data.length ? 'riwayat' : 'awal', n: data.length, persenBulan: batas > 0 ? Math.round(token / batas * 1000) / 10 : 0, sisaBulan: batas > 0 ? Math.max(0, batas - terpakai) : null, cukup: batas > 0 ? terpakai + token <= batas : true };
}
const semua = (opsi) => Object.keys(JENIS).map((k) => perkiraan(k, opsi));

/** Jalankan fn dan catat selisih token. Dipanggil di dalam kunci "exklusif" supaya selisihnya milik pekerjaan ini saja. */
async function ukur(jenis, tokensUsed, fn) {
  const sebelum = tokensUsed();
  try { return await fn(); } finally { catat(jenis, tokensUsed() - sebelum); }
}
module.exports = { JENIS, catat, perkiraan, semua, ukur };
