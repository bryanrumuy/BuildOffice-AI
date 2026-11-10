'use strict';
/**
 * Aturan berulang: tagihan atau tugas yang dibuat otomatis tiap minggu, bulan, atau tahun (sewa, listrik, pajak, asuransi, cek kas mingguan).
 * Tagihan dibuat 14 hari sebelum jatuh tempo agar Pengingat sempat memberi tahu; tugas 3 hari sebelumnya. Kejadian yang terlewat sampai
 * 3 hari (server sempat mati) tetap dibuat. Tiap kejadian dibuat sekali saja: tanggalnya dicatat di aturan, dan baru dicatat bila pembuatannya berhasil.
 */
const crypto = require('crypto');
const { readJson, writeJson } = require('./store');
const { today, cleanDate, cleanStr, parseRupiah } = require('./extract');

const FREKUENSI = ['mingguan', 'bulanan', 'tahunan'];
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MAX_ATURAN = 60, DIMUKA = { tagihan: 14, tugas: 3 }, TERLEWAT_HARI = 3, SIMPAN_KUNCI = 40, HARI_MS = 86400000;
let aturan = readJson('berulang.json', []);
const save = () => writeJson('berulang.json', aturan);

const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const isoDari = (ms) => new Date(ms).toISOString().slice(0, 10);
const tambahHari = (iso, n) => isoDari(utc(iso) + n * HARI_MS);
const akhirBulan = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dua = (n) => String(n).padStart(2, '0');
const tanggalBulan = (y, m, hari) => `${y}-${dua(m)}-${dua(Math.min(hari, akhirBulan(y, m)))}`;

/** Tanggal-tanggal jatuh tempo aturan a antara dari dan sampai (ISO, inklusif), dengan batas mulai/akhir aturan. */
function kejadian(a, dari, sampai) {
  const out = [], dalam = (t) => t >= dari && t <= sampai && t >= a.mulai && (!a.akhir || t <= a.akhir);
  if (a.frekuensi === 'mingguan') {
    for (let ms = utc(dari); ms <= utc(sampai); ms += HARI_MS) if (new Date(ms).getUTCDay() === a.hari && dalam(isoDari(ms))) out.push(isoDari(ms));
    return out;
  }
  const [y1, m1] = dari.split('-').map(Number), [y2, m2] = sampai.split('-').map(Number);
  for (let y = y1, m = m1; y < y2 || (y === y2 && m <= m2); m === 12 ? (y++, m = 1) : m++) {
    if (a.frekuensi === 'tahunan' && m !== a.bulan) continue;
    const t = tanggalBulan(y, m, a.hari);
    if (dalam(t)) out.push(t);
  }
  return out;
}

/** { value: aturan } atau { error }. */
function buat(input, oleh) {
  const x = input && typeof input === 'object' ? input : {};
  if (!['tagihan', 'tugas'].includes(x.jenis)) return { error: 'Jenis harus tagihan atau tugas.' };
  const judul = cleanStr(x.judul, 150);
  if (!judul) return { error: 'Judul atau keterangan wajib diisi.' };
  if (!FREKUENSI.includes(x.frekuensi)) return { error: 'Frekuensi harus mingguan, bulanan, atau tahunan.' };
  const hari = Number(x.hari), [min, max] = x.frekuensi === 'mingguan' ? [0, 6] : [1, 31];
  if (!Number.isInteger(hari) || hari < min || hari > max) return { error: x.frekuensi === 'mingguan' ? 'Hari harus 0 (Minggu) sampai 6 (Sabtu).' : 'Hari harus 1 sampai 31.' };
  let bulan = null;
  if (x.frekuensi === 'tahunan') { bulan = Number(x.bulan); if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) return { error: 'Aturan tahunan butuh bulan 1 sampai 12.' }; }
  const mulai = cleanDate(x.mulai) || today(), akhir = x.akhir ? cleanDate(x.akhir) : null;
  if (x.akhir && !akhir) return { error: 'Tanggal akhir tidak valid (format YYYY-MM-DD).' };
  if (akhir && akhir < mulai) return { error: 'Tanggal akhir tidak boleh sebelum tanggal mulai.' };
  if (aturan.length >= MAX_ATURAN) return { error: `Aturan berulang penuh (maks ${MAX_ATURAN}). Hapus yang tidak dipakai.` };
  const a = { id: crypto.randomUUID(), jenis: x.jenis, judul, frekuensi: x.frekuensi, hari, bulan, mulai, akhir, aktif: true, kunci: [], dibuat: new Date().toISOString(), oleh };
  if (x.jenis === 'tagihan') {
    const jumlah = parseRupiah(x.jumlah);
    if (!jumlah) return { error: 'Jumlah harus angka lebih dari 0.' };
    Object.assign(a, { jumlah, arah: x.arah === 'tagih' ? 'tagih' : 'bayar', pihak: cleanStr(x.pihak, 200), kategori: cleanStr(x.kategori, 30) || null });
  } else Object.assign(a, { pemilik: cleanStr(x.pemilik, 60) || 'manusia:Admin', deskripsi: cleanStr(x.deskripsi, 500) });
  aturan.push(a); save();
  return { value: a };
}

/** Membuat kejadian yang sudah waktunya. buatTagihan(aturan, tanggal) / buatTugas(aturan, tanggal) mengembalikan { id } atau { error }. */
function bangkit({ hariIni = today(), buatTagihan, buatTugas }) {
  const hasil = [];
  for (const a of aturan) {
    if (!a.aktif) continue;
    const dari = tambahHari(hariIni, -TERLEWAT_HARI), sampai = tambahHari(hariIni, DIMUKA[a.jenis]);
    for (const tanggal of kejadian(a, dari, sampai)) {
      if (a.kunci.includes(tanggal)) continue;
      const r = (a.jenis === 'tagihan' ? buatTagihan : buatTugas)(a, tanggal);
      if (!r || r.error) continue; // gagal: jangan ditandai, dicoba lagi pada putaran berikutnya
      a.kunci.push(tanggal); if (a.kunci.length > SIMPAN_KUNCI) a.kunci.splice(0, a.kunci.length - SIMPAN_KUNCI);
      hasil.push({ aturanId: a.id, jenis: a.jenis, judul: a.judul, tanggal, id: r.id });
    }
  }
  if (hasil.length) save();
  return hasil;
}

const daftar = () => aturan;
function ubah(id, { aktif }) { const a = aturan.find((x) => x.id === id); if (!a) return { error: 'Aturan tidak ditemukan.' }; a.aktif = Boolean(aktif); save(); return { value: a }; }
function hapus(id) { const n = aturan.length; aturan = aturan.filter((x) => x.id !== id); if (aturan.length === n) return false; save(); return true; }
function ringkas(a) {
  if (a.frekuensi === 'mingguan') return `Tiap ${NAMA_HARI[a.hari]}`;
  if (a.frekuensi === 'tahunan') return `Tiap tahun ${a.hari} ${NAMA_BULAN[a.bulan - 1]}`;
  return a.hari === 31 ? 'Tiap akhir bulan' : `Tiap bulan tanggal ${a.hari}`;
}

module.exports = { buat, bangkit, kejadian, daftar, ubah, hapus, ringkas, FREKUENSI };
