'use strict';
/**
 * Bidang usaha kantor. "umum" = kantor serbaguna (bawaan). "kontraktor" = perusahaan konstruksi: ekstraksi dokumen dan semua agen
 * memakai istilah dan prioritas kontraktor (termin, retensi, jaminan, progres fisik, subkontraktor, K3), tanpa mengubah pos agen.
 */
const BIDANG = {
  umum: { nama: 'Umum', konteks: '', ekstraksi: '', kategori: ['Material', 'Upah', 'Transport', 'Perizinan', 'Operasional', 'Pajak', 'Penjualan', 'Lainnya'] },
  kontraktor: {
    nama: 'Kontraktor / konstruksi',
    kategori: ['Material', 'Upah dan Subkon', 'Sewa Alat', 'BBM dan Transport', 'K3', 'Jaminan dan Asuransi', 'Perizinan dan Sertifikasi', 'Pajak', 'Overhead Kantor', 'Pendapatan Proyek', 'Lainnya'],
    konteks: `Bidang usaha kantor ini: KONTRAKTOR (jasa konstruksi). Pakai istilah lapangan: kontrak/SPK/addendum (CCO), uang muka, termin, retensi, jaminan pelaksanaan (bank garansi), polis CAR, SBU/SKK, opname dan Berita Acara Pemeriksaan (BAP), Kurva S, progres fisik terhadap rencana (deviasi, SPI), anggaran biaya (HPP), nilai hasil dan CPI, subkontraktor, PO material, sewa alat, K3/SMKK (near miss, LTI), denda keterlambatan (umumnya 1 per mil per hari), PPh final 4(2) dan PPN. "Proyek" berarti proyek konstruksi dan "pemilik" berarti pemberi kerja. Prioritas yang perlu kamu waspadai: (1) tagihan termin kepada pemberi kerja yang lewat jatuh tempo; (2) proyek yang progresnya tertinggal dari rencana atau biayanya terserap lebih cepat dari progres; (3) jaminan, polis, dan sertifikat yang habis sebelum kontrak selesai; (4) hutang ke pemasok dan subkontraktor yang jatuh tempo; (5) insiden K3 dan hasil uji mutu (mis. kuat tekan beton). Jangan mengarang angka proyek; pakai data yang ada.`,
    ekstraksi: `KONTEKS KONTRAKTOR: kantor kita perusahaan konstruksi. Pemetaan jenis: kontrak, SPK, addendum, subkontrak, dan purchase order = "kontrak"; invoice yang kita terbitkan kepada pemberi kerja (termin) = "invoice" dengan arah_uang "masuk" dan arah jadwal "tagih"; invoice dari pemasok, subkontraktor, sewa alat, BPJS = "invoice" dengan arah "keluar"/"bayar"; bukti setor pajak, nota BBM, dan bukti transfer = "nota" atau "kwitansi"; polis asuransi (CAR), bank garansi/jaminan, SBU/SKK, dan sertifikat lain yang punya masa berlaku = "izin" dengan jatuh_tempo = tanggal berakhir masa berlaku; Berita Acara (opname, BAP, serah terima), laporan bulanan/mingguan, laporan K3, hasil uji lab, notulen rapat, laporan keuangan = "laporan"; surat teguran, permohonan, penagihan, klaim, dan undangan tender = "surat". Untuk invoice dengan potongan (uang muka, retensi), nilai_angka = total NETTO yang harus dibayar. Untuk surat, laporan, dan jaminan, nilai_angka hanya bila dokumen itu sendiri adalah nilai kontrak atau jaminan; jangan mengambil jumlah tagihan yang hanya disebut sebagai rujukan, dan jangan buat jadwal dengan "jumlah" untuk tagihan yang hanya dirujuk. Pada kontrak, SPK, addendum, subkontrak, dan PO, pembayaran uang muka dan termin yang bergantung progres atau opname BUKAN jadwal bertanggal (ditagih lewat invoice tersendiri): jangan beri "jumlah" kecuali tanggal dan nilainya tertulis pasti di masa depan; masukkan hanya tanggal penting seperti berakhirnya kontrak dan jaminan. Batas waktu tindakan (menjawab surat, perpanjangan jaminan, pemasukan penawaran tender) masuk ke jadwal dengan jumlah null dan arah null. Laporan bulanan proyek: isi "proyek" dengan anggaran = ANGGARAN BIAYA pelaksanaan (HPP), bukan nilai kontrak, dan realisasi_biaya = biaya terserap kumulatif. Kategori: "Pendapatan Proyek" untuk penerimaan termin, "Upah dan Subkon" untuk subkontraktor, "Jaminan dan Asuransi" untuk polis dan bank garansi, "Perizinan dan Sertifikasi" untuk SBU/SKK/izin.`,
  },
};
let aktif = 'umum';
const daftar = () => Object.entries(BIDANG).map(([id, b]) => ({ id, nama: b.nama, kategori: b.kategori }));
const valid = (id) => Object.prototype.hasOwnProperty.call(BIDANG, id);
function set(id) { aktif = valid(id) ? id : 'umum'; return aktif; }
const get = () => aktif;
/** Teks konteks untuk prompt agen (kosong di bidang umum). Diawali baris baru agar bisa langsung disisipkan. */
const konteks = () => (BIDANG[aktif].konteks ? '\n' + BIDANG[aktif].konteks : '');
const ekstraksi = () => (BIDANG[aktif].ekstraksi ? '\n' + BIDANG[aktif].ekstraksi : '');

module.exports = { daftar, valid, set, get, konteks, ekstraksi };
