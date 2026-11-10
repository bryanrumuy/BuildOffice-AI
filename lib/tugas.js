'use strict';
/**
 * Papan Tugas serba guna (bidang apa pun) + Kotak Persetujuan.
 * Tugas dibuat manual atau dipecah oleh Manajer (AI). Pemilik tugas: "agen:<id>" atau "manusia:<peran/nama>".
 * Tindakan agen yang berdampak keluar (kirim Telegram) tidak langsung jalan: masuk Kotak Persetujuan dulu.
 */
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');
const { cleanStr, cleanDate, today } = require('./extract');

const STATUS = ['todo', 'doing', 'review', 'done', 'blocked'];
const OWNER_RE = /^(agen:[a-z][a-z0-9-]{1,29}|manusia:.{1,60})$/;
const MAX_TUGAS = 500, MAX_RIWAYAT = 30, MAX_HASIL = 20000, MAX_PERSETUJUAN = 200;
const ORDER = { doing: 0, review: 1, todo: 2, blocked: 3, done: 4 };
let tugas = readJson('tugas.json', []);
let persetujuan = readJson('persetujuan.json', []);
const save = () => writeJson('tugas.json', tugas);
const saveP = () => writeJson('persetujuan.json', persetujuan);
const nowIso = () => new Date().toISOString();
const find = (id) => tugas.find((t) => t.id === id) || null;
const nf = (what) => ({ error: what + ' tidak ditemukan.', code: 404 });
function log(t, oleh, aksi, ket) { t.riwayat.push({ t: nowIso(), oleh, aksi, ket: ket ? String(ket).slice(0, 300) : null }); if (t.riwayat.length > MAX_RIWAYAT) t.riwayat.shift(); t.diubah = nowIso(); }

// Pemeriksa pemilik berjenis agen: dipasang server supaya tugas tidak bisa diberikan kepada agen yang tidak ada atau yang bukan penerima tugas
// (mis. agen alur dokumen), karena tugas seperti itu tidak akan pernah bisa dikerjakan. Mengembalikan pesan galat, atau null bila sah.
let periksaAgen = null;
const periksaPemilik = (fn) => { periksaAgen = fn; };
/** Pesan galat bila pemilik berjenis agen tidak bisa menerima tugas, atau null (sah / bukan agen). Dipakai juga oleh aturan tugas berulang. */
const cekPemilik = (p) => (p && String(p).startsWith('agen:') && periksaAgen ? periksaAgen(String(p).slice(5)) : null);
function clean(i, partial = false) {
  const x = i && typeof i === 'object' ? i : {};
  const v = {};
  if (!partial || 'judul' in x) { v.judul = cleanStr(x.judul, 150); if (!v.judul) return { error: 'Judul tugas wajib diisi.' }; }
  if (!partial || 'deskripsi' in x) v.deskripsi = cleanStr(x.deskripsi, 1500) || '';
  if (!partial || 'tenggat' in x) { v.tenggat = x.tenggat ? cleanDate(x.tenggat) : null; if (x.tenggat && !v.tenggat) return { error: 'Tenggat harus berformat YYYY-MM-DD.' }; }
  if (!partial || 'pemilik' in x) { v.pemilik = x.pemilik ? String(x.pemilik).trim() : null; if (v.pemilik && !OWNER_RE.test(v.pemilik)) return { error: 'Pemilik harus "agen:<id>" atau "manusia:<peran/nama>".' };
    if (v.pemilik && v.pemilik.startsWith('agen:') && periksaAgen) { const salah = periksaAgen(v.pemilik.slice(5)); if (salah) return { error: salah }; } }
  if ('status' in x) { if (!STATUS.includes(x.status)) return { error: 'Status tidak dikenal.' }; v.status = x.status; }
  if ('lampiran' in x) v.lampiran = (Array.isArray(x.lampiran) ? x.lampiran : []).map(String).slice(0, 3);
  return { value: v };
}
function add(input, oleh, extra = {}) {
  if (tugas.length >= MAX_TUGAS) return { error: `Papan penuh (maks ${MAX_TUGAS} tugas). Hapus yang lama dulu.` };
  const c = clean(input);
  if (c.error) return c;
  const t = { id: crypto.randomUUID(), status: 'todo', lampiran: [], bergantung: [], kelompok: null, hasil: null, riwayat: [], dibuat: nowIso(), diubah: nowIso(), oleh, ...c.value, ...extra };
  if (input && input.status && STATUS.includes(input.status)) t.status = input.status;
  log(t, oleh, 'dibuat', extra.kelompok ? 'dari instruksi: ' + extra.kelompok.judul : null);
  tugas.push(t); save();
  return { value: t };
}
function update(id, input, oleh) {
  const t = find(id);
  if (!t) return nf('Tugas');
  const c = clean(input, true);
  if (c.error) return c;
  const before = t.status;
  Object.assign(t, c.value);
  if (c.value.status && c.value.status !== before) log(t, oleh, 'status', `${before} → ${c.value.status}`); else log(t, oleh, 'diubah');
  save();
  return { value: t };
}
function remove(id) {
  const i = tugas.findIndex((t) => t.id === id);
  if (i < 0) return nf('Tugas');
  const [t] = tugas.splice(i, 1);
  for (const o of tugas) o.bergantung = o.bergantung.filter((d) => d !== id);
  persetujuan = persetujuan.filter((p) => p.tugasId !== id || p.status !== 'menunggu');
  save(); saveP();
  return { value: t };
}
/** Simpan hasil kerja agen pada tugas. status: 'review' (selesai, tunggu dicek orang) atau 'blocked'. */
function setHasil(id, { hasil, status, catatan, langkah, berkas }, oleh) {
  const t = find(id);
  if (!t) return nf('Tugas');
  t.hasil = String(hasil || '').slice(0, MAX_HASIL) || null;
  t.langkah = Array.isArray(langkah) ? langkah.slice(0, 30) : []; t.berkas = Array.isArray(berkas) ? berkas.slice(0, 10) : [];
  const before = t.status; t.status = status === 'blocked' ? 'blocked' : 'review';
  log(t, oleh, 'hasil-agen', `${before} → ${t.status}${catatan ? ' · ' + catatan : ''}`);
  save();
  return { value: t };
}
function list({ status, pemilik, kelompok } = {}) {
  return tugas.filter((t) => (!status || t.status === status) && (!pemilik || t.pemilik === pemilik) && (!kelompok || (t.kelompok && t.kelompok.id === kelompok)))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || String(a.tenggat || '9999').localeCompare(String(b.tenggat || '9999')) || a.dibuat.localeCompare(b.dibuat));
}
const sisaHari = (d) => Math.round((Date.parse(d) - Date.parse(today())) / 86400000);
function stats() {
  const buka = tugas.filter((t) => t.status !== 'done');
  return { total: tugas.length, selesai: tugas.length - buka.length, terbuka: buka.length, review: tugas.filter((t) => t.status === 'review').length, blocked: tugas.filter((t) => t.status === 'blocked').length,
    terlambat: buka.filter((t) => t.tenggat && sisaHari(t.tenggat) < 0).length };
}
/** Tugas terbuka yang punya tenggat (untuk pengingat). */
const openWithDeadline = () => tugas.filter((t) => t.status !== 'done' && t.tenggat);

// ---------- Kotak Persetujuan ----------
const pendengarPengajuan = [];
/** Daftarkan fungsi yang dipanggil tiap ada pengajuan baru (mis. mengirim tombol Setujui/Tolak ke Telegram). Galatnya tidak mengganggu pembuatan pengajuan. */
const onApproval = (fn) => { pendengarPengajuan.push(fn); };
function addApproval({ jenis, teks, tugasId, oleh }) {
  if (jenis !== 'telegram') return { error: 'Jenis tindakan belum didukung.' };
  const s = cleanStr(teks, 1000);
  if (!s) return { error: 'Teks tindakan kosong.' };
  const p = { id: crypto.randomUUID(), jenis, teks: s, tugasId: tugasId || null, status: 'menunggu', oleh, dibuat: nowIso() };
  persetujuan.unshift(p); if (persetujuan.length > MAX_PERSETUJUAN) persetujuan.length = MAX_PERSETUJUAN;
  saveP();
  for (const fn of pendengarPengajuan) { try { Promise.resolve(fn(p)).catch(() => {}); } catch { /* pendengar tidak boleh menggagalkan pengajuan */ } }
  return { value: p };
}
const listApprovals = (status) => persetujuan.filter((p) => !status || p.status === status);
const getApproval = (id) => persetujuan.find((p) => p.id === id) || null;
function decide(id, keputusan, oleh) {
  const p = getApproval(id);
  if (!p) return nf('Persetujuan');
  if (p.status !== 'menunggu') return { error: 'Persetujuan ini sudah diputuskan.' };
  p.status = keputusan === 'setuju' ? 'disetujui' : 'ditolak'; p.diputuskanOleh = oleh; p.diputuskanPada = nowIso();
  saveP();
  return { value: p };
}

module.exports = { STATUS, periksaPemilik, cekPemilik, add, update, remove, find, setHasil, list, stats, openWithDeadline, addApproval, onApproval, listApprovals, getApproval, decide, log, save };
