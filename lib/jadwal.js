'use strict';
/**
 * Jadwal laporan wajib per agen: agen melapor sendiri ke Telegram pada hari dan jam tertentu (bawaan: Bendahara tiap Senin 08:00,
 * Pengingat tiap hari 07:00). Satu laporan per jadwal per hari: tanggal terkirim dicatat; bila server baru hidup setelah jamnya
 * (hari yang sama), laporan tetap dikirim. Gagal kirim dicoba lagi sampai 3 kali sehari.
 */
const { readJson, writeJson } = require('./store');

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MAX_GAGAL_HARI = 3;
const BAWAAN = [
  { id: 'bendahara-mingguan', agen: 'keuangan', jenis: 'keuangan-mingguan', frekuensi: 'mingguan', hari: 1, jam: 8, aktif: true, terakhir: null, gagal: null },
  { id: 'pengingat-harian', agen: 'pengingat', jenis: 'pengingat-harian', frekuensi: 'harian', hari: null, jam: 7, aktif: true, terakhir: null, gagal: null },
];
let jadwal = readJson('jadwal.json', null) || BAWAAN.map((x) => ({ ...x }));
const save = () => writeJson('jadwal.json', jadwal);

const daftar = () => jadwal;
/** waktu: { tanggal: 'YYYY-MM-DD', jam: 0-23, hari: 0-6 } (waktu lokal). */
function jatuhTempo(item, { tanggal, jam, hari }) {
  if (!item.aktif || item.terakhir === tanggal || jam < item.jam) return false;
  if (item.frekuensi === 'mingguan' && hari !== item.hari) return false;
  if (item.gagal && item.gagal.tanggal === tanggal && item.gagal.n >= MAX_GAGAL_HARI) return false;
  return true;
}
const cari = (id) => jadwal.find((x) => x.id === id);
function tandai(id, tanggal) { const x = cari(id); if (!x) return; x.terakhir = tanggal; x.gagal = null; save(); }
function catatGagal(id, tanggal) { const x = cari(id); if (!x) return; x.gagal = { tanggal, n: x.gagal && x.gagal.tanggal === tanggal ? x.gagal.n + 1 : 1 }; save(); }
function ubah(id, { aktif, jam, hari }) {
  const x = cari(id); if (!x) return { error: 'Jadwal tidak ditemukan.' };
  if (jam !== undefined) { const j = Number(jam); if (!Number.isInteger(j) || j < 0 || j > 23) return { error: 'Jam harus 0 sampai 23.' }; x.jam = j; }
  if (hari !== undefined && x.frekuensi === 'mingguan') { const h = Number(hari); if (!Number.isInteger(h) || h < 0 || h > 6) return { error: 'Hari harus 0 (Minggu) sampai 6 (Sabtu).' }; x.hari = h; }
  if (aktif !== undefined) x.aktif = Boolean(aktif);
  save();
  return { value: x };
}
const teks = (x) => `${x.frekuensi === 'harian' ? 'Tiap hari' : 'Tiap ' + NAMA_HARI[x.hari]} jam ${String(x.jam).padStart(2, '0')}:00`;

module.exports = { daftar, jatuhTempo, tandai, catatGagal, ubah, teks, cari };
