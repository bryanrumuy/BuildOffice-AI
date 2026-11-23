'use strict';
/**
 * Uji alur utama lewat HTTP: dokumen (unggah/baca demo/verifikasi/unduh/hapus), tagihan (jatuh tempo & terlambat, lunas, CSV),
 * proyek (upsert + peringatan), tugas (buat/status), rapat (notulen tanpa AI -> tugas), hasil agen, dan berkas buatan agen.
 * Semua tanpa kunci AI (mode demo); fitur yang butuh AI hanya diuji penolakannya.
 * Jalankan: node tests/alur-test.js  (server di SALINAN sementara dengan data kosong; data asli tidak disentuh)
 */
const fs = require('fs'), path = require('path');
const { penghitung, mulaiServer, klien, jalankanDi, tungguSampai } = require('./bantu/server-sementara');

const { cek, selesai } = penghitung();
const AKUN = 'uji:sandi-uji-1|admin,staf1:sandi-staf-1|staf,lihat:sandi-lihat-1|pengamat';
const hariIni = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const geserHari = (n) => { const d = new Date(Date.parse(hariIni() + 'T00:00:00Z') + n * 86400000); return d.toISOString().slice(0, 10); };
const ID_HASIL = '11111111-2222-4333-8444-555555555555';

/** Data awal di salinan uji: satu hasil perintah agen, dan berkas buatan agen dibuat lewat lib/berkas.js (tanpa AI). */
function siapkan(dir) {
  fs.writeFileSync(path.join(dir, 'data', 'hasil.json'), JSON.stringify([{ id: ID_HASIL, instruksi: 'Buat ringkasan tagihan', docs: [{ id: 'd1', nama: 'Invoice A.pdf' }], konteks: true, langkah: [], berkas: [],
    hasil: '## Ringkasan\n\n- **Tagihan A** jatuh tempo besok', angkaDitandai: false, oleh: 'uji', t: new Date().toISOString(), model: 'uji', agen: 'Staf Umum' }]));
  const kode = `(async () => { const b = require('./lib/berkas'); const out = {};
    for (const [nama, format, isi] of [['Laporan Uji', 'txt', { teks: '# Judul\\nIsi **tebal**' }], ['Data Rumus', 'csv', { baris: [['Nama', 'Nilai'], ['=HYPERLINK("http://x")', '-5'], ['+cmd', '12,5']] }],
      ['Surat Uji', 'docx', { teks: '# Surat\\n\\nIsi surat.' }], ['Tabel Uji', 'xlsx', { baris: [['Item', 'Jumlah'], ['Semen', 10], ['Pasir', 5]] }], ['Halaman', 'html', { teks: '# Hai\\n<script>alert(1)</script>' }],
      ['../../jahat', 'txt', { teks: 'nama berbahaya' }], ['Salah', 'exe', { teks: 'x' }], ['Kosong', 'txt', { teks: '  ' }]]) {
      const r = await b.simpan({ nama, format, ...isi, oleh: 'uji', sumber: 'uji', kantor: 'PT Uji', namaPenulis: 'Staf Umum' });
      out[nama] = r.error ? { error: r.error } : r.value; }
    console.log(JSON.stringify(out)); })().catch((e) => { console.error(e); process.exit(1); });`;
  const r = jalankanDi(dir, kode);
  return { status: r.status, hasil: (() => { try { return JSON.parse(r.out.trim().split('\n').pop()); } catch { return null; } })(), out: r.out };
}

async function ujiDokumen(s, staf, admin, lihat) {
  const teks = 'INVOICE No: INV-UJI-001\nPT Beton Uji Sejahtera\nTanggal 2026-01-05\nTotal Rp 5.000.000\nJatuh tempo 2026-02-01\n';
  const fd = new FormData();
  fd.append('files', new Blob([teks], { type: 'text/plain' }), 'Invoice Beton Uji.txt');
  fd.append('files', new Blob(['%PDF-1.4\n%uji\n'], { type: 'application/pdf' }), 'Kontrak Uji.pdf');
  const up = await staf.post('/api/docs', fd);
  cek('dokumen: unggah 2 file (teks + PDF) oleh staf -> 200', up.status === 200 && up.json.docs.length === 2 && up.json.rejected.length === 0, up.teks.slice(0, 200));
  cek('dokumen: storedName (nama file di disk) tidak pernah dikirim ke klien', up.json.docs.every((d) => !('storedName' in d)));
  const inv = up.json.docs.find((d) => d.originalName === 'Invoice Beton Uji.txt'), pdf = up.json.docs.find((d) => d.mime === 'application/pdf');
  cek('dokumen: jenis file dikenali dari isi (text/plain, application/pdf)', inv && inv.mime === 'text/plain' && pdf && pdf.status === 'diproses', JSON.stringify(up.json.docs.map((d) => d.mime)));

  const biner = new FormData(); biner.append('files', new Blob([Buffer.from([0x4d, 0x5a, 0x00, 0x01, 0x00])]), 'program.exe');
  const tolak = await staf.post('/api/docs', biner);
  cek('dokumen: file biner tak dikenal ditolak -> 400 + rejected', tolak.status === 400 && tolak.json.rejected[0] === 'program.exe' && tolak.json.docs.length === 0, tolak.teks);
  const besar = new FormData(); besar.append('files', new Blob([Buffer.alloc(16 * 1024 * 1024, 'a')]), 'besar.txt');
  cek('dokumen: file > 15 MB -> 413', (await staf.post('/api/docs', besar)).status === 413);

  const docs = await tungguSampai(async () => { const r = await staf.get('/api/docs'); return r.json.every((d) => d.status !== 'diproses') ? r.json : null; }, 30000);
  cek('dokumen: pipeline demo selesai membaca semua dokumen (tanpa AI)', Boolean(docs), 'masih diproses');
  const d = (docs || []).find((x) => x.id === inv.id) || {};
  cek('dokumen: hasil baca demo -> status belum_diverifikasi, mode demo', d.status === 'belum_diverifikasi' && d.mode === 'demo', d.status + ' ' + d.mode);
  cek('dokumen: ekstraksi demo (invoice, nilai 5 jt, jatuh tempo, nomor, pihak, arah keluar)', d.data && d.data.jenis === 'invoice' && d.data.nilai_angka === 5000000 && d.data.jatuh_tempo === '2026-02-01'
    && d.data.nomor === 'INV-UJI-001' && /PT Beton Uji/.test(d.data.pihak || '') && d.data.arah_uang === 'keluar', JSON.stringify(d.data));

  const tg = (await staf.get('/api/tagihan')).json.filter((t) => t.docId === inv.id);
  cek('dokumen -> tagihan: invoice membuat 1 tagihan otomatis "Pembayaran invoice" (bayar, 5 jt)', tg.length === 1 && tg[0].auto === true && tg[0].label === 'Pembayaran invoice' && tg[0].arah === 'bayar' && tg[0].jumlah === 5000000, JSON.stringify(tg));
  const rem = (await staf.get('/api/reminders')).json;
  cek('dokumen -> pengingat: tagihan invoice tercatat terlambat (sisa_hari < 0), dokumennya tidak diingatkan dua kali',
    rem.some((r) => r.kind === 'tagihan' && r.docId === inv.id && r.sisa_hari < 0) && !rem.some((r) => r.kind === 'dokumen' && r.docId === inv.id), JSON.stringify(rem.slice(0, 3)));

  cek('verifikasi: pengamat -> 403', (await lihat.patch('/api/docs/' + inv.id, { data: {} })).status === 403);
  cek('verifikasi: id tak dikenal -> 404', (await staf.patch('/api/docs/tidak-ada', { data: {} })).status === 404);
  const v = await staf.patch('/api/docs/' + inv.id, { data: { nilai_angka: 6000000, judul: 'Invoice Beton (dikoreksi)', jenis: 'bukan-jenis' } });
  cek('verifikasi: staf menyimpan koreksi -> ok', v.status === 200 && v.json.ok === true, v.teks);
  const d2 = (await staf.get('/api/docs')).json.find((x) => x.id === inv.id);
  cek('verifikasi: status terverifikasi + pemverifikasi tercatat, jenis tak dikenal dinormalkan', d2.status === 'terverifikasi' && d2.verifiedBy === 'staf1' && d2.data.judul === 'Invoice Beton (dikoreksi)' && d2.data.jenis === 'lainnya', JSON.stringify(d2).slice(0, 300));
  const v2 = await staf.patch('/api/docs/' + inv.id, { data: { jenis: 'invoice' } });
  const tg2 = (await staf.get('/api/tagihan')).json.filter((t) => t.docId === inv.id);
  cek('verifikasi: tagihan otomatis dibuat ulang dengan nilai koreksi (tidak ganda)', v2.status === 200 && tg2.length === 1 && tg2[0].jumlah === 6000000, JSON.stringify(tg2));

  const f = await staf.get('/api/docs/' + inv.id + '/file');
  cek('unduh dokumen: isi asli, attachment, CSP sandbox', f.status === 200 && f.teks === teks && /attachment/.test(f.header.get('content-disposition')) && /sandbox/.test(f.header.get('content-security-policy')), f.status);
  cek('unduh dokumen: id tak dikenal -> 404', (await staf.get('/api/docs/tidak-ada/file')).status === 404);
  cek('ulang dokumen: hanya untuk dokumen gagal -> 400', (await staf.post('/api/docs/' + inv.id + '/retry', {})).status === 400);

  cek('hapus dokumen: staf -> 403', (await staf.del('/api/docs/' + pdf.id)).status === 403);
  const h = await admin.del('/api/docs/' + inv.id);
  const sisa = (await admin.get('/api/docs')).json, tg3 = (await admin.get('/api/tagihan?status=semua')).json.filter((t) => t.docId === inv.id);
  cek('hapus dokumen: admin -> dokumen & tagihan belum lunasnya ikut hilang', h.status === 200 && !sisa.some((x) => x.id === inv.id) && tg3.length === 0, JSON.stringify(tg3));
  cek('hapus dokumen: id yang sudah dihapus -> 404', (await admin.del('/api/docs/' + inv.id)).status === 404);
}

async function ujiTagihan(staf, admin) {
  const salah = await Promise.all([staf.post('/api/tagihan', { tanggal: '2030-01-01', jumlah: 1000 }), staf.post('/api/tagihan', { label: 'Tanpa tanggal', jumlah: 1000 }),
    staf.post('/api/tagihan', { label: 'Tanggal rusak', tanggal: '01/02/2030', jumlah: 1000 }), staf.post('/api/tagihan', { label: 'Nol', tanggal: '2030-01-01', jumlah: 0 })]);
  cek('tagihan: tanpa keterangan / tanggal / format tanggal salah / jumlah 0 -> 400', salah.every((r) => r.status === 400), salah.map((r) => r.status).join());

  const telat = await staf.post('/api/tagihan', { label: 'Sewa alat berat', tanggal: geserHari(-10), jumlah: 'Rp 1.500.000', arah: 'bayar', pihak: 'CV Alat', kategori: 'Operasional' });
  cek('tagihan: dibuat 201, jumlah teks Rupiah diurai jadi 1500000', telat.status === 201 && telat.json.jumlah === 1500000 && telat.json.status === 'belum' && telat.json.kategori === 'Operasional', telat.teks);
  const nanti = await staf.post('/api/tagihan', { label: 'Termin 2 dari pemilik', tanggal: geserHari(20), jumlah: 25000000, arah: 'tagih', kategori: 'Bukan Kategori' });
  cek('tagihan: arah tagih, kategori tak dikenal -> null', nanti.status === 201 && nanti.json.arah === 'tagih' && nanti.json.kategori === null, nanti.teks);
  const lain = await staf.post('/api/tagihan', { label: 'Arah belum jelas', tanggal: geserHari(40), jumlah: 1000, arah: 'lainnya' });

  const rem = (await staf.get('/api/reminders')).json;
  const rT = rem.find((r) => r.id === telat.json.id), rN = rem.find((r) => r.id === nanti.json.id);
  cek('tagihan terlambat: sisa_hari -10 (tanda terlambat)', rT && rT.sisa_hari === -10, JSON.stringify(rT));
  cek('tagihan: yang belum jatuh tempo sisa_hari 20, pengingat diurutkan dari yang paling mendesak', rN && rN.sisa_hari === 20 && rem.indexOf(rT) < rem.indexOf(rN));
  const dash = (await staf.get('/api/dashboard')).json;
  cek('dasbor: tagihan.terlambat menghitung tagihan yang lewat tempo', dash.tagihan.terlambat >= 1 && dash.tagihan.bayar30 >= 1500000 && dash.tagihan.tagih30 === 25000000, JSON.stringify(dash.tagihan));
  cek('dasbor: mendesak memuat tagihan terlambat', dash.mendesak.some((r) => r.id === telat.json.id));

  const ubah = await staf.patch('/api/tagihan/' + nanti.json.id, { jumlah: 30000000 });
  cek('tagihan: ubah jumlah -> 200', ubah.status === 200 && ubah.json.jumlah === 30000000, ubah.teks);
  cek('tagihan: arah "lainnya" tidak bisa dilunasi -> 400', (await staf.post('/api/tagihan/' + lain.json.id + '/lunas', {})).status === 400);
  const lunas = await staf.post('/api/tagihan/' + telat.json.id + '/lunas', { tanggal: hariIni() });
  cek('tagihan: lunasi -> status lunas', lunas.status === 200 && lunas.json.status === 'lunas' && lunas.json.lunasAt === hariIni(), lunas.teks);
  const kas = (await staf.get('/api/kas')).json.find((k) => k.tagihanId === telat.json.id);
  cek('tagihan: pelunasan membuat transaksi kas keluar terverifikasi', kas && kas.arah === 'keluar' && kas.jumlah === 1500000 && kas.status === 'terverifikasi', JSON.stringify(kas));
  cek('tagihan: lunasi dua kali -> 400', (await staf.post('/api/tagihan/' + telat.json.id + '/lunas', {})).status === 400);
  cek('tagihan: ubah tagihan lunas -> 400', (await staf.patch('/api/tagihan/' + telat.json.id, { jumlah: 1 })).status === 400);
  const l = (await staf.get('/api/tagihan?status=lunas')).json, b = (await staf.get('/api/tagihan')).json;
  cek('tagihan: filter status lunas / belum', l.some((t) => t.id === telat.json.id) && !b.some((t) => t.id === telat.json.id) && b.some((t) => t.id === nanti.json.id));
  cek('tagihan: yang sudah lunas tidak lagi diingatkan', !(await staf.get('/api/reminders')).json.some((r) => r.id === telat.json.id));
  cek('tagihan: id tak dikenal -> 404', (await staf.post('/api/tagihan/tidak-ada/lunas', {})).status === 404);

  await staf.post('/api/tagihan', { label: '=HYPERLINK("http://jahat")', tanggal: geserHari(5), jumlah: 1000 });
  const c = await staf.get('/api/tagihan.csv');
  cek('CSV tagihan: attachment, pemisah sep=;, rumus Excel dinetralkan', c.status === 200 && /attachment/.test(c.header.get('content-disposition')) && c.teks.includes('sep=;') && c.teks.includes(`"'=HYPERLINK`) && !c.teks.includes('";"=HYPERLINK'), c.teks.slice(0, 200));

  cek('tagihan: hapus oleh admin -> 200, lalu 404', (await admin.del('/api/tagihan/' + lain.json.id)).status === 200 && (await admin.del('/api/tagihan/' + lain.json.id)).status === 404);
  // Kas manual: draft -> verifikasi
  const k = await staf.post('/api/kas', { uraian: 'Beli semen', jumlah: '250.000', kategori: 'Material', tanggal: hariIni() });
  const kv = k.json && await staf.post('/api/kas/' + k.json.id + '/verify', {});
  cek('kas: catat manual -> draft, lalu verifikasi -> terverifikasi', k.status === 201 && k.json.status === 'draft' && k.json.jumlah === 250000 && kv.json.status === 'terverifikasi', k.teks);
}

async function ujiProyek(staf, admin, lihat) {
  const salah = await Promise.all([staf.post('/api/proyek', { bulan: '2026-09', progres: 10 }), staf.post('/api/proyek', { nama: 'Gedung', bulan: '2026-13', progres: 10 }),
    staf.post('/api/proyek', { nama: 'Gedung', bulan: '2026-09', progres: 120 }), staf.post('/api/proyek', { nama: 'Gedung', bulan: '2026-09' })]);
  cek('proyek: tanpa nama / bulan salah / progres > 100 / tanpa progres -> 400', salah.every((r) => r.status === 400), salah.map((r) => r.status).join());
  cek('proyek: pengamat -> 403', (await lihat.post('/api/proyek', { nama: 'X', bulan: '2026-09', progres: 1 })).status === 403);

  const a = await staf.post('/api/proyek', { nama: 'Gedung Kantor Uji', bulan: '2026-09', progres: '40', rencana: 42, anggaran: 'Rp 1.000.000.000', realisasi: 380000000 });
  cek('proyek: data bulan pertama -> 201', a.status === 201 && typeof a.json.id === 'string', a.teks);
  let p = (await staf.get('/api/proyek')).json.find((x) => x.id === a.json.id);
  cek('proyek: deviasi -2 & serapan 38% -> aman tanpa peringatan', p && p.status.level === 'aman' && p.status.peringatan.length === 0 && p.periode[0].deviasi === -2 && p.periode[0].serapan === 38, JSON.stringify(p && p.status));

  const b = await staf.post('/api/proyek', { nama: '  gedung KANTOR uji ', bulan: '2026-10', progres: 50, rencana: 58, anggaran: 1000000000, realisasi: 560000000 });
  p = (await staf.get('/api/proyek')).json.find((x) => x.id === a.json.id);
  cek('proyek: nama dicocokkan tanpa beda huruf/spasi (upsert ke proyek yang sama)', b.json.id === a.json.id && p.periode.length === 2 && (await staf.get('/api/proyek')).json.length === 1);
  cek('proyek: terlambat 8 poin + biaya mendahului fisik + makin memburuk -> waspada, 3 peringatan', p.status.level === 'waspada' && p.status.peringatan.length === 3
    && p.status.peringatan.some((w) => /Terlambat 8 poin/.test(w)) && p.status.peringatan.some((w) => /Biaya terserap 6 poin/.test(w)) && p.status.peringatan.some((w) => /makin besar dibanding 2026-09/.test(w)), JSON.stringify(p.status));

  await staf.post('/api/proyek', { nama: 'Gedung Kantor Uji', bulan: '2026-10', progres: 45, rencana: 58 });
  p = (await staf.get('/api/proyek')).json.find((x) => x.id === a.json.id);
  cek('proyek: bulan yang sama diganti (bukan ditambah), deviasi -13 -> bahaya', p.periode.length === 2 && p.periode[1].progres === 45 && p.status.level === 'bahaya', JSON.stringify(p.status));
  await staf.post('/api/proyek', { nama: 'Ruko Aman', bulan: '2026-10', progres: 60, rencana: 60 });
  const daftar = (await staf.get('/api/proyek')).json, dash = (await staf.get('/api/dashboard')).json;
  cek('proyek: daftar diurutkan dari yang paling berisiko; dasbor menghitung berisiko/bahaya', daftar[0].nama === 'Gedung Kantor Uji' && daftar[1].nama === 'Ruko Aman' && dash.proyek.jumlah === 2 && dash.proyek.berisiko === 1 && dash.proyek.bahaya === 1, JSON.stringify(dash.proyek));

  cek('proyek: hapus satu bulan (admin) -> 200; bulan tak ada -> 404', (await admin.del(`/api/proyek/${a.json.id}/periode/2026-09`)).status === 200 && (await admin.del(`/api/proyek/${a.json.id}/periode/2026-09`)).status === 404);
  const ruko = daftar.find((x) => x.nama === 'Ruko Aman');
  cek('proyek: hapus proyek (admin) -> 200, lalu 404', (await admin.del('/api/proyek/' + ruko.id)).status === 200 && (await admin.del('/api/proyek/' + ruko.id)).status === 404);
}

async function ujiTugas(staf, admin, lihat) {
  const salah = await Promise.all([staf.post('/api/tugas', { deskripsi: 'tanpa judul' }), staf.post('/api/tugas', { judul: 'X', tenggat: '17-11-2026' }), staf.post('/api/tugas', { judul: 'X', pemilik: 'bos besar' }),
    staf.post('/api/tugas', { judul: 'X', pemilik: 'agen:tidak-ada' }), staf.post('/api/tugas', { judul: 'X', pemilik: 'agen:penerima' }), staf.post('/api/tugas', { judul: 'X', status: 'selesai' })]);
  cek('tugas: tanpa judul / tenggat salah / pemilik salah / agen tak dikenal / agen alur dokumen -> 400', salah.slice(0, 5).every((r) => r.status === 400), salah.map((r) => r.status).join());
  cek('tugas: status tak dikenal saat dibuat -> 400', salah[5].status === 400, salah[5].teks);

  const t = await staf.post('/api/tugas', { judul: 'Cek opname besi', deskripsi: 'Lantai 3', pemilik: 'manusia:Site Manager', tenggat: geserHari(-2) });
  cek('tugas: dibuat 201 dengan status todo dan riwayat "dibuat"', t.status === 201 && t.json.status === 'todo' && t.json.oleh === 'staf1' && t.json.riwayat[0].aksi === 'dibuat', t.teks);
  const ag = await staf.post('/api/tugas', { judul: 'Rekap tagihan', pemilik: 'agen:pelaksana' });
  cek('tugas: boleh diberikan ke agen penerima tugas (agen:pelaksana)', ag.status === 201 && ag.json.pemilik === 'agen:pelaksana', ag.teks);

  const st = (await staf.get('/api/dashboard')).json.tugas;
  cek('tugas: tenggat lewat -> dihitung terlambat di dasbor', st.terlambat >= 1, JSON.stringify(st));
  cek('tugas: muncul di pengingat sebagai jenis "tugas"', (await staf.get('/api/reminders')).json.some((r) => r.kind === 'tugas' && r.id === t.json.id));

  const doing = await staf.patch('/api/tugas/' + t.json.id, { status: 'doing' });
  cek('tugas: todo -> doing, riwayat mencatat perubahan status', doing.status === 200 && doing.json.status === 'doing' && doing.json.riwayat.some((x) => x.aksi === 'status' && /todo → doing/.test(x.ket)), JSON.stringify(doing.json && doing.json.riwayat));
  cek('tugas: status tak dikenal -> 400', (await staf.patch('/api/tugas/' + t.json.id, { status: 'beres' })).status === 400);
  cek('tugas: pengamat tidak boleh mengubah -> 403', (await lihat.patch('/api/tugas/' + t.json.id, { status: 'done' })).status === 403);
  const done = await staf.patch('/api/tugas/' + t.json.id, { status: 'done' });
  cek('tugas: doing -> done', done.status === 200 && done.json.status === 'done');
  cek('tugas: filter ?status=done', (await staf.get('/api/tugas?status=done')).json.map((x) => x.id).join() === t.json.id);
  cek('tugas: selesai tidak lagi diingatkan', !(await staf.get('/api/reminders')).json.some((r) => r.id === t.json.id));
  cek('tugas: id tak dikenal -> 404', (await staf.patch('/api/tugas/tidak-ada', { status: 'done' })).status === 404);

  const kerja = await staf.post('/api/tugas/' + t.json.id + '/kerjakan', {});
  cek('tugas: "kerjakan" tugas milik manusia -> 400 (tanpa memanggil AI)', kerja.status === 400 && /bukan milik agen/.test(kerja.json.error), kerja.teks);
  const semua = await staf.post('/api/tugas/kerjakan-semua', {});
  cek('tugas: "kerjakan semua" tanpa kunci AI -> 400 butuh mode AI', semua.status === 400 && /mode AI/.test(semua.json.error), semua.teks);
  cek('tugas: hapus oleh admin -> 200, lalu 404', (await admin.del('/api/tugas/' + ag.json.id)).status === 200 && (await admin.del('/api/tugas/' + ag.json.id)).status === 404);
}

async function ujiRapat(staf, admin) {
  await staf.post('/api/tagihan', { label: 'Retensi subkon', tanggal: geserHari(-3), jumlah: 2000000, arah: 'bayar' }); // ada yang terlambat -> Pengingat mengusulkan tindak lanjut
  const r = await staf.post('/api/rapat', { agenda: 'Bahas tagihan terlambat ' + 'x'.repeat(400) });
  const e = r.json || {};
  cek('rapat: tanpa AI -> 201, notulen dari data (tanpaAI)', r.status === 201 && e.tanpaAI === true && Array.isArray(e.percakapan) && e.percakapan.length >= 3, r.teks.slice(0, 200));
  cek('rapat: dipimpin manajer (pembuka & penutup), agenda dipotong 300 karakter', e.percakapan && e.percakapan[0].dari === 'manajer' && e.percakapan[e.percakapan.length - 1].dari === 'manajer' && e.agenda.length === 300);
  cek('rapat: tindak lanjut memuat tagihan terlambat (pemilik manusia, belum jadi tugas)', (e.tindak_lanjut || []).some((t) => /terlambat/.test(t.judul) && /^manusia:/.test(t.pemilik) && t.tugasId === null), JSON.stringify(e.tindak_lanjut));
  const list = (await staf.get('/api/rapat')).json;
  cek('rapat: notulen tersimpan dan terbaca di GET /api/rapat (terbaru dulu)', list[0] && list[0].id === e.id && list[0].oleh === 'staf1');
  const fileRapat = JSON.parse(fs.readFileSync(path.join(staf.dir, 'data', 'rapat.json'), 'utf8'));
  cek('rapat: tersimpan di data/rapat.json salinan uji', fileRapat.length === 1 && fileRapat[0].id === e.id);

  const i = (e.tindak_lanjut || []).findIndex((t) => /terlambat/.test(t.judul));
  const jadi = await staf.post(`/api/rapat/${e.id}/tugas`, { indeks: i });
  cek('rapat -> tugas: butir tindak lanjut jadi tugas 201', jadi.status === 201 && jadi.json.judul === e.tindak_lanjut[i].judul && /Dari rapat/.test(jadi.json.deskripsi), jadi.teks);
  cek('rapat -> tugas: nomor tugas dicatat di notulen', (await staf.get('/api/rapat')).json[0].tindak_lanjut[i].tugasId === jadi.json.id);
  cek('rapat -> tugas: butir yang sama kedua kali -> 400', (await staf.post(`/api/rapat/${e.id}/tugas`, { indeks: i })).status === 400);
  const salah = await Promise.all([staf.post(`/api/rapat/${e.id}/tugas`, { indeks: 99 }), staf.post(`/api/rapat/${e.id}/tugas`, { indeks: 'a' }), staf.post('/api/rapat/tidak-ada/tugas', { indeks: 0 })]);
  cek('rapat -> tugas: indeks tak ada -> 400, rapat tak ada -> 404', salah[0].status === 400 && salah[1].status === 400 && salah[2].status === 404, salah.map((x) => x.status).join());
  const tg = await admin.post(`/api/rapat/${e.id}/telegram`, {});
  cek('rapat: kirim notulen ke Telegram tanpa pengaturan -> 400 (tidak mengirim apa pun)', tg.status === 400 && /Telegram belum diatur/.test(tg.json.error), tg.teks);
}

async function ujiHasilDanBerkas(s, staf, admin, lihat, seed) {
  const h = (await lihat.get('/api/hasil')).json;
  cek('hasil agen: daftar terbaca (pengamat boleh)', h.length === 1 && h[0].id === ID_HASIL);
  const t = await lihat.get(`/api/hasil/${ID_HASIL}.txt`);
  cek('hasil agen: unduh .txt (attachment, teks polos tanpa Markdown)', t.status === 200 && /attachment; filename="hasil-agen-11111111\.txt"/.test(t.header.get('content-disposition')) && t.teks.startsWith('Perintah: Buat ringkasan tagihan')
    && t.teks.includes('Invoice A.pdf') && t.teks.includes('Tagihan A') && !t.teks.includes('**'), t.teks.slice(0, 200));
  cek('hasil agen: id tak dikenal -> 404', (await lihat.get('/api/hasil/tidak-ada.txt')).status === 404);
  const p = await staf.post('/api/perintah', { instruksi: 'Buat laporan' });
  cek('hasil agen: perintah baru tanpa kunci AI -> 400 butuh mode AI', p.status === 400 && /mode AI/.test(p.json.error), p.teks);
  cek('hasil agen: hapus staf -> 403, admin -> 200, lalu 404', (await staf.del('/api/hasil/' + ID_HASIL)).status === 403 && (await admin.del('/api/hasil/' + ID_HASIL)).status === 200 && (await admin.del('/api/hasil/' + ID_HASIL)).status === 404);

  const sh = seed.hasil || {};
  cek('berkas: lib/berkas membuat txt, csv, docx, xlsx, html tanpa AI', seed.status === 0 && ['Laporan Uji', 'Data Rumus', 'Surat Uji', 'Tabel Uji', 'Halaman'].every((n) => sh[n] && sh[n].id), seed.out.slice(0, 300));
  cek('berkas: format tak dikenal & isi kosong ditolak', sh.Salah && /Format tidak dikenal/.test(sh.Salah.error) && sh.Kosong && /kosong/.test(sh.Kosong.error), JSON.stringify([sh.Salah, sh.Kosong]));
  const jahat = sh['../../jahat'] || {};
  cek('berkas: nama berbahaya ("../../jahat") tanpa / atau \\, file disimpan dengan id acak di data/berkas', jahat.nama && !/[\\/]/.test(jahat.nama) && /jahat\.txt$/.test(jahat.nama)
    && fs.existsSync(path.join(s.dir, 'data', 'berkas', jahat.id + '.txt')), JSON.stringify(jahat));
  const daftar = (await lihat.get('/api/berkas')).json;
  cek('berkas: daftar terbaca (6 berkas)', daftar.length === 6, daftar.length);

  const un = async (nama) => lihat.get(`/api/berkas/${sh[nama].id}/unduh`);
  const txt = await un('Laporan Uji');
  cek('berkas txt: teks polos, attachment + nama UTF-8, nosniff', txt.status === 200 && /text\/plain/.test(txt.header.get('content-type')) && /attachment; filename="Laporan%20Uji\.txt"; filename\*=UTF-8''/.test(txt.header.get('content-disposition'))
    && txt.header.get('x-content-type-options') === 'nosniff' && txt.teks.includes('tebal') && !txt.teks.includes('**'), txt.teks);
  const csv = await un('Data Rumus');
  cek('berkas csv: BOM UTF-8, rumus (=, +) dinetralkan, angka negatif tetap', csv.status === 200 && csv.buf[0] === 0xef && csv.teks.includes(`'=HYPERLINK`) && csv.teks.includes(`'+cmd`) && /\r\n'?=?.*,-5\r\n/.test(csv.teks) && !/,'-5/.test(csv.teks), JSON.stringify(csv.teks));
  const docx = await un('Surat Uji'), xlsx = await un('Tabel Uji');
  cek('berkas docx/xlsx: arsip ZIP Office (PK) dengan Content-Type benar', docx.buf.slice(0, 2).toString() === 'PK' && /wordprocessingml/.test(docx.header.get('content-type')) && xlsx.buf.slice(0, 2).toString() === 'PK' && /spreadsheetml/.test(xlsx.header.get('content-type')));
  const html = await un('Halaman');
  cek('berkas html: diunduh sebagai attachment (tidak dirender), skrip dari isi di-escape', /attachment/.test(html.header.get('content-disposition')) && !html.teks.includes('<script>alert(1)</script>'), html.teks.slice(0, 120));
  cek('berkas: id tak dikenal -> 404', (await lihat.get('/api/berkas/tidak-ada/unduh')).status === 404);

  const idTxt = sh['Laporan Uji'].id, file = path.join(s.dir, 'data', 'berkas', idTxt + '.txt');
  cek('berkas: hapus staf -> 403', (await staf.del('/api/berkas/' + idTxt)).status === 403 && fs.existsSync(file));
  cek('berkas: hapus admin -> 200, file di disk ikut hilang, lalu 404', (await admin.del('/api/berkas/' + idTxt)).status === 200 && !fs.existsSync(file) && (await lihat.get(`/api/berkas/${idTxt}/unduh`)).status === 404);
  fs.rmSync(path.join(s.dir, 'data', 'berkas', sh['Surat Uji'].id + '.docx'));
  cek('berkas: tercatat tapi file hilang dari disk -> 404 (bukan 500)', (await lihat.get(`/api/berkas/${sh['Surat Uji'].id}/unduh`)).status === 404);
}

async function ujiTanpaAI(staf) {
  const c = await staf.post('/api/chat', { message: 'cari tagihan sewa alat' });
  cek('chat: mode demo menjawab dari pencarian kata kunci (tanpa AI)', c.status === 200 && /Mode demo/.test(c.json.answer), c.teks);
  cek('chat: pesan kosong -> 400', (await staf.post('/api/chat', { message: '   ' })).status === 400);
  const ins = await staf.post('/api/instruksi', { teks: 'Susun rencana kerja minggu depan' });
  cek('instruksi Manajer tanpa kunci AI -> galat terkendali (bukan crash)', ins.status >= 400 && ins.status < 600 && ins.json && ins.json.error, ins.teks);
  cek('server tetap hidup setelah semua permintaan', (await staf.get('/api/me')).status === 200);
}

(async () => {
  let seed;
  const s = await mulaiServer({ env: { OFFICE_USERS: AKUN }, siapkan: (dir) => { seed = siapkan(dir); } });
  try {
    const masuk = async (u, p) => { const k = klien(s.url); await k.masuk(u, p); k.dir = s.dir; return k; };
    const admin = await masuk('uji', 'sandi-uji-1'), staf = await masuk('staf1', 'sandi-staf-1'), lihat = await masuk('lihat', 'sandi-lihat-1');
    await ujiDokumen(s, staf, admin, lihat);
    await ujiTagihan(staf, admin);
    await ujiProyek(staf, admin, lihat);
    await ujiTugas(staf, admin, lihat);
    await ujiRapat(staf, admin);
    await ujiHasilDanBerkas(s, staf, admin, lihat, seed);
    await ujiTanpaAI(staf);
    cek('server: tidak ada crash / galat tak tertangani di log', !/crash|Unhandled|TypeError|ReferenceError/.test(s.log()), s.log().slice(-500));
  } finally { await s.tutup(); }
  process.exit(selesai());
})().catch((e) => { console.log('GALAT UJI', e.stack); process.exit(2); });
