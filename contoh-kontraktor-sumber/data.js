'use strict';
// Data induk PT kontraktor fiktif. Semua angka dibuat saling cocok antar dokumen (kontrak, termin, laporan, jaminan, polis).
const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const tgl = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const hari = (iso) => HARI[new Date(iso + 'T00:00:00Z').getUTCDay()];
const tambah = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const ppn = (n) => Math.round(n * 0.11);
const terbilang = (n) => {
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const t = (x) => { x = Math.floor(x); if (x < 12) return s[x]; if (x < 20) return s[x - 10] + ' belas'; if (x < 100) return s[Math.floor(x / 10)] + ' puluh' + (x % 10 ? ' ' + s[x % 10] : '');
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + t(x - 100) : ''); if (x < 1000) return s[Math.floor(x / 100)] + ' ratus' + (x % 100 ? ' ' + t(x % 100) : '');
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + t(x - 1000) : ''); if (x < 1e6) return t(x / 1000) + ' ribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
    if (x < 1e9) return t(x / 1e6) + ' juta' + (x % 1e6 ? ' ' + t(x % 1e6) : ''); if (x < 1e12) return t(x / 1e9) + ' miliar' + (x % 1e9 ? ' ' + t(x % 1e9) : ''); return String(x); };
  return t(n).replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()) + ' rupiah';
};

// ---- Pihak ----
const KBN = { nama: 'PT Karya Bumi Nusantara Konstruksi', singkat: 'KBN Konstruksi', alamat: 'Jl. Raya Cibitung-Cikarang Km 7, Kawasan Industri Jababeka Blok C-12, Bekasi 17530', telp: '(021) 8970-4421', email: 'admin@kbnkonstruksi.example', npwp: '02.841.376.5-407.000',
  dirut: 'Ir. Bambang Sutrisno, M.T.', dirkeu: 'Siti Rahmawati, S.E., Ak.', dirops: 'Ir. Agus Hermawan, M.M.', warna: '#0b3d63', bank: 'Bank Cipta Niaga KCP Cikarang, rek. 088-210-7745-3', sbu: 'SBU-K-2024-0188417' };
const PUPR = { nama: 'Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Bekasi', alamat: 'Jl. Pemda No. 1, Cikarang Pusat, Bekasi 17530', telp: '(021) 8900-1177', warna: '#1b5e20', pejabat: 'Drs. H. Sukarman, M.Si.', jabatan: 'Pejabat Pembuat Komitmen (PPK)', nip: '19710315 199803 1 004' };
const BINMAR = { nama: 'Dinas Bina Marga dan Penataan Ruang Provinsi (UPTD Wilayah II)', alamat: 'Jl. Soekarno-Hatta No. 208, Bandung 40223', warna: '#6a1b1b', pejabat: 'Ir. Dedi Mulyadi Rachman, M.T.', jabatan: 'Pejabat Pembuat Komitmen (PPK)' };
const MPS = { nama: 'PT Mutiara Properti Sejahtera', alamat: 'Menara Mutiara Lt. 9, Jl. Boulevard Raya Kav. 5, Bekasi Barat 17142', telp: '(021) 8845-7788', warna: '#7b1f4b', pejabat: 'Hendra Kusuma Wijaya', jabatan: 'Direktur Utama' };
const PLAST = { nama: 'PT Prima Plastindo Jaya', alamat: 'Kawasan MM2100 Blok KK-3, Cikarang Barat 17520', telp: '(021) 8998-3300', warna: '#004d66', pejabat: 'Michael Santoso', jabatan: 'Direktur Operasional' };
const V = {
  baja: { nama: 'PT Baja Konstruksi Mandiri', alamat: 'Jl. Raya Narogong Km 12, Bogor', npwp: '01.772.904.1-432.000', bank: 'Bank Cipta Niaga, rek. 120-004-5566-7', warna: '#37474f' },
  rmx: { nama: 'PT Beton Prima Readymix', alamat: 'Jl. Industri Selatan V No. 8, Cikarang', npwp: '01.553.280.7-407.000', bank: 'Bank Cipta Niaga, rek. 088-330-1209-8', warna: '#455a64' },
  alat: { nama: 'CV Alat Berat Sejahtera', alamat: 'Jl. Imam Bonjol No. 77, Karawang', npwp: '03.115.620.9-413.000', bank: 'Bank Nusa Artha, rek. 771-0045-228', warna: '#bf360c' },
  aspal: { nama: 'PT Aspal Nusantara Utama', alamat: 'Jl. Raya Cibarusah Km 3, Bekasi', npwp: '01.904.118.2-407.000', bank: 'Bank Cipta Niaga, rek. 088-441-9023-6', warna: '#212121' },
  pilar: { nama: 'CV Pilar Beton Mandiri', alamat: 'Jl. Mawar No. 14, Tambun Selatan, Bekasi', npwp: '04.226.781.5-435.000', bank: 'Bank Nusa Artha, rek. 771-0099-641', warna: '#4e342e', pj: 'Slamet Riyadi' },
  mep: { nama: 'PT Elektrika Mekanikal Utama', alamat: 'Jl. Gatot Subroto No. 41, Jakarta Selatan', npwp: '01.388.452.0-014.000', bank: 'Bank Cipta Niaga, rek. 063-009-4412-1', warna: '#0d47a1', pj: 'Ir. Rudi Hartono' },
  lab: { nama: 'PT Geoteknik Laboratorium Nusa', alamat: 'Jl. Pahlawan Revolusi No. 5, Bekasi Timur', warna: '#1a237e' },
  bank: { nama: 'PT Bank Cipta Niaga Tbk', alamat: 'Gedung Cipta Niaga Lt. 12, Jl. Jend. Sudirman Kav. 20, Jakarta', warna: '#00695c' },
  asuransi: { nama: 'PT Asuransi Jaya Proteksi', alamat: 'Jl. Kebon Sirih No. 33, Jakarta Pusat', warna: '#ad1457' },
  lsbu: { nama: 'Lembaga Sertifikasi Badan Usaha Konstruksi Nusantara', alamat: 'Jl. Gatot Subroto Kav. 52, Jakarta', warna: '#33691e' },
  bpjs: { nama: 'BPJS Ketenagakerjaan Cabang Cikarang', alamat: 'Jl. Raya Cikarang-Cibarusah No. 9, Bekasi', warna: '#1565c0' },
};

// ---- Proyek (nilai harga = tanpa PPN; kontrak = harga + PPN 11%; hpp = anggaran biaya internal) ----
const P1 = { kode: 'P1', nama: 'Pembangunan Gedung Kantor Dinas PUPR Kabupaten Bekasi (4 Lantai)', pendek: 'Gedung Kantor PUPR', pemilik: PUPR, lokasi: 'Jl. Pemda, Cikarang Pusat, Kabupaten Bekasi',
  noKontrak: '600.1.15/KTR-PUPR/012/2026', tglKontrak: '2026-03-02', spmk: '2026-03-16', hari: 300, harga: 34800000000, hpp: 31200000000, pagu: 'APBD Kabupaten Bekasi TA 2026',
  luasBangunan: '5.640 m2', progres: 71.8, rencana: 78.5, biayaSerap: 23100000000, um: 0.2, retensi: 0.05, akhirAsli: '2027-01-09', akhirAdd: '2027-01-30' };
const P2 = { kode: 'P2', nama: 'Preservasi Jalan Provinsi Ruas Cikarang-Cibarusah (Pelapisan AC-WC dan Rehabilitasi Drainase)', pendek: 'Preservasi Jalan Cikarang-Cibarusah', pemilik: BINMAR, lokasi: 'Ruas Cikarang-Cibarusah, STA 0+000 s.d. STA 14+500',
  noKontrak: '620/KTR-BM/UPTD-II/0247/2026', tglKontrak: '2026-02-20', spmk: '2026-03-02', hari: 300, harga: 19200000000, hpp: 16800000000, pagu: 'APBD Provinsi TA 2026',
  progres: 64.2, rencana: 60.0, biayaSerap: 10400000000, um: 0.2, retensi: 0.05, akhirAsli: '2026-12-26', akhirAdd: null };
const P3 = { kode: 'P3', nama: 'Pembangunan Ruko 3 Lantai (8 Unit) Cluster Mutiara Square Bekasi', pendek: 'Ruko Mutiara Square', pemilik: MPS, lokasi: 'Cluster Mutiara Square Blok R, Bekasi Barat',
  noKontrak: '017/MPS-KBN/SPK-KONS/III/2026', tglKontrak: '2026-03-24', spmk: '2026-04-01', hari: 270, harga: 13200000000, hpp: 11900000000, pagu: 'Dana swasta (pemilik proyek)',
  progres: 41.0, rencana: 55.0, biayaSerap: 5900000000, um: 0.15, retensi: 0.05, akhirAsli: '2026-12-26', akhirAdd: null };
const P4 = { kode: 'P4', nama: 'Renovasi dan Perluasan Gudang Pabrik PT Prima Plastindo Jaya (Lantai 1.800 m2)', pendek: 'Gudang Prima Plastindo', pemilik: PLAST, lokasi: 'Kawasan MM2100 Blok KK-3, Cikarang Barat',
  noKontrak: 'PPJ/KBN/SPK/0612/2026', tglKontrak: '2026-05-26', spmk: '2026-06-01', hari: 180, harga: 5600000000, hpp: 4900000000, pagu: 'Dana swasta (pemilik proyek)',
  progres: 88.5, rencana: 85.0, biayaSerap: 4200000000, um: 0.2, retensi: 0.05, akhirAsli: '2026-11-27', akhirAdd: null };
// Addendum I P1 (12 Okt 2026): tambah Rp 870 jt, kurang Rp 270 jt (harga), perpanjangan 21 hari; anggaran biaya (hpp) ikut direvisi.
P1.hargaAdd = P1.harga + 600000000; P1.hpp = 31600000000; P1.kontrakAdd = P1.hargaAdd + ppn(P1.hargaAdd);
for (const p of [P1, P2, P3, P4]) { p.ppn = ppn(p.harga); p.kontrak = p.harga + p.ppn; p.um$ = Math.round(p.harga * p.um); p.akhir = p.akhirAdd || p.akhirAsli; }

module.exports = { rp, tgl, hari, tambah, ppn, terbilang, BULAN, KBN, PUPR, BINMAR, MPS, PLAST, V, P1, P2, P3, P4, TODAY: '2026-10-29' };
