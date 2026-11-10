'use strict';
// Kelompok 4: surat-menyurat, berita acara, tender, notulen, jaminan, polis, sertifikat, BPJS.
const D = require('./data');
const U = require('./ui');
const n2 = require('./docs2').n;
const { rp, tgl, tambah, hari, terbilang, KBN, PUPR, BINMAR, MPS, V, P1, P2, P3, P4 } = D;
const { page, kop, tabel, meta, ttd, pasal, kotak, surat } = U;

const out = [];

// 26. Surat Teguran I dari pemilik P3
out.push({ f: 'P3 - Surat Teguran I dari PT Mutiara Properti Sejahtera (012-MPS-ST1-X-2026).pdf', html: page(MPS.warna, surat(MPS, {
  nomor: '012/MPS/ST-1/X/2026', lamp: '1 berkas (rekap deviasi progres)', hal: 'SURAT TEGURAN I atas keterlambatan pelaksanaan pekerjaan', tanggal: '2026-10-23', kota: 'Bekasi',
  kepada: `Direktur Utama ${KBN.nama}<br>${KBN.alamat}`,
  isi: `<p>Memperhatikan Laporan Bulanan September 2026 dan hasil rapat lapangan tanggal 21 Oktober 2026 atas pekerjaan <b>${P3.nama}</b> (Perjanjian ${P3.noKontrak}), bersama ini kami sampaikan bahwa:</p>
<ol><li>Progres fisik kumulatif sampai pertengahan Oktober 2026 hanya <b>38,5%</b> dibandingkan rencana <b>51,0%</b>, atau terlambat <b>12,5 poin persentase</b> dan telah melampaui batas deviasi 10% yang ditetapkan dalam Pasal 5 perjanjian.</li><li>Dengan sisa waktu 64 hari kalender (batas serah terima ${tgl(P3.akhirAsli)}), laju pertumbuhan saat ini tidak memadai.</li><li>Kami memandang pembayaran Termin 1 (tagihan KBN/INV/P3/T1/2026/019 sebesar ${rp(n2.t1p3.neto)}) <b>akan diproses setelah rencana percepatan tertulis diterima dan disetujui Pemilik Proyek</b>.</li></ol>
<p>Dengan ini kami <b>menegur</b> KONTRAKTOR dan memerintahkan:</p><ol><li>Menyampaikan <b>rencana percepatan tertulis</b> (tambahan tenaga kerja, shift, dan jadwal revisi) selambat-lambatnya <b>${tgl('2026-10-30')}</b>.</li><li>Menambah tenaga kerja minimal 30% mulai ${tgl('2026-10-26')}.</li><li>Menyerahkan jadwal rinci minggu demi minggu sampai serah terima.</li></ol>
<p>Apabila tidak ada tanggapan memadai dalam 7 (tujuh) hari kalender, akan diterbitkan Surat Teguran II. Keterlambatan serah terima dikenai denda <b>1&permil; per hari</b> dari harga pemborongan (${rp(Math.round(P3.kontrak / 1000))} per hari), maksimum 5% (${rp(Math.round(P3.kontrak * 0.05))}).</p>`,
  ttdBlok: ttd({ jabatan: 'Hormat kami<br>Direktur Utama', nama: MPS.pejabat, ket: MPS.nama }, { jabatan: 'Tembusan', nama: 'Konsultan MK; Arsip', ket: '' }, '') })) });

// 27. Permohonan perpanjangan waktu P1
out.push({ f: 'P1 - Surat Permohonan Perpanjangan Waktu Pelaksanaan ke PPK Dinas PUPR (KBN-P1-EOT-09-2026).pdf', html: page(KBN.warna, surat(KBN, {
  nomor: 'KBN/P1/EOT/09/2026', lamp: '3 berkas (rekap cuaca, jadwal revisi, CCO usulan)', hal: 'Permohonan perpanjangan waktu pelaksanaan 21 hari kalender', tanggal: '2026-09-21', kota: 'Cikarang',
  kepada: `Yth. ${PUPR.jabatan}<br>${PUPR.nama}<br>${PUPR.alamat}`,
  isi: `<p>Menunjuk Surat Perjanjian ${P1.noKontrak} untuk pekerjaan <b>${P1.nama}</b>, dengan hormat kami mengajukan perpanjangan waktu pelaksanaan <b>21 (dua puluh satu) hari kalender</b>, dari ${tgl(P1.akhirAsli)} menjadi ${tgl(tambah(P1.akhirAsli, 21))}, dengan alasan berikut:</p>
${tabel(['Alasan', 'Uraian', 'Hari terdampak'], [['Curah hujan di atas rata-rata', 'Data BMKG Stasiun Cikarang: Agustus 19 hari hujan (rata-rata 12), September 20 hari hujan (rata-rata 11). Pengecoran dan pekerjaan luar tertunda', '14 hari'], ['Perubahan desain (usulan CCO-01)', 'Perubahan tebal pelat atap, penambahan shaft lift barang, dan hidran halaman atas rekomendasi Dinas Pemadam Kebakaran', '7 hari']], { right: [2] })}
<p>Dampak terhadap jadwal: progres kumulatif 31 Agustus 56,0% dan 15 September 59,3% dibandingkan rencana 66,0%. Jadwal revisi (Kurva S) terlampir menunjukkan penyelesaian pada ${tgl(tambah(P1.akhirAsli, 21))} dengan penambahan shift malam pada pekerjaan dalam.</p>
<p>Kami juga mohon pembahasan Contract Change Order No. 01 (usulan tambah ${rp(870000000)}, kurang ${rp(270000000)}) sebelum Addendum. Atas perhatian Bapak kami ucapkan terima kasih.</p>`,
  ttdBlok: ttd({ jabatan: 'Hormat kami<br>Direktur Utama', nama: KBN.dirut, ket: KBN.nama }, { jabatan: 'Tembusan', nama: 'Konsultan Pengawas; Manajer Proyek P1', ket: '' }, '') })) });

// 28. BAP Termin III P1
out.push({ f: 'P1 - Berita Acara Pemeriksaan Pekerjaan Termin III (BAP-T3-2026) Gedung Kantor PUPR.pdf', html: page(PUPR.warna, kop(PUPR) + `<h1>BERITA ACARA PEMERIKSAAN PEKERJAAN</h1><div class="k">Termin III &middot; Nomor 600.1.15/BAP-T3/2026</div>
<p>Pada hari ${hari('2026-10-22')} tanggal ${tgl('2026-10-22')}, yang bertanda tangan di bawah ini bersama-sama memeriksa pekerjaan <b>${P1.nama}</b> (Kontrak ${P1.noKontrak}, Addendum I):</p>
${meta([['Pejabat Pembuat Komitmen', PUPR.pejabat], ['Konsultan Pengawas', 'Ir. Taufik Hidayat (PT Cipta Manunggal Karya)'], ['Penyedia', `${KBN.dirut} (diwakili Ir. Wahyu Prasetyo, M.T., Manajer Proyek)`]])}
<h2>Hasil pemeriksaan</h2>${tabel(['No', 'Uraian pekerjaan', 'Bobot', 'Volume terpasang', 'Progres'], [['1', 'Persiapan dan struktur bawah', '12,0%', '100%', '12,0%'], ['2', 'Struktur atas lantai 1-4 dan dak', '30,0%', '96%', '28,8%'], ['3', 'Arsitektur', '25,0%', '61,5%', '15,4%'], ['4', 'MEP', '22,0%', '54%', '11,9%'], ['5', 'Lansekap dan utilitas luar', '11,0%', '18%', '2,0%']], { right: [2, 3, 4], total: ['', 'Progres fisik kumulatif', '', '', '<b>70,0%</b>'] })}
<p>Berdasarkan hasil pemeriksaan di lapangan, pekerjaan dinyatakan <b>memenuhi syarat pembayaran Termin III</b> (progres kumulatif minimal 70% menurut Pasal 4 kontrak). Catatan pengawas: (1) kolom as C-4 dan C-5 lantai 3 menunggu hasil core drill sebelum pembebanan; (2) perancah lantai 4 sudah diperiksa ulang; (3) jaminan pelaksanaan dan polis CAR agar diperpanjang sesuai Addendum I.</p>
<p>Nilai prestasi Termin III yang disetujui: <b>${rp(n2.t3p1.prestasi)}</b> (15% dari nilai kontrak sebelum PPN setelah Addendum I, ${rp(P1.hargaAdd)}).</p>
${ttd({ jabatan: 'PPK', nama: PUPR.pejabat, ket: 'NIP ' + PUPR.nip }, { jabatan: 'Penyedia<br>Manajer Proyek', nama: 'Ir. Wahyu Prasetyo, M.T.', ket: KBN.nama }, 'Cikarang')}<div class="ttd" style="margin-top:6px"><div>Konsultan Pengawas<div class="sp"></div><b><u>Ir. Taufik Hidayat</u></b></div></div>`) });

// 29. Undangan tender (pipeline)
out.push({ f: 'Tender - Undangan Pembuktian Kualifikasi Gedung Laboratorium Terpadu Politeknik Teknologi Cikarang (UND-0417-2026).pdf', html: page('#1a237e', kop({ nama: 'Pokja Pemilihan Politeknik Teknologi Cikarang', alamat: 'Kampus Politeknik, Jl. Teknologi No. 3, Cikarang Selatan', warna: '#1a237e' }) + `<h1>UNDANGAN PEMBUKTIAN KUALIFIKASI DAN PEMASUKAN DOKUMEN PENAWARAN</h1><div class="k">Nomor: 417/POKJA-PTC/PL/2026 &middot; ${tgl('2026-10-27')}</div>
<p>Kepada Yth. Direktur ${KBN.nama}. Berdasarkan hasil evaluasi administrasi, perusahaan Saudara dinyatakan <b>lulus prakualifikasi</b> dan diundang mengikuti seleksi pekerjaan konstruksi berikut:</p>
${meta([['Paket pekerjaan', '<b>Pembangunan Gedung Laboratorium Terpadu 5 Lantai</b>'], ['Kode tender', '2026-PTC-0417'], ['Metode', 'Tender, pascakualifikasi satu file, evaluasi sistem gugur'], ['Harga Perkiraan Sendiri (HPS)', '<b>' + rp(27480000000) + '</b> (termasuk PPN)'], ['Sumber dana', 'APBN DIPA Politeknik TA 2026-2027 (tahun jamak)'], ['Masa pelaksanaan', '420 hari kalender'], ['Kualifikasi', 'Besar; SBU Bangunan Gedung (BG004) kualifikasi Menengah atau Besar; SMK3 konstruksi; pengalaman gedung bertingkat 5 lantai dalam 4 tahun terakhir']])}
<h2>Jadwal</h2>${tabel(['Kegiatan', 'Tanggal dan waktu'], [['Penjelasan pekerjaan dan tinjau lokasi (aanwijzing)', tgl('2026-11-02') + ', 10.00 WIB'], ['Pembuktian kualifikasi (wajib dihadiri direksi)', tgl('2026-11-04') + ', 10.00 WIB'], ['<b>Batas akhir pemasukan dokumen penawaran</b>', '<b>' + tgl('2026-11-12') + ', pukul 14.00 WIB</b>'], ['Pembukaan dokumen penawaran', tgl('2026-11-12') + ', 14.30 WIB'], ['Pengumuman pemenang', tgl('2026-11-19')]], {})}
<h2>Persyaratan jaminan</h2><p>Jaminan penawaran sebesar <b>2% dari HPS = ${rp(549600000)}</b>, berlaku sampai 90 hari setelah batas akhir pemasukan penawaran, diterbitkan bank umum atau perusahaan asuransi penjaminan.</p>
${kotak('Catatan internal KBN: SBU perusahaan berakhir 18 Desember 2026 sehingga perpanjangan harus selesai sebelum pengumuman pemenang. Kebutuhan modal kerja proyek ini tidak boleh membebani proyek P3.', 'kuning')}`) });

// 30. Notulen rapat koordinasi P1
out.push({ f: 'P1 - Notulen Rapat Koordinasi Mingguan ke-34 Gedung Kantor PUPR 27 Oktober 2026.pdf', html: page(KBN.warna, kop(KBN) + `<h1>NOTULEN RAPAT KOORDINASI MINGGUAN KE-34</h1><div class="k">${P1.nama}<br>${hari('2026-10-27')}, ${tgl('2026-10-27')}, 09.30-11.45 WIB &middot; Direksi keet proyek</div>
${meta([['Dipimpin', 'Ir. Taufik Hidayat (Konsultan Pengawas)'], ['Hadir', 'PPK (Drs. H. Sukarman); KBN: Ir. Agus Hermawan, Ir. Wahyu Prasetyo, Ir. Dwi Handoko (K3); Subkon struktur (Slamet Riyadi); Subkon MEP (Ir. Rudi Hartono); QC lapangan'], ['Agenda', '1) Progres minggu ke-33; 2) Hasil uji beton K-350; 3) Lift dan MEP; 4) K3; 5) Administrasi addendum dan jaminan']])}
<h2>Pembahasan</h2><ol><li><b>Progres:</b> realisasi 71,8% terhadap rencana 78,5% (deviasi -6,7%). Pengawas meminta pertambahan shift malam untuk plesteran dan dinding lantai 3-4. KBN menyatakan komitmen 10,2% pertumbuhan November.</li><li><b>Uji beton:</b> hasil LHU-2026-1187 menunjukkan rata-rata 347 kg/cm2 (di bawah K-350). Disepakati core drill 6 titik oleh laboratorium terakreditasi paling lambat 7 November; pembebanan lantai di atas kolom as C-4/C-5 dihentikan sampai hasilnya keluar.</li><li><b>Lift:</b> kedatangan lift dari pabrikan mundur ke 20 November; subkon MEP mengusulkan pengiriman parsial. Pengawas meminta kepastian tertulis.</li><li><b>K3:</b> near miss perancah 14 Oktober sudah ditindaklanjuti; temuan terbuka rambu tangga darurat dan titik kumpul.</li><li><b>Administrasi:</b> Addendum I telah ditandatangani; KBN wajib memperpanjang jaminan pelaksanaan dan polis CAR. PPK menyatakan Termin III dalam proses, dokumen lengkap.</li></ol>
<h2>Tindak lanjut</h2>${tabel(['No', 'Tindak lanjut', 'PIC', 'Batas waktu'], [['1', 'Core drill 6 titik kolom C-4, C-5, D-4 dan laporan uji', 'QC KBN', '7 Nov 2026'], ['2', 'Kirim klaim mutu tertulis ke PT Beton Prima Readymix', 'Mgr Proyek', '9 Nov 2026'], ['3', 'Jadwal revisi pekerjaan arsitektur lantai 3-4 (shift malam)', 'Mgr Proyek', '3 Nov 2026'], ['4', 'Surat kepastian pengiriman lift dan jadwal pemasangan', 'Subkon MEP', '5 Nov 2026'], ['5', 'Endorsement jaminan pelaksanaan (BG-2026-0314) ke 30 April 2027', 'Dir. Keuangan', '13 Nov 2026'], ['6', 'Endorsement polis CAR proyek sesuai masa addendum', 'Dir. Keuangan', '13 Nov 2026'], ['7', 'Tutup temuan K3 terbuka (rambu, assembly point)', 'Ahli K3', '5 Nov 2026'], ['8', 'Susun dokumen Termin IV (progres 90%)', 'Mgr Proyek', 'Minggu I Des 2026']], {})}
<p class="kecil">Rapat berikutnya: ${tgl('2026-11-03')}, 09.30 WIB. Notulis: Admin Proyek P1.</p>`) });

// 31. Surat penagihan ke MPS (balasan)
out.push({ f: 'P3 - Surat Tanggapan Teguran I dan Penagihan Termin 1 ke PT Mutiara Properti Sejahtera (KBN-P3-27-X-2026).pdf', html: page(KBN.warna, surat(KBN, {
  nomor: 'KBN/P3/TGP/X/2026', lamp: 'Rencana percepatan; salinan invoice dan rekap pengingat', hal: 'Tanggapan atas Surat Teguran I dan penagihan Termin 1', tanggal: '2026-10-27', kota: 'Bekasi',
  kepada: `${MPS.jabatan} ${MPS.nama}<br>${MPS.alamat}`,
  isi: `<p>Menjawab Surat Teguran I Nomor 012/MPS/ST-1/X/2026 tanggal 23 Oktober 2026, kami sampaikan:</p>
<ol><li><b>Penyebab deviasi:</b> (a) perubahan denah unit 6-8 yang Saudara minta pada 28 Agustus 2026 menambah revisi struktur dan menahan pekerjaan 12 hari; (b) cuaca ekstrem 21 hari tidak efektif sejak Agustus; (c) tertundanya pembayaran Termin 1 sehingga pembelian material dan upah mandor harus kami talangi.</li><li><b>Rencana percepatan:</b> tambahan 30 tukang, shift lembur 2 jam, dan dua tim bekisting baru mulai 2 November, target progres kumulatif 49,5% akhir November dan 62,0% akhir Desember. Kami mohon <b>Addendum waktu 30 hari</b> (serah terima 25 Januari 2027) atas dasar perubahan denah.</li><li><b>Penagihan:</b> Termin 1 sebesar <b>${rp(n2.t1p3.neto)}</b> (invoice KBN/INV/P3/T1/2026/019) telah jatuh tempo 7 September 2026 dan disetujui MK pada 28 Agustus. Pasal 4 perjanjian tidak mensyaratkan rencana percepatan untuk pencairan prestasi yang sudah diopname.</li></ol>
<p><b>Kami mohon pembayaran dilakukan paling lambat ${tgl('2026-11-05')}.</b> Apabila sampai tanggal tersebut belum dibayar, KBN Konstruksi akan menghentikan pekerjaan sementara mulai ${tgl('2026-11-09')} sesuai Pasal 5, dengan seluruh dampak waktu dan biaya menjadi tanggung jawab Pemilik Proyek.</p>`,
  ttdBlok: ttd({ jabatan: 'Hormat kami<br>Direktur Utama', nama: KBN.dirut, ket: KBN.nama }, { jabatan: 'Tembusan', nama: 'Konsultan MK; Direktur Keuangan; Arsip', ket: '' }, '') })) });

// 32. Surat klaim mutu ke pemasok beton
out.push({ f: 'P1 - Surat Klaim Mutu Beton K-350 ke PT Beton Prima Readymix (KBN-P1-KLAIM-10-2026).pdf', html: page(KBN.warna, surat(KBN, {
  nomor: 'KBN/P1/KLM/10/2026', lamp: 'Laporan LHU-2026-1187, rekap surat jalan 5 Sept', hal: 'Klaim mutu beton K-350 pengecoran 5 September 2026', tanggal: '2026-10-08', kota: 'Bekasi',
  kepada: `Direktur ${V.rmx.nama}<br>${V.rmx.alamat}`,
  isi: `<p>Merujuk pengecoran kolom, balok, dan pelat lantai 3 Gedung Kantor PUPR pada 5 September 2026 (surat jalan 0905-001 sampai 0905-062, volume 248 m3 beton K-350), laboratorium terakreditasi PT Geoteknik Laboratorium Nusa melaporkan kuat tekan 28 hari <b>rata-rata 347 kg/cm2</b> (benda uji terendah 336 kg/cm2), di bawah mutu K-350 yang dipesan.</p><p>Sesuai syarat PO dan klaim mutu dalam 7 hari sejak hasil uji (LHU diterbitkan 6 Oktober), kami <b>mengajukan klaim</b> dan meminta: (1) data mix design dan catatan batching untuk pengiriman tanggal tersebut; (2) partisipasi dalam pengujian core drill; (3) penanggungan biaya core drill dan perkuatan struktur bila terbukti mutu tidak sesuai; dan (4) <b>penahanan sementara</b> pembayaran invoice beton periode terkait sampai penyelesaian klaim.</p><p>Mohon tanggapan tertulis paling lambat 15 Oktober 2026.</p>`,
  ttdBlok: ttd({ jabatan: 'Hormat kami<br>Direktur Operasional', nama: KBN.dirops, ket: KBN.nama }, { jabatan: 'Tembusan', nama: 'Manajer Proyek P1; QC; Arsip', ket: '' }, '') })) });

// 33. Bank garansi jaminan pelaksanaan P1
{
  const nilai = Math.round(P1.kontrak * 0.05), akhir = tambah(P1.akhirAsli, 90);
  out.push({ f: 'P1 - Bank Garansi Jaminan Pelaksanaan Rp 1,93 Miliar (BG-2026-0314) Gedung Kantor PUPR.pdf', html: page(V.bank.warna, kop(V.bank) + `<h1>JAMINAN PELAKSANAAN (BANK GARANSI)</h1><div class="k">Nomor: BG/CNB/0314/2026 &middot; Tanggal terbit ${tgl('2026-03-12')}</div>
<p>Yang bertanda tangan di bawah ini, <b>${V.bank.nama}</b> (Bank), dengan ini menjamin kepada <b>${PUPR.nama}</b> (Penerima Jaminan) atas kewajiban <b>${KBN.nama}</b> (Terjamin) dalam pelaksanaan <b>${P1.nama}</b> berdasarkan Kontrak ${P1.noKontrak}.</p>
${meta([['Nilai jaminan', `<b>${rp(nilai)}</b> (${terbilang(nilai)}), yaitu 5% dari nilai kontrak ${rp(P1.kontrak)}`], ['Berlaku', `${tgl('2026-03-16')} sampai dengan <b>${tgl(akhir)}</b>`], ['Sifat jaminan', 'Tanpa syarat (<i>unconditional</i>), dapat dicairkan atas permintaan pertama tertulis (<i>on first demand</i>)'], ['Biaya penerbitan', `${rp(Math.round(nilai * 0.0125))} per tahun (1,25%), dibayar Terjamin`], ['Kontra garansi', `Deposito Terjamin ${rp(Math.round(nilai * 0.3))} (30%)`]])}
<p>Bank berjanji membayar sejumlah uang yang diminta, sampai maksimum nilai jaminan, dalam waktu 14 (empat belas) hari kerja setelah menerima surat tuntutan pencairan yang menyatakan Terjamin cidera janji. Jaminan ini berakhir otomatis pada tanggal berlaku di atas dan dikembalikan kepada Bank; setiap perpanjangan harus dimintakan tertulis selambatnya 30 hari sebelum berakhir.</p>
${kotak('<b>Catatan administrasi KBN:</b> Addendum I memperpanjang pelaksanaan 21 hari sehingga masa berlaku jaminan harus diperpanjang sampai <b>' + tgl(tambah(P1.akhirAdd, 90)) + '</b>. Batas pengajuan endorsement 13 November 2026.', 'kuning')}
${ttd({ jabatan: 'Penerima Jaminan', nama: '(PPK)', ket: PUPR.nama }, { jabatan: 'Bank<br>Kepala Cabang', nama: 'Heru Santoso', ket: V.bank.nama }, 'Jakarta')}`) });
}

// 34. Polis CAR P2
{
  const nilai = P2.kontrak, premi = Math.round(nilai * 0.003);
  out.push({ f: 'P2 - Polis Contractor All Risk Preservasi Jalan Cikarang-Cibarusah (CAR-2026-04471).pdf', html: page(V.asuransi.warna, kop(V.asuransi) + `<h1>POLIS ASURANSI CONTRACTOR'S ALL RISK (CAR)</h1><div class="k">Nomor polis: CAR/JP/2026/04471</div>
${meta([['Tertanggung', `<b>${KBN.nama}</b><br>${KBN.alamat}`], ['Pihak yang berkepentingan', BINMAR.nama + ' (pemilik pekerjaan)'], ['Pekerjaan', `<b>${P2.nama}</b>`], ['Lokasi risiko', P2.lokasi], ['Periode pertanggungan', `${tgl('2026-03-02')} sampai dengan <b>${tgl('2026-11-30')}</b> pukul 24.00 waktu setempat`], ['Nilai pertanggungan', `<b>${rp(nilai)}</b> (nilai kontrak termasuk PPN)`], ['Premi', `${rp(premi)} (0,30%), telah dibayar ${tgl('2026-03-05')}`], ['Masa pemeliharaan', '30 hari tambahan Pemeliharaan Standar (Maintenance Period) sejak berakhirnya masa konstruksi']])}
<h2>Jaminan</h2><ul><li>Seksi I: kerusakan material pada pekerjaan kontrak, termasuk akibat banjir, gempa, dan kebakaran.</li><li>Seksi II: tanggung jawab hukum pihak ketiga, batas ganti rugi ${rp(2000000000)} per kejadian dan agregat.</li></ul>
<h2>Risiko sendiri (deductible)</h2>${tabel(['Jenis klaim', 'Risiko sendiri'], [['Kerusakan material, risiko umum', '1% dari nilai klaim, minimum ' + rp(25000000)], ['Banjir dan gempa', '2,5% dari nilai klaim'], ['Tanggung jawab pihak ketiga', rp(15000000) + ' per kejadian']], { right: [1] })}
${kotak('<b>Perhatian:</b> kontrak berakhir ' + tgl(P2.akhir) + ' tetapi polis berakhir ' + tgl('2026-11-30') + '. Perpanjangan (endorsement) harus diajukan dan dibayar sebelum <b>20 November 2026</b> agar tidak ada periode pekerjaan tanpa jaminan selama 26 hari. Estimasi premi tambahan Rp 7.800.000.', 'merah')}
${ttd({ jabatan: 'Tertanggung', nama: KBN.dirkeu, ket: KBN.nama }, { jabatan: 'Penanggung', nama: 'Rini Kusumawardani', ket: V.asuransi.nama + ', Kepala Underwriting' }, 'Jakarta')}`) });
}

// 35. SBU
out.push({ f: 'Izin - Sertifikat Badan Usaha SBU Konstruksi PT Karya Bumi Nusantara (berlaku s.d. 18 Des 2026).pdf', html: page(V.lsbu.warna, `<div style="border:4px double ${V.lsbu.warna};padding:20px">${kop(V.lsbu)}<h1>SERTIFIKAT BADAN USAHA JASA PELAKSANA KONSTRUKSI (SBU)</h1><div class="k">Nomor registrasi: ${KBN.sbu}</div>
<p>Lembaga Sertifikasi Badan Usaha, setelah melakukan penilaian kesesuaian, menyatakan bahwa badan usaha berikut memenuhi persyaratan kompetensi dan berhak melaksanakan pekerjaan konstruksi pada klasifikasi dan kualifikasi di bawah ini:</p>
${meta([['Nama badan usaha', `<b>${KBN.nama}</b>`], ['Alamat', KBN.alamat], ['NPWP', KBN.npwp], ['Penanggung jawab badan usaha', KBN.dirut], ['Tanggal terbit', tgl('2024-12-19')], ['Masa berlaku', '<b>sampai dengan ' + tgl('2026-12-18') + '</b> (dua tahun)']])}
${tabel(['No', 'Subklasifikasi', 'Kode', 'Kualifikasi', 'Batas nilai pekerjaan'], [['1', 'Jasa pelaksana konstruksi bangunan gedung hunian dan non-hunian', 'BG004', 'Menengah (M2)', 'Sampai Rp 50 miliar'], ['2', 'Jasa pelaksana konstruksi jalan raya (kecuali jalan layang)', 'SI001', 'Menengah (M2)', 'Sampai Rp 50 miliar'], ['3', 'Jasa pelaksana pekerjaan konstruksi bangunan industri', 'BG005', 'Kecil (K3)', 'Sampai Rp 10 miliar'], ['4', 'Jasa pelaksana pekerjaan drainase dan sanitasi', 'SI003', 'Kecil (K3)', 'Sampai Rp 10 miliar']], {})}
<h2>Syarat pemeliharaan sertifikat</h2><ul><li>Tenaga ahli bersertifikat (SKK) minimal 6 orang aktif dan tercatat.</li><li>Laporan keuangan tahun terakhir diaudit akuntan publik.</li><li>Kegiatan usaha tidak melampaui batas nilai kualifikasi; kontrak berjalan terbesar saat ini ${rp(P1.kontrakAdd)} (P1) masih di bawah batas M2.</li></ul>
<p class="kecil">Perpanjangan harus diajukan paling lambat 60 hari sebelum masa berlaku berakhir (yaitu sebelum 19 Oktober 2026) untuk menghindari jeda sertifikat; pengajuan terlambat dikenakan penilaian ulang penuh.</p>
${ttd({ jabatan: 'Pemegang Sertifikat', nama: KBN.dirut, ket: KBN.nama }, { jabatan: 'Direktur Lembaga', nama: 'Prof. Ir. Bachtiar Aziz, M.Eng.', ket: V.lsbu.nama }, 'Jakarta')}</div>`) });

// 36. Tagihan BPJS Ketenagakerjaan
{
  const rows = [['JKK (Jaminan Kecelakaan Kerja), risiko sangat tinggi 1,74%', 612400000, 0.0174], ['JKM (Jaminan Kematian) 0,30%', 612400000, 0.003], ['JHT (Jaminan Hari Tua) 5,7%', 487200000, 0.057], ['JP (Jaminan Pensiun) 3%', 361900000, 0.03]];
  const jum = rows.reduce((a, [, u, t]) => a + Math.round(u * t), 0);
  n2.bpjs = jum;
  out.push({ f: 'BPJS Ketenagakerjaan - Tagihan Iuran Periode Oktober 2026 (TG-1026-0021874).pdf', html: page(V.bpjs.warna, kop(V.bpjs) + `<h1>TAGIHAN IURAN JAMINAN SOSIAL KETENAGAKERJAAN</h1><div class="k">No. Tagihan TG/10/2026/0021874 &middot; Periode Oktober 2026 &middot; Tanggal ${tgl('2026-10-26')}</div>
${meta([['Peserta (pemberi kerja)', `<b>${KBN.nama}</b> &mdash; Kode perusahaan 40012876`], ['Jumlah tenaga kerja terdaftar', '1.036 orang (staf 74, tenaga proyek 962)'], ['Jatuh tempo', `<b>${tgl('2026-11-15')}</b>`], ['Virtual account', '8816 4001 2876 1026']])}
${tabel(['Program', 'Upah dasar iuran', 'Tarif', 'Iuran'], rows.map(([a, u, t]) => [a, rp(u), (t * 100).toFixed(2).replace('.', ',') + '%', rp(Math.round(u * t))]), { right: [1, 2, 3], total: ['TOTAL IURAN YANG HARUS DIBAYAR', '', '', rp(jum)] })}
<p class="kecil">Keterlambatan pembayaran dikenakan denda 2% per bulan dan dapat mengakibatkan penonaktifan kepesertaan (hak jaminan pekerja tidak dapat dicairkan). Pembayaran melalui virtual account semua bank mitra.</p>`) });
}

module.exports = out;
