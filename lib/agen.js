'use strict';
/**
 * Daftar agen AI sebagai DATA (bukan kode): tiap agen punya peran dan tujuan. Bawaan: Manajer dan Pelaksana.
 * Admin bisa menambah agen sendiri (mis. "Agen Penagih") dan mengubah peran/tujuan agen bawaan, tanpa menulis kode.
 */
const { readJson, writeJson } = require('./store');
const { cleanStr } = require('./extract');

// Semua peran sengaja netral bidang: berlaku untuk pekerjaan apa pun, bukan hanya satu jenis usaha.
// bisaDitugasi: false = bukan penulis; ia bekerja lewat fungsinya sendiri (Manajer menyusun rencana, Penjaga memantau sistem).
const BAWAAN = [
  { id: 'manajer', nama: 'Manajer Proyek', kode: 'PM', ringkas: 'Memecah instruksi besar jadi tugas kecil', bisaDitugasi: false, peran: 'Manajer proyek serba guna: memecah instruksi untuk pekerjaan apa pun menjadi tugas kecil dan memantau penyelesaiannya.',
    tujuan: 'Setiap instruksi menjadi tugas yang jelas, punya penanggung jawab, dan bertenggat.' },
  { id: 'asisten', nama: 'Asisten Harian', kode: 'AS', ringkas: 'Standup pagi: prioritas hari ini', bisaDitugasi: true, peran: 'Asisten harian tim: menyapa tiap pagi dan menyusun standup (apa yang jatuh tempo, siapa memegang tugas apa, apa yang menunggu persetujuan) untuk pekerjaan apa pun.',
    tujuan: 'Tim memulai hari dengan tahu prioritasnya.' },
  { id: 'pelapor', nama: 'Penyusun Laporan', kode: 'LP', ringkas: 'Menyusun laporan mingguan untuk pemilik', bisaDitugasi: true, peran: 'Analis dan pelapor: membaca data kantor (keuangan, proyek, tugas, dokumen) lalu menyusun laporan berkala dalam bentuk teks atau file untuk pemilik, untuk bidang kerja apa pun.',
    tujuan: 'Pemilik menerima laporan yang akurat dan mudah dipahami tanpa harus memintanya.' },
  { id: 'penjaga', nama: 'Penjaga Sistem', kode: 'PS', ringkas: 'Menjaga server, backup, dan dokumen gagal', bisaDitugasi: false, peran: 'Penjaga sistem: memantau kesehatan kantor virtual (server, dokumen gagal, batas token, backup) dan melakukan perbaikan yang aman: mengulang dokumen gagal, membuat backup, memberi peringatan. Tidak pernah mengubah kode.',
    tujuan: 'Kantor virtual tetap sehat dan datanya aman.' },
  { id: 'pelaksana', nama: 'Staf Serbaguna', kode: 'PL', ringkas: 'Mengerjakan tugas tertulis: draf, ringkasan, analisis', bisaDitugasi: true, peran: 'Staf serbaguna yang mengerjakan tugas tertulis: draf surat atau pesan, analisis, ringkasan, daftar periksa, dan perhitungan dari data yang ada.',
    tujuan: 'Menghasilkan hasil kerja yang langsung bisa dipakai dan jujur tentang apa yang belum diketahui.' },
];
// Agen alur dokumen (bukan penerima tugas tertulis; tidak ada di daftar agen yang bisa diatur). Nama memakai istilah kantor sehari-hari.
const ALUR_DOKUMEN = [
  { id: 'penerima', nama: 'Resepsionis', kode: 'FO', ringkas: 'Menerima file yang diunggah' },
  { id: 'pembaca', nama: 'Pembaca Dokumen', kode: 'RD', ringkas: 'Membaca isi dokumen (pakai AI)' },
  { id: 'arsip', nama: 'Petugas Arsip', kode: 'AR', ringkas: 'Menyimpan dokumen dan menjawab pertanyaan' },
  { id: 'keuangan', nama: 'Bendahara', kode: 'FN', ringkas: 'Mencatat kas dan tagihan dari dokumen' },
  { id: 'pengingat', nama: 'Pengingat Jadwal', kode: 'RM', ringkas: 'Memantau jatuh tempo tagihan dan dokumen' },
];
const ringkasDari = (peran) => { const t = String(peran || '').split(/[:.]/)[0].trim(); return t.length > 60 ? t.slice(0, 59) + '…' : t; };
const ID_RE = /^[a-z][a-z0-9-]{1,29}$/;
const MAX_AGEN = 12;
let store = readJson('agen.json', []); // agen kustom + perubahan atas agen bawaan
const save = () => writeJson('agen.json', store);
const isBawaan = (id) => BAWAAN.some((b) => b.id === id);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const kodeDari = (nama) => String(nama).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'AG';

function all() {
  const ov = new Map(store.map((a) => [a.id, a]));
  return [...BAWAAN.map((b) => ({ ...b, ...(ov.get(b.id) || {}), bawaan: true })), ...store.filter((a) => !isBawaan(a.id)).map((a) => ({ ...a, ringkas: ringkasDari(a.peran), bawaan: false }))];
}
const get = (id) => all().find((a) => a.id === id) || null;

function clean(input) {
  const i = input && typeof input === 'object' ? input : {};
  const nama = cleanStr(i.nama, 40), peran = cleanStr(i.peran, 500), tujuan = cleanStr(i.tujuan, 300);
  if (!nama) return { error: 'Nama agen wajib diisi.' };
  if (!peran || peran.length < 10) return { error: 'Peran agen wajib diisi (jelaskan tugasnya, minimal 10 karakter).' };
  return { value: { nama, peran, tujuan: tujuan || '', kode: (cleanStr(i.kode, 3) || kodeDari(nama)).toUpperCase(), bisaDitugasi: i.bisaDitugasi !== false } };
}
function create(input) {
  const c = clean(input);
  if (c.error) return c;
  const id = slug(c.value.nama);
  if (!ID_RE.test(id)) return { error: 'Nama agen harus mengandung huruf (untuk membuat ID).' };
  if (get(id)) return { error: `Sudah ada agen dengan nama serupa ("${id}").` };
  if (all().length >= MAX_AGEN) return { error: `Jumlah agen maksimal ${MAX_AGEN}.` };
  store.push({ id, ...c.value }); save();
  return { value: get(id) };
}
function update(id, input) {
  const cur = get(id);
  if (!cur) return { error: 'Agen tidak ditemukan.', code: 404 };
  const c = clean({ ...cur, ...input });
  if (c.error) return c;
  store = store.filter((a) => a.id !== id); store.push({ id, ...c.value }); save();
  return { value: get(id) };
}
function remove(id) {
  if (isBawaan(id)) return { error: 'Agen bawaan tidak bisa dihapus (perannya boleh diubah).' };
  if (!store.some((a) => a.id === id)) return { error: 'Agen tidak ditemukan.', code: 404 };
  store = store.filter((a) => a.id !== id); save();
  return { value: true };
}

const penulis = () => all().filter((a) => a.bisaDitugasi !== false); // agen yang boleh diberi tugas tertulis
module.exports = { ALUR_DOKUMEN, all, get, create, update, remove, isBawaan, penulis };
