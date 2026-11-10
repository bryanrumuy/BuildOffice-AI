'use strict';
// Kelompok 2: invoice masuk/keluar, bukti pajak, nota, bukti transfer.
const D = require('./data');
const U = require('./ui');
const { rp, tgl, terbilang, ppn, KBN, PUPR, MPS, V, P1, P2, P3, P4 } = D;
const { page, kop, tabel, meta, ttd, kotak } = U;

const out = [], n = {};
const bayarInfo = (bank) => `<p class="kecil">Pembayaran melalui transfer ke ${bank}. Mohon mencantumkan nomor invoice pada berita transfer. Faktur pajak mengikuti ketentuan e-Faktur.</p>`;

// 8. Invoice Termin III P1 (kita menagih Dinas PUPR)
{
  const prestasi = Math.round(P1.hargaAdd * 0.15), pp = ppn(prestasi), um = Math.round(prestasi * 0.2), ret = Math.round(prestasi * 0.05), neto = prestasi + pp - um - ret;
  n.t3p1 = { prestasi, pp, um, ret, neto };
  out.push({ f: 'P1 - Invoice Termin III ke Dinas PUPR (KBN-INV-P1-T3-2026-027).pdf', html: page(KBN.warna, kop(KBN) + `<h1>INVOICE / KWITANSI TAGIHAN TERMIN III</h1><div class="k">No. KBN/INV/P1/T3/2026/027 &middot; Tanggal ${tgl('2026-10-26')}</div>
${meta([['Kepada', `<b>${PUPR.nama}</b><br>u.p. ${PUPR.pejabat}, ${PUPR.jabatan}<br>${PUPR.alamat}`], ['Pekerjaan', `<b>${P1.nama}</b>`], ['Kontrak', `${P1.noKontrak} tgl ${tgl(P1.tglKontrak)}, Addendum I tgl ${tgl('2026-10-12')}`], ['Dasar tagihan', 'Berita Acara Pemeriksaan Pekerjaan (BAP) Termin III Nomor 600.1.15/BAP-T3/2026 tanggal 22 Oktober 2026, progres fisik kumulatif 70%'], ['Jatuh tempo', `<b>${tgl('2026-11-16')}</b> (14 hari kerja sejak tagihan diterima)`]])}
${tabel(['No', 'Uraian', 'Perhitungan', 'Jumlah'], [['1', 'Nilai kontrak setelah Addendum I (sebelum PPN)', '', rp(P1.hargaAdd)], ['2', 'Prestasi pekerjaan Termin III', '15% x ' + rp(P1.hargaAdd), rp(prestasi)], ['3', 'PPN 11% atas prestasi', '11% x ' + rp(prestasi), rp(pp)], ['', '<b>Jumlah tagihan bruto</b>', '', '<b>' + rp(prestasi + pp) + '</b>'], ['4', 'Dikurangi pengembalian uang muka', '20% x prestasi', '(' + rp(um) + ')'], ['5', 'Dikurangi retensi', '5% x prestasi', '(' + rp(ret) + ')']], { right: [3], total: ['', '<b>TOTAL TAGIHAN NETTO YANG DIBAYAR</b>', '', rp(neto)] })}
<p><b>Terbilang:</b> ${terbilang(neto)}.</p>
${kotak('<b>Catatan:</b> PPh Pasal 4 ayat (2) jasa konstruksi sebesar 3% dari prestasi (' + rp(Math.round(prestasi * 0.03)) + ') dipotong oleh Bendahara Pengeluaran dan dilaporkan dengan bukti potong; tidak dikurangkan dari total di atas. Akumulasi pembayaran sampai Termin III (termasuk uang muka) = ' + rp(Math.round(P1.hargaAdd * 0.7 + P1.um$ * 0)) + ' sebelum PPN, retensi tertahan sampai Termin III ' + rp(Math.round(P1.hargaAdd * 0.7 * 0.05)) + '.', 'kuning')}
${bayarInfo(KBN.bank + ' a.n. ' + KBN.nama)}
${ttd({ jabatan: 'Menyetujui<br>PPK', nama: PUPR.pejabat, ket: 'NIP ' + PUPR.nip }, { jabatan: 'Hormat kami<br>Direktur Keuangan', nama: KBN.dirkeu, ket: KBN.nama }, 'Cikarang')}`) });
}

// 9. Invoice Termin 1 P3 (kita menagih PT Mutiara Properti; sudah lewat jatuh tempo)
{
  const prestasi = Math.round(P3.harga * 0.25), pp = ppn(prestasi), um = Math.round(prestasi * 0.15), ret = Math.round(prestasi * 0.05), neto = prestasi + pp - um - ret;
  n.t1p3 = { prestasi, pp, um, ret, neto };
  out.push({ f: 'P3 - Invoice Termin 1 ke PT Mutiara Properti Sejahtera (KBN-INV-P3-T1-2026-019).pdf', html: page(KBN.warna, kop(KBN) + `<h1>INVOICE TERMIN 1</h1><div class="k">No. KBN/INV/P3/T1/2026/019 &middot; Tanggal ${tgl('2026-08-28')}</div>
${meta([['Kepada', `<b>${MPS.nama}</b><br>u.p. ${MPS.pejabat}, ${MPS.jabatan}<br>${MPS.alamat}`], ['Pekerjaan', `<b>${P3.nama}</b>`], ['Perjanjian', `${P3.noKontrak} tgl ${tgl(P3.tglKontrak)}`], ['Dasar tagihan', 'Berita Acara Opname No. 03/BAO/MK/VIII/2026 (Konsultan MK PT Cipta Manunggal Karya), prestasi 25,0%'], ['Jatuh tempo', `<b>${tgl('2026-09-07')}</b> (10 hari kalender sejak opname disetujui, Pasal 4)`]])}
${tabel(['No', 'Uraian', 'Perhitungan', 'Jumlah'], [['1', 'Harga pemborongan (sebelum PPN)', '', rp(P3.harga)], ['2', 'Prestasi Termin 1', '25% x ' + rp(P3.harga), rp(prestasi)], ['3', 'PPN 11%', '', rp(pp)], ['4', 'Pengembalian uang muka 15%', '15% x prestasi', '(' + rp(um) + ')'], ['5', 'Retensi 5%', '5% x prestasi', '(' + rp(ret) + ')']], { right: [3], total: ['', '<b>TOTAL TAGIHAN</b>', '', rp(neto)] })}
<p><b>Terbilang:</b> ${terbilang(neto)}.</p>${bayarInfo(KBN.bank)}
${kotak('<b>Status per 29 Oktober 2026:</b> belum dibayar, lewat jatuh tempo 52 hari. Telah dikirim surat pengingat pada 21 September dan 9 Oktober 2026.', 'merah')}
${ttd({ jabatan: 'Diterima<br>Pemilik Proyek', nama: '(tanda tangan, cap, tanggal)', ket: MPS.nama }, { jabatan: 'Hormat kami<br>Direktur Keuangan', nama: KBN.dirkeu, ket: KBN.nama }, 'Bekasi')}`) });
}

// 10. Invoice besi dari PT Baja Konstruksi Mandiri (hutang kita)
{
  const sub = Math.round(1658850000 * 0.6), pp = ppn(sub), tot = sub + pp;
  n.baja = { sub, pp, tot };
  const it = [['Besi ulir BjTS 420B D16 (pengiriman 14 Okt, SJ 4471)', 15900, 'kg', 14200], ['Besi ulir BjTS 420B D19 (pengiriman 14 Okt, SJ 4472)', 18600, 'kg', 14150], ['Besi ulir BjTS 420B D22 (pengiriman 21 Okt, SJ 4489)', 14400, 'kg', 14100], ['Wiremesh M8 (pengiriman 21 Okt, SJ 4490)', 240, 'lembar', 618000]];
  const jum = it.reduce((a, [, q, , h]) => a + q * h, 0);
  out.push({ f: 'P1 - Invoice PT Baja Konstruksi Mandiri INV-BKM-2610-0782 (tagihan besi tahap 2 dan 3).pdf', html: page(V.baja.warna, kop(V.baja) + `<h1>INVOICE / FAKTUR PENJUALAN</h1><div class="k">No. INV/BKM/2610/0782 &middot; Tanggal ${tgl('2026-10-25')}</div>
${meta([['Kepada', `<b>${KBN.nama}</b><br>${KBN.alamat}<br>NPWP ${KBN.npwp}`], ['Referensi', 'PO/KBN/P1/10/0391 tanggal 2 Oktober 2026 (Proyek Gedung Kantor PUPR)'], ['Syarat bayar', 'Net 30 hari'], ['Jatuh tempo', `<b>${tgl('2026-11-24')}</b>`]])}
${tabel(['No', 'Uraian (berat hasil timbang proyek)', 'Jumlah', 'Satuan', 'Harga satuan', 'Jumlah harga'], it.map(([x, q, s, h], i) => [String(i + 1), x, q.toLocaleString('id-ID'), s, rp(h), rp(q * h)]), { right: [2, 4, 5], total: ['', 'Subtotal', '', '', '', rp(jum)] })}
<table class="t" style="width:46%;margin-left:auto"><tr><td>PPN 11%</td><td class="r">${rp(ppn(jum))}</td></tr><tr class="tot"><td>TOTAL TAGIHAN</td><td class="r">${rp(jum + ppn(jum))}</td></tr></table>
${bayarInfo(V.baja.bank + ' a.n. ' + V.baja.nama)}<p class="kecil">Keterlambatan pembayaran dikenai bunga 1% per bulan. Tahap 1 (7 Oktober) telah ditagih dan dibayar melalui INV/BKM/2610/0731.</p>`) });
  n.baja = { sub: jum, pp: ppn(jum), tot: jum + ppn(jum) };
}

// 11. Invoice beton readymix
{
  const it = [['Beton K-350 slump 12 +/- 2 (pelat lantai 4 dan kolom atap)', 640, 'm3', 1285000], ['Beton K-300 slump 12 +/- 2 (balok ring dan tangga)', 120, 'm3', 1215000], ['Sewa concrete pump (trip)', 24, 'trip', 2350000], ['Tambahan biaya muatan kurang dari 5 m3 (minimum load)', 6, 'rit', 450000]];
  const sub = it.reduce((a, [, q, , h]) => a + q * h, 0), tot = sub + ppn(sub);
  n.rmx = { sub, tot };
  out.push({ f: 'P1 - Invoice PT Beton Prima Readymix INV-BPR-10-2291 (beton Oktober).pdf', html: page(V.rmx.warna, kop(V.rmx) + `<h1>INVOICE</h1><div class="k">No. BPR/INV/10/2291 &middot; Tanggal ${tgl('2026-10-27')}</div>
${meta([['Kepada', `<b>${KBN.nama}</b>, Proyek ${P1.pendek}`], ['Periode kirim', '5 sampai 24 Oktober 2026 (rekap surat jalan 118 lembar terlampir)'], ['Syarat bayar', 'Net 30 hari'], ['Jatuh tempo', `<b>${tgl('2026-11-26')}</b>`]])}
${tabel(['No', 'Uraian', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'], it.map(([x, q, s, h], i) => [String(i + 1), x, q.toLocaleString('id-ID'), s, rp(h), rp(q * h)]), { right: [2, 4, 5], total: ['', 'Subtotal', '', '', '', rp(sub)] })}
<table class="t" style="width:46%;margin-left:auto"><tr><td>PPN 11%</td><td class="r">${rp(ppn(sub))}</td></tr><tr class="tot"><td>TOTAL TAGIHAN</td><td class="r">${rp(tot)}</td></tr></table>
${kotak('Catatan mutu: hasil uji kuat tekan 28 hari untuk pengecoran 5 September (K-350) tercantum pada laporan lab terpisah. Klaim mutu harus diajukan tertulis maksimal 7 hari setelah hasil uji keluar.', 'kuning')}${bayarInfo(V.rmx.bank + ' a.n. ' + V.rmx.nama)}`) });
}

// 12. Invoice sewa alat berat
{
  const it = [['Sewa excavator PC200 (P2 drainase STA 4+000-9+500), 210 jam', 210, 'jam', 520000], ['Sewa vibro roller 12 ton (P2), 96 jam', 96, 'jam', 430000], ['Sewa tower crane TC-5013 (P1) bulan Oktober', 1, 'bulan', 78000000], ['Sewa mobile crane 25 ton (P1), 6 hari', 6, 'hari', 4500000], ['Mobilisasi dan demobilisasi low bed (2 trip)', 2, 'trip', 6750000]];
  const sub = it.reduce((a, [, q, , h]) => a + q * h, 0), tot = sub + ppn(sub);
  n.alat = { sub, tot };
  out.push({ f: 'P1 P2 - Invoice CV Alat Berat Sejahtera 2610-ABS-155 (sewa alat Oktober).pdf', html: page(V.alat.warna, kop(V.alat) + `<h1>INVOICE SEWA ALAT BERAT</h1><div class="k">No. ABS/2610/155 &middot; Tanggal ${tgl('2026-10-28')}</div>
${meta([['Kepada', `<b>${KBN.nama}</b>`], ['Periode', '1 sampai 28 Oktober 2026, berdasarkan Timesheet Alat yang ditandatangani operator dan pengawas lapangan'], ['Syarat bayar', 'Net 14 hari'], ['Jatuh tempo', `<b>${tgl('2026-11-11')}</b>`]])}
${tabel(['No', 'Uraian', 'Qty', 'Satuan', 'Tarif', 'Jumlah'], it.map(([x, q, s, h], i) => [String(i + 1), x, q.toLocaleString('id-ID'), s, rp(h), rp(q * h)]), { right: [2, 4, 5], total: ['', 'Subtotal', '', '', '', rp(sub)] })}
<table class="t" style="width:46%;margin-left:auto"><tr><td>PPN 11%</td><td class="r">${rp(ppn(sub))}</td></tr><tr class="tot"><td>TOTAL TAGIHAN</td><td class="r">${rp(tot)}</td></tr></table>
<p class="kecil">Tarif sudah termasuk operator dan perawatan; bahan bakar ditanggung penyewa. Alat standby karena hujan dihitung 50% tarif sesuai kesepakatan.</p>${bayarInfo(V.alat.bank + ' a.n. ' + V.alat.nama)}`) });
}

// 13. Invoice aspal
{
  const it = [['Campuran beras aspal panas AC-WC (loco AMP), pengiriman 12-23 Oktober', 2150, 'ton', 1248000], ['Aspal emulsi CRS-1 untuk tack coat', 18000, 'liter', 14600], ['Angkutan dump truck Cibarusah-lokasi (rata-rata 14 km)', 2150, 'ton', 38500]];
  const sub = it.reduce((a, [, q, , h]) => a + q * h, 0), tot = sub + ppn(sub);
  n.aspal = { sub, tot };
  out.push({ f: 'P2 - Invoice PT Aspal Nusantara Utama ANU-26-1043 (AC-WC dan tack coat).pdf', html: page(V.aspal.warna, kop(V.aspal) + `<h1>INVOICE</h1><div class="k">No. ANU/26/1043 &middot; Tanggal ${tgl('2026-10-26')}</div>
${meta([['Kepada', `<b>${KBN.nama}</b>, Proyek ${P2.pendek}`], ['Referensi', 'Kontrak pasokan No. 009/KBN/PASOK/P2/III/2026'], ['Syarat bayar', 'Net 30 hari'], ['Jatuh tempo', `<b>${tgl('2026-11-25')}</b>`]])}
${tabel(['No', 'Uraian', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'], it.map(([x, q, s, h], i) => [String(i + 1), x, q.toLocaleString('id-ID'), s, rp(h), rp(q * h)]), { right: [2, 4, 5], total: ['', 'Subtotal', '', '', '', rp(sub)] })}
<table class="t" style="width:46%;margin-left:auto"><tr><td>PPN 11%</td><td class="r">${rp(ppn(sub))}</td></tr><tr class="tot"><td>TOTAL TAGIHAN</td><td class="r">${rp(tot)}</td></tr></table>${bayarInfo(V.aspal.bank + ' a.n. ' + V.aspal.nama)}`) });
}

// 14. Invoice subkon struktur termin 4 (hutang kita)
{
  const prestasi = 612500000, pp = ppn(prestasi), um = 61250000, ret = 30625000, bayar = prestasi + pp - um - ret;
  n.pilar = { prestasi, pp, um, ret, bayar };
  out.push({ f: 'P1 - Invoice CV Pilar Beton Mandiri Termin 4 (opname Oktober, INV-PBM-0410).pdf', html: page(V.pilar.warna, kop(V.pilar) + `<h1>INVOICE TERMIN 4 (OPNAME OKTOBER 2026)</h1><div class="k">No. PBM/INV/0410/2026 &middot; Tanggal ${tgl('2026-10-28')}</div>
${meta([['Kepada', `<b>${KBN.nama}</b>`], ['Dasar', 'Perjanjian Subkontrak 031/KBN/SUBK/P1/III/2026; Berita Acara Opname Struktur No. 04/BAO-STR/P1/X/2026 tanggal 26 Oktober 2026'], ['Jatuh tempo', `<b>${tgl('2026-11-18')}</b> (21 hari sejak invoice lengkap)`]])}
${tabel(['No', 'Uraian pekerjaan periode ini', 'Prestasi'], [['1', 'Struktur kolom, balok, dan pelat lantai 4 (pembesian, bekisting, pengecoran)', rp(412500000)], ['2', 'Struktur dak atap dan tangga darurat', rp(200000000)]], { right: [2], total: ['', 'Prestasi pekerjaan periode ini', rp(prestasi)] })}
${tabel(['Uraian', 'Jumlah'], [['PPN 11%', rp(pp)], ['<b>Jumlah tagihan bruto</b>', '<b>' + rp(prestasi + pp) + '</b>'], ['Potongan pengembalian uang muka 10% (' + rp(prestasi) + ' x 10%)', '(' + rp(um) + ')'], ['Potongan retensi 5%', '(' + rp(ret) + ')']], { right: [1], total: ['<b>TOTAL YANG DIBAYAR</b>', rp(bayar)] })}
<p class="kecil">Akumulasi prestasi sampai Termin 4: ${rp(4350000000)} (75,0% dari harga subkontrak ${rp(5800000000)}). Faktur pajak dan bukti setor BPJS Ketenagakerjaan bulan Oktober terlampir.</p>${bayarInfo(V.pilar.bank + ' a.n. ' + V.pilar.nama)}`) });
}

// 15-16. Bukti setor pajak (sudah dibayar)
const ntpn = (s) => s.padEnd(16, 'X').slice(0, 16);
{
  const omset = 3528000000, pph = Math.round(omset * 0.03);
  n.pph = pph;
  out.push({ f: 'Pajak - Bukti Penerimaan Negara PPh Pasal 4(2) Final Jasa Konstruksi Masa September 2026.pdf', html: page('#1a237e', `<div style="border:3px double #1a237e;padding:16px"><div style="text-align:center"><b style="font:700 14pt Georgia;color:#1a237e">BUKTI PENERIMAAN NEGARA</b><br><span class="kecil">Direktorat Jenderal Pajak &middot; Kementerian Keuangan</span></div>
${meta([['NTPN', '<b>' + ntpn('7A1B90CE44F03D12') + '</b>'], ['NPWP', KBN.npwp], ['Nama Wajib Pajak', KBN.nama], ['Jenis pajak', 'PPh Pasal 4 ayat (2) &mdash; Final, Jasa Konstruksi (kode billing 411128-421)'], ['Masa pajak', 'September 2026'], ['Tanggal bayar', tgl('2026-10-14')], ['Cara bayar', 'Internet banking Bank Cipta Niaga, kode billing 820140775512088']])}
${tabel(['Dasar pengenaan (omzet September)', 'Tarif', 'PPh terutang'], [[rp(omset), '3,00% (kualifikasi usaha menengah, pelaksana konstruksi)', rp(pph)]], { right: [2], total: ['Jumlah disetor', '', rp(pph)] })}
<p class="kecil">Rincian omzet September: Opname Preservasi Jalan Cikarang-Cibarusah ${rp(2128000000)}; Tahap 3 Gudang Prima Plastindo ${rp(1400000000)}. Wajib dilaporkan dalam SPT Masa paling lambat 20 Oktober 2026.</p></div>`) });
}
{
  const keluaran = 388080000, masukan = 285540000, setor = keluaran - masukan;
  n.ppnSetor = setor;
  out.push({ f: 'Pajak - Bukti Penerimaan Negara PPN Masa September 2026 (SPT Masa PPN 1111).pdf', html: page('#1a237e', `<div style="border:3px double #1a237e;padding:16px"><div style="text-align:center"><b style="font:700 14pt Georgia;color:#1a237e">BUKTI PENERIMAAN NEGARA</b><br><span class="kecil">Direktorat Jenderal Pajak &middot; Kementerian Keuangan</span></div>
${meta([['NTPN', '<b>' + ntpn('3F92D1AA70C85B66') + '</b>'], ['NPWP', KBN.npwp], ['Nama Wajib Pajak', KBN.nama], ['Jenis pajak', 'PPN Dalam Negeri (kode billing 411211-100)'], ['Masa pajak', 'September 2026'], ['Tanggal bayar', tgl('2026-10-28')], ['Batas lapor SPT Masa PPN', tgl('2026-10-31')]])}
${tabel(['Uraian', 'Jumlah'], [['PPN keluaran (faktur pajak atas termin yang ditagihkan)', rp(keluaran)], ['PPN masukan yang dapat dikreditkan (material, subkon, sewa alat)', '(' + rp(masukan) + ')']], { right: [1], total: ['PPN kurang bayar yang disetor', rp(setor)] })}
<p class="kecil">Dilaporkan melalui e-Faktur dan SPT Masa PPN 1111 (pembetulan 0).</p></div>`) });
}

// PNG: nota BBM dan bukti transfer upah
out.png = [
  { f: 'P2 - Nota Pembelian Solar Industri Curah PT Energi Mitra Bahari 27 Okt (foto).png', w: 500, h: 430, html: page('#333', `<div style="background:#f4f1e8;padding:18px;font:11pt 'Courier New',monospace;width:470px;border:1px dashed #999"><div style="text-align:center"><b style="font-size:13pt">PT ENERGI MITRA BAHARI</b><br>Depot BBM Industri Cibitung<br>Jl. Raya Cibitung Km 3 &middot; NPWP 02.115.447.8-407.000</div><hr><div>FAKTUR PENJUALAN TUNAI<br>No : FPT/10/26/08812<br>Tgl: 27-10-2026 14:12<br>Kepada: KBN KONSTRUKSI (Proyek P2)<br>Truk tangki: B 9421 FXA</div><hr><table style="width:100%"><tr><td>HSD industri curah</td><td style="text-align:right">6.000 L</td></tr><tr><td>Harga/liter</td><td style="text-align:right">Rp 15.650</td></tr><tr><td>Jumlah</td><td style="text-align:right">Rp 93.900.000</td></tr><tr><td>PPN 11%</td><td style="text-align:right">Rp 10.329.000</td></tr><tr><td><b>TOTAL BAYAR</b></td><td style="text-align:right"><b>Rp 104.229.000</b></td></tr></table><hr><div>Pembayaran: TRANSFER LUNAS (bukti BCA terlampir)<br>Keperluan: excavator, vibro roller, dan genset proyek</div><div style="text-align:center;margin-top:10px">** TERIMA KASIH **<br>Lunas</div></div>`) },
  { f: 'P3 - Bukti Transfer Upah Borongan Mandor Sugeng Minggu ke-30 (foto).png', w: 470, h: 440, html: page('#333', `<div style="background:#eef2f7;padding:16px;width:430px"><div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px #0002;font:12pt Arial"><div style="background:#e6f4ea;color:#137333;border-radius:8px;padding:8px 12px;font-weight:700;text-align:center">TRANSFER BERHASIL</div><p style="text-align:center;font-size:22pt;margin:14px 0"><b>Rp 38.750.000</b></p><table style="font-size:11pt"><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Tanggal</td><td style="text-align:right;font-weight:600;border-bottom:1px solid #eee">24 Okt 2026, 16:05</td></tr><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Bank tujuan</td><td style="text-align:right;font-weight:600;border-bottom:1px solid #eee">Bank Nusa Artha</td></tr><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Penerima</td><td style="text-align:right;font-weight:600;border-bottom:1px solid #eee">SUGENG PRIYANTO</td></tr><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Rekening</td><td style="text-align:right;font-weight:600;border-bottom:1px solid #eee">****2208</td></tr><tr><td style="padding:6px 0;border-bottom:1px solid #eee">Berita</td><td style="text-align:right;font-weight:600;border-bottom:1px solid #eee">Upah borongan Ruko P3 mgg ke-30 tukang 42 org</td></tr><tr><td style="padding:6px 0">No. referensi</td><td style="text-align:right;font-weight:600">TRF20261024160500327</td></tr></table></div></div>`) },
];
out.n = n;
module.exports = out;
