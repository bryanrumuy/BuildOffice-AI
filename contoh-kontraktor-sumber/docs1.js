'use strict';
// Kelompok 1: kontrak, addendum, subkontrak, purchase order.
const D = require('./data');
const U = require('./ui');
const { rp, tgl, terbilang, tambah, hari, KBN, PUPR, MPS, PLAST, V, P1, P2, P3, P4 } = D;
const { page, kop, tabel, meta, ttd, pasal, kotak } = U;

const out = [];

// 1. Kontrak P1
{
  const p = P1, harga = p.harga, termin = [['Uang Muka', 0, 0.2], ['Termin I', 30, 0.3], ['Termin II', 55, 0.25], ['Termin III', 70, 0.15], ['Termin IV', 90, 0.2], ['Termin V (PHO)', 100, 0.1]];
  const jaminan = Math.round(p.kontrak * 0.05), dendaMax = Math.round(p.kontrak * 0.05);
  const rowsT = [['1', 'Uang Muka (20%)', 'Setelah kontrak, SPMK, dan Jaminan Uang Muka diterima', '20%', rp(p.um$)],
    ...termin.slice(1).map(([n, prog, bobot], i) => [String(i + 2), n, `Progres fisik kumulatif ${prog}% (dibuktikan Berita Acara Pemeriksaan)`, Math.round(bobot * 100) + '%', rp(harga * bobot)])];
  out.push({ f: 'P1 - Surat Perjanjian Pekerjaan Konstruksi Gedung Kantor PUPR (Kontrak 012-2026).pdf', html: page(PUPR.warna, kop(PUPR, 'Salinan untuk KBN Konstruksi') +
    `<h1>SURAT PERJANJIAN PEKERJAAN KONSTRUKSI</h1><div class="k">Nomor: ${p.noKontrak}<br><b>${p.nama}</b><br>Sumber dana: ${p.pagu}</div>
<p>Pada hari ${hari(p.tglKontrak)} tanggal ${tgl(p.tglKontrak)}, bertempat di Cikarang Pusat, yang bertanda tangan di bawah ini:</p>
<ol><li><b>${PUPR.pejabat}</b>, NIP ${PUPR.nip}, ${PUPR.jabatan} pada ${PUPR.nama}, berkedudukan di ${PUPR.alamat}, berdasarkan Surat Keputusan Bupati Bekasi Nomor 821.2/Kep.188-BKD/2026, selanjutnya disebut <b>PIHAK KESATU (PPK)</b>;</li>
<li><b>${KBN.dirut}</b>, Direktur Utama <b>${KBN.nama}</b>, berkedudukan di ${KBN.alamat}, NPWP ${KBN.npwp}, SBU Konstruksi ${KBN.sbu}, bertindak untuk dan atas nama perusahaan berdasarkan Akta Pendirian Nomor 47 tanggal 9 Maret 2011, selanjutnya disebut <b>PIHAK KEDUA (Penyedia)</b>.</li></ol>
${pasal(1, 'Lingkup Pekerjaan', `<p>PIHAK KEDUA melaksanakan <b>${p.nama}</b> di ${p.lokasi}, meliputi pekerjaan persiapan, struktur bawah dan atas (beton bertulang), arsitektur, mekanikal-elektrikal-plumbing, lansekap, dan utilitas, dengan luas bangunan ${p.luasBangunan}, sesuai gambar rencana, Rencana Kerja dan Syarat-syarat (RKS), serta Daftar Kuantitas dan Harga.</p>`)}
${pasal(2, 'Nilai Kontrak', `<p>Nilai Kontrak adalah <b>${rp(p.kontrak)}</b> (${terbilang(p.kontrak)}) termasuk PPN 11% sebesar ${rp(p.ppn)}, dengan harga sebelum PPN ${rp(harga)}. Jenis kontrak: harga satuan, sistem pembayaran termin berdasarkan prestasi pekerjaan.</p>`)}
${pasal(3, 'Jangka Waktu', `<p>Jangka waktu pelaksanaan <b>${p.hari} (tiga ratus) hari kalender</b>, dimulai ${tgl(p.spmk)} berdasarkan Surat Perintah Mulai Kerja (SPMK) dan berakhir ${tgl(p.akhirAsli)}. Masa pemeliharaan 180 (seratus delapan puluh) hari kalender sejak Berita Acara Serah Terima Pertama (PHO).</p>`)}
${pasal(4, 'Pembayaran', `<p>Pembayaran dilakukan bertahap sebagai berikut. Pengembalian uang muka diperhitungkan sebesar 20% dari setiap termin. Pembayaran paling lambat 14 (empat belas) hari kerja setelah tagihan lengkap diterima dan diperiksa PPK.</p>${tabel(['No', 'Termin', 'Syarat pembayaran', 'Bobot', 'Nilai (sebelum PPN)'], rowsT, { right: [3, 4], total: ['', 'Jumlah', '', '100%', rp(harga + p.um$ - p.um$)] })}<p class="kecil">Catatan: bobot Uang Muka tidak ditambahkan pada total karena dikembalikan melalui potongan termin.</p>`)}
${pasal(5, 'Jaminan', `<ol><li><b>Jaminan Pelaksanaan</b> sebesar 5% dari Nilai Kontrak, yaitu ${rp(jaminan)}, diterbitkan bank umum atau perusahaan asuransi penjaminan, berlaku sampai 90 hari kalender setelah masa pelaksanaan berakhir.</li><li><b>Jaminan Uang Muka</b> sebesar ${rp(Math.round(p.um$ * 1.11))} (uang muka termasuk PPN), diterbitkan sebelum pencairan uang muka.</li><li><b>Retensi</b> 5% dari setiap pembayaran ditahan dan dicairkan setelah masa pemeliharaan selesai (FHO), atau diganti Jaminan Pemeliharaan.</li></ol>`)}
${pasal(6, 'Denda Keterlambatan', `<p>Bila pekerjaan tidak selesai tepat waktu karena kesalahan PIHAK KEDUA, dikenakan denda <b>1&permil; (satu per seribu)</b> dari Nilai Kontrak per hari keterlambatan, paling banyak 5% dari Nilai Kontrak (${rp(dendaMax)}). Lebih dari itu, PIHAK KESATU berhak memutus kontrak dan mencairkan Jaminan Pelaksanaan.</p>`)}
${pasal(7, 'Asuransi dan Keselamatan Kerja', `<p>PIHAK KEDUA wajib menyediakan asuransi <i>Contractor's All Risk</i> (CAR) dan <i>Third Party Liability</i> selama pelaksanaan, mendaftarkan seluruh tenaga kerja pada BPJS Ketenagakerjaan, serta menerapkan Sistem Manajemen Keselamatan Konstruksi (SMKK) sesuai dokumen RKK yang telah disetujui.</p>`)}
${pasal(8, 'Pekerjaan Tambah Kurang dan Perubahan', `<p>Perubahan lingkup, volume, atau waktu hanya sah bila dituangkan dalam Addendum yang ditandatangani kedua pihak (Contract Change Order). Total perubahan nilai tidak melebihi 10% dari Nilai Kontrak.</p>`)}
${pasal(9, 'Keadaan Kahar dan Penyelesaian Perselisihan', `<p>Keadaan kahar (bencana alam, kebakaran, huru-hara, kebijakan pemerintah) wajib dilaporkan tertulis dalam 14 hari. Perselisihan diselesaikan musyawarah, lalu mediasi/arbitrase di Badan Arbitrase Nasional Indonesia (BANI) Jakarta.</p>`)}
${ttd({ jabatan: 'PIHAK KESATU<br>PPK ' + PUPR.nama.split(' ')[0] + ' PUPR', nama: PUPR.pejabat, ket: 'NIP ' + PUPR.nip }, { jabatan: 'PIHAK KEDUA<br>Direktur Utama', nama: KBN.dirut, ket: KBN.nama }, 'Cikarang Pusat')}`) });
}

// 2. Addendum I P1
{
  const p = P1, tambahN = 870000000, kurangN = 270000000;
  out.push({ f: 'P1 - Addendum I Kontrak Gedung Kantor PUPR (CCO-01 dan Perpanjangan Waktu).pdf', html: page(PUPR.warna, kop(PUPR) + `<h1>ADDENDUM I</h1><div class="k">atas Surat Perjanjian Nomor ${p.noKontrak} tanggal ${tgl(p.tglKontrak)}<br>Nomor Addendum: ${p.noKontrak.replace('012', '012-ADD1')}</div>
<p>Pada hari ${hari('2026-10-12')} tanggal ${tgl('2026-10-12')}, ${PUPR.pejabat} selaku PPK (Pihak Kesatu) dan ${KBN.dirut} selaku Direktur Utama ${KBN.nama} (Pihak Kedua) sepakat mengubah perjanjian sebagai berikut, berdasarkan Berita Acara Rapat Pembahasan Kontrak Perubahan tanggal 6 Oktober 2026 dan rekomendasi Konsultan Pengawas.</p>
${pasal(1, 'Perubahan Lingkup (Contract Change Order No. 01)', `<p><b>Pekerjaan tambah:</b></p>${tabel(['No', 'Uraian', 'Nilai (sebelum PPN)'], [['1', 'Penambahan lift barang dan shaft lift lantai 1-4', rp(410000000)], ['2', 'Penebalan pelat atap dak dan waterproofing tambahan (perubahan desain struktur)', rp(285000000)], ['3', 'Penambahan titik hidran halaman dan pompa jockey (rekomendasi Dinas Pemadam Kebakaran)', rp(175000000)]], { right: [2], total: ['', 'Jumlah pekerjaan tambah', rp(tambahN)] })}<p><b>Pekerjaan kurang:</b></p>${tabel(['No', 'Uraian', 'Nilai (sebelum PPN)'], [['1', 'Pengurangan pekerjaan paving halaman belakang (ditunda ke tahun anggaran berikut)', rp(190000000)], ['2', 'Penyesuaian spesifikasi plafon lobi', rp(80000000)]], { right: [2], total: ['', 'Jumlah pekerjaan kurang', rp(kurangN)] })}`)}
${pasal(2, 'Perubahan Nilai Kontrak', `<p>Selisih pekerjaan tambah dan kurang adalah <b>${rp(tambahN - kurangN)}</b> sebelum PPN, ditambah PPN 11% ${rp(D.ppn(tambahN - kurangN))}, sehingga terjadi penambahan <b>${rp(tambahN - kurangN + D.ppn(tambahN - kurangN))}</b>. Dengan demikian:</p>${tabel(['Uraian', 'Sebelum PPN', 'PPN 11%', 'Nilai kontrak'], [['Nilai kontrak semula', rp(p.harga), rp(p.ppn), rp(p.kontrak)], ['Perubahan (addendum ini)', rp(tambahN - kurangN), rp(D.ppn(tambahN - kurangN)), rp(tambahN - kurangN + D.ppn(tambahN - kurangN))]], { right: [1, 2, 3], total: ['Nilai kontrak setelah Addendum I', rp(p.hargaAdd), rp(D.ppn(p.hargaAdd)), rp(p.kontrakAdd)] })}`)}
${pasal(3, 'Perpanjangan Waktu', `<p>Jangka waktu pelaksanaan ditambah <b>21 (dua puluh satu) hari kalender</b> akibat pekerjaan tambah dan curah hujan ekstrem Agustus-September 2026 (rata-rata 19 hari hujan per bulan). Batas akhir pelaksanaan berubah dari ${tgl(p.akhirAsli)} menjadi <b>${tgl(p.akhirAdd)}</b>. Penyedia wajib memperpanjang Jaminan Pelaksanaan, polis CAR, dan memperbarui jadwal pelaksanaan (Kurva S revisi) paling lambat 14 hari sejak addendum ditandatangani.</p>`)}
${pasal(4, 'Ketentuan Lain', `<p>Seluruh ketentuan dalam perjanjian awal yang tidak diubah tetap berlaku. Addendum ini merupakan bagian tidak terpisahkan dari Surat Perjanjian.</p>`)}
${ttd({ jabatan: 'PIHAK KESATU<br>PPK', nama: PUPR.pejabat, ket: 'NIP ' + PUPR.nip }, { jabatan: 'PIHAK KEDUA<br>Direktur Utama', nama: KBN.dirut, ket: KBN.nama }, 'Cikarang Pusat')}`) });
}

// 3. Kontrak P3 (swasta)
{
  const p = P3, jam = Math.round(p.kontrak * 0.05);
  out.push({ f: 'P3 - Perjanjian Pemborongan Ruko Mutiara Square (017-MPS-KBN).pdf', html: page(MPS.warna, kop(MPS) + `<h1>PERJANJIAN PEMBORONGAN PEKERJAAN</h1><div class="k">Nomor: ${p.noKontrak}<br><b>${p.nama}</b></div>
<p>Pada ${hari(p.tglKontrak)}, ${tgl(p.tglKontrak)}, di Bekasi, para pihak: (1) <b>${MPS.pejabat}</b>, ${MPS.jabatan} <b>${MPS.nama}</b>, selanjutnya <b>PEMILIK PROYEK</b>; dan (2) <b>${KBN.dirut}</b>, Direktur Utama <b>${KBN.nama}</b>, selanjutnya <b>KONTRAKTOR</b>, sepakat:</p>
${pasal(1, 'Pekerjaan', `<p>KONTRAKTOR membangun 8 (delapan) unit ruko 3 lantai tipe 5x15 m (total luas bangunan sekitar 1.440 m2) di ${p.lokasi}, secara <i>lump sum fixed price</i> termasuk bahan, upah, alat, dan seluruh pengurusan perizinan pelaksanaan, sesuai gambar kerja dan spesifikasi teknis lampiran perjanjian.</p>`)}
${pasal(2, 'Harga Pemborongan', `<p>Harga Pemborongan <b>${rp(p.kontrak)}</b> (${terbilang(p.kontrak)}), terdiri atas harga ${rp(p.harga)} dan PPN 11% ${rp(p.ppn)}. Harga bersifat tetap, kecuali perubahan lingkup tertulis yang disetujui PEMILIK PROYEK.</p>`)}
${pasal(3, 'Waktu Pelaksanaan', `<p>${p.hari} hari kalender, mulai ${tgl(p.spmk)} dan selesai ${tgl(p.akhirAsli)}. Serah terima pertama paling lambat tanggal tersebut, masa pemeliharaan 120 hari kalender.</p>`)}
${pasal(4, 'Cara Pembayaran', `<p>Uang muka 15% = ${rp(Math.round(p.harga * 0.15))}. Selanjutnya termin berdasarkan prestasi, dibayar maksimal 10 hari kalender setelah tagihan dan Berita Acara Opname disetujui Konsultan MK:</p>${tabel(['Termin', 'Prestasi kumulatif', 'Bobot', 'Nilai (sebelum PPN)'], [['Uang muka', '-', '15%', rp(p.harga * 0.15)], ['Termin 1', '25%', '25%', rp(p.harga * 0.25)], ['Termin 2', '45%', '20%', rp(p.harga * 0.2)], ['Termin 3', '65%', '20%', rp(p.harga * 0.2)], ['Termin 4', '85%', '20%', rp(p.harga * 0.2)], ['Termin 5 (serah terima)', '100%', '10% (retensi 5% ditahan)', rp(p.harga * 0.1)]], { right: [3] })}<p class="kecil">Pengembalian uang muka 15% dipotong dari setiap termin.</p>`)}
${pasal(5, 'Denda dan Pemutusan', `<p>Keterlambatan dikenakan denda 1&permil; per hari dari harga pemborongan, maksimum 5% (${rp(jam)}). Pemilik Proyek dapat memberi Surat Teguran I, II, dan III dengan jeda masing-masing 7 hari; bila Teguran III tidak ditanggapi, perjanjian dapat diputus sepihak dan jaminan dicairkan.</p>`)}
${pasal(6, 'Jaminan', `<p>Jaminan Pelaksanaan 5% (${rp(jam)}) berupa Bank Garansi berlaku sampai 60 hari setelah serah terima pertama. Retensi 5% ditahan selama masa pemeliharaan.</p>`)}
${pasal(7, 'Keselamatan, Lingkungan, dan Tenaga Kerja', `<p>KONTRAKTOR menanggung seluruh kecelakaan kerja, wajib mengikuti peraturan K3 dan ketertiban kawasan, serta mengasuransikan pekerjaan melalui polis CAR dengan nilai pertanggungan sama dengan harga pemborongan.</p>`)}
${ttd({ jabatan: 'PEMILIK PROYEK', nama: MPS.pejabat, ket: MPS.nama }, { jabatan: 'KONTRAKTOR', nama: KBN.dirut, ket: KBN.nama }, 'Bekasi')}`) });
}

// 4. SPK P4
{
  const p = P4;
  out.push({ f: 'P4 - Surat Perintah Kerja Renovasi Gudang Prima Plastindo (SPK 0612).pdf', html: page(PLAST.warna, kop(PLAST) + `<h1>SURAT PERINTAH KERJA (SPK)</h1><div class="k">Nomor: ${p.noKontrak}</div>
${meta([['Pekerjaan', `<b>${p.nama}</b>`], ['Lokasi', p.lokasi], ['Pelaksana', `${KBN.nama} (${KBN.alamat})`], ['Tanggal SPK', tgl(p.tglKontrak)], ['Mulai kerja', tgl(p.spmk)], ['Selesai', `${tgl(p.akhirAsli)} (${p.hari} hari kalender)`], ['Nilai pekerjaan', `<b>${rp(p.kontrak)}</b> (harga ${rp(p.harga)} + PPN 11% ${rp(p.ppn)})`]])}
<h2>Lingkup pekerjaan</h2><ol><li>Pembongkaran dinding dan atap gudang lama seluas 650 m2, serta pemindahan instalasi listrik sementara.</li><li>Pengecoran lantai kerja industri (floor hardener) 1.800 m2, tebal 20 cm, mutu beton K-300, beban 5 ton/m2.</li><li>Struktur baja portal WF, penutup atap sandwich panel, dan talang.</li><li>Pekerjaan MEP: panel utama, instalasi penerangan LED high-bay, sprinkler.</li><li>Pengecatan, marka lantai, dan pembersihan akhir.</li></ol>
<h2>Syarat pembayaran</h2>${tabel(['Tahap', 'Syarat', 'Persentase', 'Nilai (sebelum PPN)'], [['Uang muka', 'Setelah SPK ditandatangani', '20%', rp(p.harga * 0.2)], ['Tahap 2', 'Progres fisik 40%', '25%', rp(p.harga * 0.25)], ['Tahap 3', 'Progres fisik 70%', '25%', rp(p.harga * 0.25)], ['Tahap 4', 'Progres fisik 95% dan uji fungsi', '20%', rp(p.harga * 0.2)], ['Pelunasan', 'Serah terima (BAST) dan masa garansi 60 hari', '10%', rp(p.harga * 0.1)]], { right: [2, 3] })}
<h2>Ketentuan</h2><ul><li>Pekerjaan tidak boleh mengganggu jalur produksi: pekerjaan bising dilaksanakan Sabtu-Minggu dan pukul 18.00-06.00.</li><li>Seluruh pekerja wajib induksi K3 pabrik dan memakai APD lengkap.</li><li>Denda keterlambatan 2&permil; per hari dari nilai SPK, maksimum 5%.</li><li>Garansi pekerjaan 12 bulan sejak BAST; garansi atap 5 tahun.</li></ul>
${ttd({ jabatan: 'Pemberi Pekerjaan', nama: PLAST.pejabat, ket: PLAST.jabatan + ', ' + PLAST.nama }, { jabatan: 'Pelaksana', nama: KBN.dirut, ket: 'Direktur Utama, ' + KBN.nama }, 'Cikarang')}`) });
}

// 5. Subkontrak struktur P1
{
  const harga = 5800000000, tot = harga + D.ppn(harga), s = V.pilar;
  out.push({ f: 'P1 - Perjanjian Subkontrak Struktur Beton CV Pilar Beton Mandiri (SK-STR-01).pdf', html: page(KBN.warna, kop(KBN) + `<h1>PERJANJIAN SUBKONTRAK PEKERJAAN STRUKTUR</h1><div class="k">Nomor: 031/KBN/SUBK/P1/III/2026 &middot; Proyek: ${P1.nama}</div>
<p>Pada ${tgl('2026-03-20')}, ${KBN.nama} diwakili ${KBN.dirops}, Direktur Operasional (<b>KONTRAKTOR UTAMA</b>) dan <b>${s.nama}</b> diwakili ${s.pj}, Direktur (<b>SUBKONTRAKTOR</b>, ${s.alamat}), sepakat:</p>
${pasal(1, 'Lingkup', `<p>Subkontraktor mengerjakan pekerjaan <b>struktur beton bertulang lantai 1 sampai atap</b>: pembesian (fabrikasi dan pemasangan), bekisting dan perancah, pengecoran, perawatan beton, serta pembersihan, dengan material beton ready-mix dan besi ulir disuplai Kontraktor Utama. Volume terukur: beton 3.920 m3, pembesian 428 ton, bekisting 21.600 m2.</p>`)}
${pasal(2, 'Nilai', `<p>Nilai subkontrak <b>${rp(tot)}</b> (${terbilang(tot)}), terdiri atas harga ${rp(harga)} dan PPN 11% ${rp(D.ppn(harga))}. Sistem harga satuan upah dan alat, diukur bersama (opname) tiap bulan.</p>${tabel(['Item', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'], [['Upah pembesian', '428.000', 'kg', rp(1950), rp(428000 * 1950)], ['Bekisting dan perancah', '21.600', 'm2', rp(121000), rp(21600 * 121000)], ['Pengecoran dan perawatan', '3.920', 'm3', rp(165000), rp(3920 * 165000)], ['Alat bantu (scaffolding, vibrator, concrete pump operator)', '1', 'ls', rp(harga - (428000 * 1950 + 21600 * 121000 + 3920 * 165000)), rp(harga - (428000 * 1950 + 21600 * 121000 + 3920 * 165000))]], { right: [1, 3, 4], total: ['Jumlah (sebelum PPN)', '', '', '', rp(harga)] })}`)}
${pasal(3, 'Waktu', `<p>Pelaksanaan 6 April sampai 15 Desember 2026 mengikuti jadwal induk proyek. Keterlambatan karena kesalahan Subkontraktor dikenakan denda 1&permil; per hari dari nilai subkontrak, maksimum 5%.</p>`)}
${pasal(4, 'Pembayaran', `<p>Dibayar berdasarkan opname bulanan yang disetujui Pengawas, dikurangi retensi 5% dan pengembalian uang muka 10% (${rp(harga * 0.1)}). Pembayaran 21 hari kalender setelah invoice lengkap (faktur pajak, berita acara opname, bukti setor BPJS) diterima. PPh Pasal 4(2) jasa konstruksi dipotong Kontraktor Utama.</p>`)}
${pasal(5, 'K3 dan Tenaga Kerja', `<p>Subkontraktor menyediakan tenaga kerja bersertifikat (tukang besi, operator, ahli K3 konstruksi), APD, dan mendaftarkan seluruh pekerja ke BPJS Ketenagakerjaan. Pelanggaran K3 berat (pekerja tanpa harness di ketinggian) dikenai sanksi Rp 2.500.000 per kejadian dan penghentian kerja.</p>`)}
${pasal(6, 'Jaminan', `<p>Retensi 5% dicairkan 90 hari setelah serah terima pekerjaan struktur. Subkontraktor menjamin mutu beton K-350 sesuai uji laboratorium; beton tidak memenuhi syarat wajib dibongkar atau diperkuat atas biaya Subkontraktor.</p>`)}
${ttd({ jabatan: 'KONTRAKTOR UTAMA', nama: KBN.dirops, ket: KBN.nama }, { jabatan: 'SUBKONTRAKTOR', nama: s.pj, ket: s.nama }, 'Bekasi')}`) });
}

// 6. Subkontrak MEP P1
{
  const harga = 7500000000, tot = harga + D.ppn(harga), s = V.mep;
  out.push({ f: 'P1 - Perjanjian Subkontrak MEP PT Elektrika Mekanikal Utama (SK-MEP-01).pdf', html: page(V.mep.warna, kop(KBN) + `<h1>PERJANJIAN SUBKONTRAK PEKERJAAN MEKANIKAL, ELEKTRIKAL, DAN PLUMBING</h1><div class="k">Nomor: 044/KBN/SUBK/P1/IV/2026 &middot; ${P1.nama}</div>
<p>Pada ${tgl('2026-04-13')}, <b>${KBN.nama}</b> (KONTRAKTOR UTAMA) dan <b>${s.nama}</b>, ${s.alamat}, diwakili ${s.pj} (SUBKONTRAKTOR) sepakat atas hal berikut.</p>
${pasal(1, 'Lingkup', `<p>Pengadaan dan pemasangan: (a) instalasi listrik tegangan rendah, panel LVMDP dan SDP, genset 400 kVA; (b) tata udara VRF dan ventilasi; (c) plumbing air bersih, air kotor, STP kapasitas 30 m3/hari; (d) fire alarm, hidran, dan sprinkler; (e) lift penumpang 2 unit. Termasuk uji fungsi, commissioning, gambar <i>as built</i>, dan pelatihan operator.</p>`)}
${pasal(2, 'Nilai', `<p><b>${rp(tot)}</b> (${terbilang(tot)}) termasuk PPN 11% ${rp(D.ppn(harga))}; harga sebelum PPN ${rp(harga)}.</p>${tabel(['Paket', 'Nilai (sebelum PPN)'], [['Listrik dan genset', rp(2350000000)], ['Tata udara (VRF dan ventilasi)', rp(1680000000)], ['Plumbing dan STP', rp(1120000000)], ['Proteksi kebakaran', rp(980000000)], ['Lift penumpang 2 unit', rp(1370000000)]], { right: [1], total: ['Jumlah', rp(harga)] })}`)}
${pasal(3, 'Pembayaran', `<p>Uang muka 15% (${rp(harga * 0.15)}) setelah jaminan uang muka. Termin berikutnya berdasarkan prestasi: 30%, 55%, 80%, dan 95% terpasang, sisa 5% setelah commissioning dan serah terima. Retensi 5% ditahan 180 hari.</p>`)}
${pasal(4, 'Jadwal dan Denda', `<p>Mobilisasi 3 Agustus 2026, pemasangan dan uji fungsi selesai paling lambat 31 Desember 2026 (jadwal induk proyek berakhir 30 Januari 2027 setelah Addendum I; penyesuaian jadwal subkontrak dibahas lewat Berita Acara). Denda 1&permil; per hari, maksimum 5%.</p>`)}
${pasal(5, 'Garansi', `<p>Garansi peralatan 24 bulan sejak serah terima. Lift dan genset mengikuti garansi pabrikan minimal 24 bulan dengan layanan purna jual tertulis.</p>`)}
${ttd({ jabatan: 'KONTRAKTOR UTAMA', nama: KBN.dirops, ket: KBN.nama }, { jabatan: 'SUBKONTRAKTOR', nama: s.pj, ket: s.nama }, 'Jakarta')}`) });
}

// 7. PO besi P1
{
  const it = [['Besi ulir BjTS 420B D13 (12 m)', 18000, 'kg', 14350], ['Besi ulir BjTS 420B D16 (12 m)', 26500, 'kg', 14200], ['Besi ulir BjTS 420B D19 (12 m)', 31000, 'kg', 14150], ['Besi ulir BjTS 420B D22 (12 m)', 24000, 'kg', 14100], ['Wiremesh M8 (2,1 x 5,4 m)', 400, 'lembar', 618000]];
  const sub = it.reduce((a, [, q, , h]) => a + q * h, 0), pp = D.ppn(sub);
  out.push({ f: 'P1 - Purchase Order Besi Beton PT Baja Konstruksi Mandiri (PO-KBN-P1-10-0391).pdf', html: page(KBN.warna, kop(KBN) + `<h1>PURCHASE ORDER</h1><div class="k">No. PO/KBN/P1/10/0391 &middot; Tanggal ${tgl('2026-10-02')}</div>
${meta([['Kepada', `<b>${V.baja.nama}</b><br>${V.baja.alamat}`], ['Dikirim ke', `Proyek ${P1.pendek}, ${P1.lokasi} (Up. Logistik: Pak Darmawan)`], ['Referensi', 'Permintaan Material MR-P1-0911, Anggaran Biaya Bagian Struktur'], ['Syarat bayar', '<b>Net 30 hari</b> sejak barang diterima lengkap dan invoice asli diterima'], ['Pengiriman', '3 tahap: 7 Oktober, 14 Oktober, 21 Oktober 2026']])}
${tabel(['No', 'Uraian barang', 'Jumlah', 'Satuan', 'Harga satuan', 'Jumlah harga'], it.map(([n, q, s, h], i) => [String(i + 1), n, q.toLocaleString('id-ID'), s, rp(h), rp(q * h)]), { right: [2, 4, 5], total: ['', 'Subtotal', '', '', '', rp(sub)] })}
<table class="t" style="width:46%;margin-left:auto"><tr><td>PPN 11%</td><td class="r">${rp(pp)}</td></tr><tr class="tot"><td>TOTAL PO</td><td class="r">${rp(sub + pp)}</td></tr></table>
<h2>Ketentuan</h2><ol><li>Material wajib bersertifikat SNI 2052 dan dilengkapi mill certificate per batch; Kontraktor berhak menolak barang yang tidak sesuai atau berkarat berat.</li><li>Berat diverifikasi dengan jembatan timbang proyek; selisih lebih dari 0,5% ditagihkan/dikreditkan berdasarkan hasil timbang.</li><li>Keterlambatan pengiriman lebih dari 3 hari dikenakan denda 0,5% per hari dari nilai tahap terlambat.</li><li>Harga tetap selama masa PO. Faktur pajak diterbitkan paling lambat tanggal 15 bulan berikutnya.</li></ol>
${ttd({ jabatan: 'Disetujui<br>Direktur Operasional', nama: KBN.dirops, ket: KBN.nama }, { jabatan: 'Diterima<br>Pemasok', nama: '(tanda tangan dan cap)', ket: V.baja.nama }, 'Bekasi')}`) });
  out.po = { sub, pp, tot: sub + pp };
}

module.exports = out;
