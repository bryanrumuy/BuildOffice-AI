'use strict';
/**
 * Bot Telegram penerima perintah. Hanya chat TELEGRAM_CHAT_ID yang dilayani (di grup, hanya pengguna di TELEGRAM_USER_IDS);
 * pesan dari orang lain diabaikan dan dicatat di log audit. Perintah setara peran "staf": menjalankan agen, menyetujui pesan,
 * menandai tugas selesai. Tidak ada perintah untuk menghapus data, mengubah pengaturan, atau melunasi tagihan.
 * Memakai getUpdates (polling), jadi tidak perlu alamat publik atau webhook.
 */
const fs = require('fs');
const { readJson, writeJson } = require('./store');
const { ambil, KODE_ULANG } = require('./jaringan');
const Md = require('../public/md.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '', CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '');
const BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const USER_IDS = (process.env.TELEGRAM_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
const TIMEOUT_KIRIM_MS = Number(process.env.TELEGRAM_TIMEOUT_DETIK || 40) * 1000;
const POLL_DETIK = Number(process.env.TELEGRAM_POLL_DETIK || 25), MAX_UMUR_DETIK = 600, MAX_PANJANG = 3900;
const AKTIF = Boolean(TOKEN) && process.env.TELEGRAM_PERINTAH !== '0';
const STATUS_LABEL = { todo: 'akan dikerjakan', doing: 'dikerjakan', review: 'perlu dicek', blocked: 'terblokir', done: 'selesai' };

const BANTUAN = `Kantor AI siap menerima perintah. Cukup tulis apa saja (tanpa garis miring) dan agen serbaguna mengerjakannya, mis. "buat file Excel daftar tagihan 30 hari" atau "catat nota bensin 150 ribu hari ini ke kas".

/rapat [agenda] : panggil semua agen rapat di Ruang Rapat (atau tulis "panggil rapat"), notulen dikirim ke sini
/tanya <agen> <pertanyaan> : tanya langsung ke satu agen, mis. /tanya bendahara berapa kas bulan ini? (atau tulis "Bendahara, berapa kas bulan ini?")
/tugas : daftar tugas terbuka
/tugasbaru <instruksi> : Manajer memecah instruksi besar jadi tugas
/kerjakan <no> : agen mengerjakan tugas bernomor
/kerjakansemua : agen mengerjakan semua tugas yang siap
/selesai <no> : tandai tugas selesai
/persetujuan : pesan agen yang menunggu izin
/setuju <no> atau /tolak <no>
/status : ringkasan kantor
/server : kesehatan dan keamanan sistem (tanpa AI, instan)
/standup : standup hari ini
/laporan : laporan mingguan (file)
/berkas [no] : daftar berkas buatan agen, atau kirim satu berkas
/baru : mulai percakapan baru (agen melupakan perintah sebelumnya)

Kirim foto atau PDF nota/invoice ke chat ini: Resepsionis menerimanya, Pembaca Dokumen membacanya, lalu hasilnya kukabari di sini dan menunggu verifikasi di web.
Pesan dari agen yang butuh izin muncul di sini dengan tombol ✓ Setujui / ✗ Tolak.

Agen mengingat beberapa perintah terakhir (6 jam), jadi "buat ulang" atau "jadikan PDF" menyambung ke pekerjaan sebelumnya.`;

const potong = (t, n = MAX_PANJANG) => { const out = []; let s = String(t || ''); while (s.length > n) { let i = s.lastIndexOf('\n', n); if (i < n / 2) i = n; out.push(s.slice(0, i)); s = s.slice(i).trimStart(); } out.push(s); return out; };
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// Nama lain tiap agen untuk mengenali "pembaca dokumen km gd kerjaan???" sebagai pertanyaan untuk agen itu.
const ALIAS = { penerima: ['resepsionis'], pembaca: ['pembaca dokumen', 'pembaca'], arsip: ['petugas arsip'], keuangan: ['bendahara'], pengingat: ['pengingat jadwal'], pelapor: ['penyusun laporan'], manajer: ['manajer proyek', 'manajer'], asisten: ['asisten harian'], penjaga: ['penjaga sistem', 'penjaga'], pelaksana: ['staf serbaguna'] };
const KATA_TANYA = /^(kenapa|kok|mengapa|apa|apakah|siapa|kapan|berapa|bagaimana|gimana|dimana|di mana|masih|sudah|udah|lagi)\b/i;
const KATA_PERINTAH = /^(tolong\s+)?(buat|buatkan|bikin|bikinkan|catat|catatkan|kerjakan|kirim|kirimkan|cari|carikan|rangkum|hitung|tambah|tambahkan|hapus|ubah|ganti|jadikan|susun|siapkan|tuliskan|tulis|ringkas|analisis)\b/i;
/** Agen yang disebut dalam kalimat tanya ("Agent pembaca dokumen kok jalan mulu gd kerjaan???"), atau null bila bukan pertanyaan/ada kata perintah di awal. */
function agenDisebut(teks, daftar) {
  const t = String(teks || '').trim();
  if (!/[?？]/.test(t) && !KATA_TANYA.test(t)) return null; // bukan pertanyaan
  if (KATA_PERINTAH.test(t)) return null; // "buatkan ... " tetap perintah
  const kecil = ' ' + t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  let terbaik = null;
  for (const a of daftar) {
    for (const n of [a.nama.toLowerCase(), ...(ALIAS[a.id] || []), 'agen ' + a.id, 'agent ' + a.id]) {
      const i = kecil.indexOf(' ' + n + ' ');
      if (i >= 0 && (!terbaik || i < terbaik.i || (i === terbaik.i && n.length > terbaik.len))) terbaik = { a, i, len: n.length };
    }
  }
  return terbaik && terbaik.a;
}

/** d: ketergantungan dari server.js (agar modul ini mudah diuji dan tidak saling impor). */
function buat(d) {
  const INGAT = 4, UMUR_RIWAYAT_MS = 6 * 3600 * 1000;
  let riwayat = [], daftarTugas = [], daftarSetuju = [], daftarBerkas = [], aktif = false, offset = readJson('telegram-offset.json', { v: 0 }).v;
  // Galat dari/ke Telegram (lambat, putus) ditandai e.telegram: pesan "Gagal" tidak dikirim lewat Telegram yang sedang bermasalah itu.
  const galatTg = (pesan) => Object.assign(new Error(pesan), { telegram: true });
  const api = async (metode, body) => {
    let res;
    try { res = await ambil(`${BASE}/bot${TOKEN}/${metode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), timeoutMs: TIMEOUT_KIRIM_MS }); }
    catch (e) { throw galatTg(`Telegram ${metode}: ${e.name === 'TimeoutError' ? 'lambat membalas (pesan mungkin tetap terkirim)' : (e.cause && e.cause.code) || e.message}`); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw galatTg(`Telegram ${metode} ${res.status}: ${j.description || 'tidak diketahui'}`);
    return j.result;
  };
  // Koneksi putus (bukan timeout, karena timeout bisa berarti pesan sudah terkirim) dicoba sekali lagi agar notulen/jawaban tidak hilang diam-diam.
  const kirim = async (chatId, teks) => {
    for (const bagian of potong(teks)) {
      const body = { chat_id: chatId, text: bagian || '(kosong)', disable_web_page_preview: true };
      try { await api('sendMessage', body); }
      catch (e) { if (!e.telegram || /lambat membalas|\d{3}:/.test(e.message)) throw e; await tunggu(1500); await api('sendMessage', body); }
    }
  };
  const izin = (m) => String(m.chat.id) === CHAT_ID && (m.chat.type === 'private' || (m.from && USER_IDS.includes(String(m.from.id))));
  const nomor = (arg, daftar) => { const n = Number(String(arg).trim()); return Number.isInteger(n) && n >= 1 && n <= daftar.length ? daftar[n - 1] : null; };
  const sibuk = (r) => (r.code === 429 ? 'Agen lain masih bekerja. Coba lagi sebentar.' : null);

  async function kirimBerkas(chatId, daftar) {
    for (const b of daftar) {
      const entri = d.berkas.find(b.id); if (!entri) continue;
      await d.notify.sendDocument(fs.readFileSync(d.berkas.fileOf(entri)), entri.nama, `Berkas dari agen: ${entri.nama}`, d.berkas.FORMAT[entri.format].split(';')[0]);
    }
  }
  function ringkasLangkah(langkah) { return langkah && langkah.length ? '\n\nYang dikerjakan agen:\n' + langkah.slice(0, 12).map((l) => `${l.ok ? '✓' : '✗'} ${l.ringkas}`).join('\n') : ''; }

  /** Catatan perintah terakhir (maks 4, 6 jam) agar perintah sambungan seperti "buat ulang" atau "jadikan PDF" dimengerti. */
  const catatRiwayat = () => { riwayat = riwayat.filter((x) => Date.now() - x.t < UMUR_RIWAYAT_MS); return riwayat.length ? riwayat.map((x, i) => `${i + 1}. Perintah: ${x.tanya}\n   Hasil: ${x.jawab}${x.berkas.length ? '\n   Berkas dibuat: ' + x.berkas.join(', ') : ''}`).join('\n') : ''; };
  const perintah = {
    async bantuan(c) { await kirim(c, BANTUAN); },
    async status(c) {
      const x = d.dashboard(), tg = x.tugas;
      await kirim(c, [`Tugas terbuka ${tg.terbuka}: ${tg.review} perlu dicek, ${tg.blocked} terblokir, ${tg.terlambat} terlambat.`,
        `Kas ${x.bulan}: masuk ${rp(x.kas.masuk)}, keluar ${rp(x.kas.keluar)}.`, `Tagihan: ${x.tagihan.terlambat} terlambat, harus dibayar ≤ 30 hari ${rp(x.tagihan.bayar30)}.`,
        `Dokumen menunggu verifikasi: ${x.dokumen.belum}, gagal: ${x.dokumen.gagal}.`, `Pesan menunggu persetujuan: ${d.board.listApprovals('menunggu').length}.`, `Kesehatan sistem: ${x.sehat}.`].join('\n'));
    },
    async server(c) {
      const x = d.statusSistem(), ok = { ok: '✓', info: 'i', peringatan: '!', bahaya: '✗' }, kc = x.keamanan;
      await kirim(c, [`Kesehatan sistem: ${x.tingkat.toUpperCase()}`, ...x.pemeriksaan.map((p) => `${ok[p.status] || '?'} ${p.nama}: ${p.keterangan}`),
        '', `Keamanan: server ${kc.terbuka_ke_jaringan ? 'TERBUKA ke jaringan (' + kc.alamat_server + ')' : 'hanya bisa diakses dari komputer ini'}; login gagal 24 jam: ${kc.login_gagal_24_jam}; percobaan Telegram ditolak: ${kc.telegram_ditolak_24_jam}.`,
        x.tindakan_penjaga_terbaru.length ? 'Tindakan Penjaga terbaru: ' + x.tindakan_penjaga_terbaru.map((t) => t.keterangan).join('; ') : 'Penjaga belum melakukan tindakan perbaikan.', kc.catatan].join('\n'));
    },
    async rapat(c, arg) {
      await api('sendChatAction', { chat_id: c, action: 'typing' }).catch(() => {});
      const r = await d.exklusif(() => d.adakanRapat({ agenda: arg, user: 'telegram' }));
      if (r.error) return kirim(c, r.code === 429 ? 'Agen lain masih bekerja. Coba lagi sebentar.' : r.error);
      await kirim(c, d.notulenTeks(r.value));
    },
    async tanya(c, arg) {
      const agen = d.daftarAgen().sort((a, b) => b.nama.length - a.nama.length), kecil = String(arg || '').toLowerCase();
      const hit = agen.find((a) => kecil.startsWith(a.nama.toLowerCase())) || agen.find((a) => kecil.startsWith(a.id + ' '));
      if (!hit) return kirim(c, 'Pakai: /tanya <agen> <pertanyaan>, mis. /tanya bendahara berapa kas bulan ini?\nAgen: ' + agen.map((a) => a.nama).join(', '));
      const q = arg.slice(kecil.startsWith(hit.nama.toLowerCase()) ? hit.nama.length : hit.id.length).replace(/^[\s,:]+/, '');
      if (!q) return kirim(c, 'Tulis pertanyaan untuk ' + hit.nama + ' setelah namanya.');
      await api('sendChatAction', { chat_id: c, action: 'typing' }).catch(() => {});
      const r = await d.tanyaKeAgen({ agenId: hit.id, pertanyaan: q, user: 'telegram' });
      await kirim(c, r.error ? (r.code === 429 ? 'Masih ada pertanyaan yang dijawab. Coba lagi sebentar.' : r.error) : r.value.agen.nama + ': ' + r.value.jawaban);
    },
    async tugas(c) {
      daftarTugas = d.board.list().filter((t) => t.status !== 'done').slice(0, 20);
      await kirim(c, daftarTugas.length ? daftarTugas.map((t, i) => `${i + 1}. [${STATUS_LABEL[t.status]}] ${t.judul} — ${d.pemilikLabel(t.pemilik)}${t.tenggat ? ' (tenggat ' + t.tenggat + ')' : ''}`).join('\n') + '\n\nPakai /kerjakan <no>, /selesai <no>.' : 'Tidak ada tugas terbuka.');
    },
    async selesai(c, arg) {
      const t = nomor(arg, daftarTugas); if (!t) return kirim(c, 'Pakai nomor dari /tugas, mis. /selesai 2.');
      const r = d.board.update(t.id, { status: 'done' }, 'telegram'); if (r.error) return kirim(c, r.error);
      d.tugasBerubah('telegram', 'tugas-ubah', { id: t.id, status: 'done' }); await kirim(c, `Selesai: ${t.judul}`);
    },
    async kerjakan(c, arg) {
      const t = nomor(arg, daftarTugas); if (!t) return kirim(c, 'Pakai nomor dari /tugas, mis. /kerjakan 1.');
      await api('sendChatAction', { chat_id: c, action: 'typing' }).catch(() => {});
      const r = await d.exklusif(() => d.kerjakanTugas(t.id, 'telegram'));
      if (r.error) return kirim(c, sibuk(r) || r.error);
      const x = r.value; await kirim(c, `${x.status === 'blocked' ? 'Terblokir' : 'Selesai, perlu dicek'}: ${x.judul}\n\n${Md.plain(String(x.hasil || '')).slice(0, 2500)}${ringkasLangkah(x.langkah)}`);
      await kirimBerkas(c, (x.berkas || []).map((id) => ({ id })));
    },
    async kerjakansemua(c) { const r = d.kerjakanSemua('telegram'); await kirim(c, r.error ? sibuk(r) || r.error : `Agen mulai mengerjakan ${r.value.jumlah} tugas. Hasilnya muncul sebagai "perlu dicek"; cek dengan /tugas.`); },
    async tugasbaru(c, arg) {
      if (!arg) return kirim(c, 'Tulis instruksinya, mis. /tugasbaru siapkan acara arisan bulan depan.');
      await api('sendChatAction', { chat_id: c, action: 'typing' }).catch(() => {});
      const r = await d.exklusif(() => d.buatInstruksi({ teks: arg, docIds: [], user: 'telegram' }));
      if (r.error) return kirim(c, sibuk(r) || r.error);
      const { tugas, instruksi } = r.value; daftarTugas = tugas;
      await kirim(c, tugas.length ? `${instruksi.ringkasan || 'Rencana'}\n\n` + tugas.map((t, i) => `${i + 1}. ${t.judul} — ${d.pemilikLabel(t.pemilik)}${t.tenggat ? ' (tenggat ' + t.tenggat + ')' : ''}`).join('\n') + '\n\nPakai /kerjakan <no> atau /kerjakansemua.' : 'Manajer butuh penjelasan dulu:\n' + instruksi.pertanyaan.map((q) => '• ' + q).join('\n'));
    },
    async persetujuan(c) {
      daftarSetuju = d.board.listApprovals('menunggu').slice(0, 10);
      await kirim(c, daftarSetuju.length ? daftarSetuju.map((p, i) => `${i + 1}. dari ${d.pemilikLabel('agen:' + p.oleh)}:\n${p.teks}`).join('\n\n') + '\n\n/setuju <no> mengirimnya ke Telegram ini, /tolak <no> membuangnya.' : 'Tidak ada pesan yang menunggu persetujuan.');
    },
    async setuju(c, arg) { const p = nomor(arg, daftarSetuju); if (!p) return kirim(c, 'Pakai nomor dari /persetujuan.'); const r = await d.setujui(p.id, 'telegram'); await kirim(c, r.error ? r.error : 'Pesan dikirim.'); },
    async tolak(c, arg) { const p = nomor(arg, daftarSetuju); if (!p) return kirim(c, 'Pakai nomor dari /persetujuan.'); const r = d.tolak(p.id, 'telegram'); await kirim(c, r.error ? r.error : 'Pesan ditolak, tidak dikirim.'); },
    async standup(c) { await kirim(c, await d.makeStandup()); },
    async laporan(c) { await api('sendChatAction', { chat_id: c, action: 'upload_document' }).catch(() => {}); const r = await d.sendWeeklyReport(); await kirim(c, `Laporan mingguan terkirim (${r.format.toUpperCase()}).`); },
    async berkas(c, arg) {
      daftarBerkas = d.berkas.list().slice(0, 10);
      if (!arg) return kirim(c, daftarBerkas.length ? daftarBerkas.map((b, i) => `${i + 1}. ${b.nama} (${Math.round(b.ukuran / 1024) || 1} KB)`).join('\n') + '\n\nKetik /berkas <no> untuk menerima filenya.' : 'Belum ada berkas buatan agen.');
      const b = nomor(arg, daftarBerkas); if (!b) return kirim(c, 'Pakai nomor dari /berkas.');
      await kirimBerkas(c, [b]);
    },
    async bebas(c, teks) { // teks biasa = perintah bebas ke agen serbaguna
      await api('sendChatAction', { chat_id: c, action: 'typing' }).catch(() => {});
      const r = await d.exklusif(() => d.jalankanPerintah({ teks, docIds: [], user: 'telegram', konteks: false, riwayat: catatRiwayat() }));
      if (r.error) return kirim(c, sibuk(r) || r.error);
      riwayat.push({ t: Date.now(), tanya: teks.slice(0, 300), jawab: Md.plain(r.value.hasil).slice(0, 700), berkas: (r.value.berkas || []).map((b) => b.nama) }); riwayat = riwayat.slice(-INGAT);
      await kirim(c, Md.plain(r.value.hasil) + ringkasLangkah(r.value.langkah));
      await kirimBerkas(c, r.value.berkas);
    },
  };
  perintah.baru = async (c) => { riwayat = []; await kirim(c, 'Oke, mulai percakapan baru. Agen tidak lagi mengingat perintah sebelumnya.'); };
  perintah.kesehatan = perintah.server;
  perintah.start = perintah.bantuan; perintah.help = perintah.bantuan;

  const MAX_BERKAS = d.batasBerkas || 15 * 1024 * 1024, UMUR_BERKAS_DETIK = 24 * 3600;
  /** Foto atau file nota/invoice dari Telegram: diunggah seperti dari web (dibaca agen, lalu menunggu verifikasi manusia). */
  async function tanganiBerkas(m) {
    if (Date.now() / 1000 - (m.date || 0) > UMUR_BERKAS_DETIK) return; // berkas aman diproses terlambat (hanya masuk antrean verifikasi), tapi bukan yang berhari-hari
    if (!izin(m)) { d.audit('telegram', 'telegram-ditolak', { chat: m.chat.id, dari: m.from && m.from.id, jenis: 'berkas' }); return; }
    const c = m.chat.id, besarMb = Math.round(MAX_BERKAS / 1048576);
    try {
      const f = m.document || m.photo[m.photo.length - 1];
      const nama = (m.document && m.document.file_name) || `foto-telegram-${new Date().toISOString().slice(0, 10)}.jpg`;
      if (f.file_size && f.file_size > MAX_BERKAS) return await kirim(c, `File terlalu besar (maks ${besarMb} MB).`);
      const info = await api('getFile', { file_id: f.file_id });
      const res = await ambil(`${BASE}/file/bot${TOKEN}/${info.file_path}`, { timeoutMs: TIMEOUT_KIRIM_MS }).catch((e) => { throw galatTg(`Telegram unduh: ${e.name === 'TimeoutError' ? 'lambat' : (e.cause && e.cause.code) || e.message}`); });
      if (!res.ok) throw galatTg(`Telegram unduh ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BERKAS) return await kirim(c, `File terlalu besar (maks ${besarMb} MB).`);
      const r = d.terimaBerkas({ buf, nama, user: 'telegram', sumber: 'telegram' });
      if (r.error) return await kirim(c, r.error);
      d.audit('telegram', 'telegram-berkas', { id: r.value.id, ukuran: buf.length });
      await kirim(c, `Diterima: ${r.value.originalName}. Resepsionis meneruskannya ke Pembaca Dokumen. Hasil bacaannya kukabari di sini, lalu menunggu verifikasi di web.`);
    } catch (e) {
      if (e.telegram) { const pesan = String(e.message || e).replace(TOKEN, '***'); console.error('bot Telegram (berkas):', pesan); d.audit('telegram', 'telegram-gagal-kirim', { perintah: 'berkas', galat: pesan.slice(0, 200) }); return; }
      await kirim(c, 'Gagal menerima file: ' + String(e.message || e).slice(0, 300)).catch(() => {});
    }
  }

  /** Tombol Setujui/Tolak pada pesan pengajuan. Hanya chat/pengguna yang sah; tombol yang ditekan dua kali tidak mengirim ganda. */
  async function tanganiTombol(cb) {
    const m = cb && cb.message;
    if (!m || !m.chat || !izin({ chat: m.chat, from: cb.from })) { d.audit('telegram', 'telegram-ditolak', { chat: m && m.chat && m.chat.id, dari: cb && cb.from && cb.from.id, jenis: 'tombol' }); return; }
    const [jenis, aksi, id] = String(cb.data || '').split(':');
    if (jenis !== 'ap' || !['s', 't'].includes(aksi) || !id) return;
    d.audit('telegram', 'telegram-tombol', { aksi });
    let ok = false, jawab;
    try {
      const r = aksi === 's' ? await d.setujui(id, 'telegram') : d.tolak(id, 'telegram');
      if (r.error) jawab = r.error; else { ok = true; jawab = aksi === 's' ? 'Pesan dikirim.' : 'Pesan ditolak, tidak dikirim.'; }
    } catch (e) { jawab = 'Gagal: ' + String(e.message || e).slice(0, 150); }
    try {
      await api('answerCallbackQuery', { callback_query_id: cb.id, text: jawab.slice(0, 180) });
      if (ok || /sudah diputuskan|tidak ditemukan/i.test(jawab)) await api('editMessageText', { chat_id: m.chat.id, message_id: m.message_id, text: potong(`${m.text || ''}\n\n— ${ok ? (aksi === 's' ? 'Disetujui' : 'Ditolak') + ' lewat Telegram' : jawab}`)[0] });
    } catch (e) { console.error('bot Telegram (tombol):', String(e.message || e).replace(TOKEN, '***')); }
  }

  /** Pesan pengajuan agen baru dikirim ke chat resmi lengkap dengan tombol. Dipanggil server saat persetujuan dibuat. */
  async function ajukanPersetujuan(p) {
    if (!AKTIF || !CHAT_ID) return false;
    const teks = `Pesan dari ${d.pemilikLabel('agen:' + p.oleh)} menunggu persetujuanmu:\n\n${p.teks}\n\nSetujui = pesan ini dikirim ke chat ini. Tolak = dibuang.`;
    await api('sendMessage', { chat_id: CHAT_ID, text: potong(teks)[0], reply_markup: { inline_keyboard: [[{ text: '✓ Setujui', callback_data: 'ap:s:' + p.id }, { text: '✗ Tolak', callback_data: 'ap:t:' + p.id }]] } });
    return true;
  }

  /** Hasil baca dokumen yang dikirim lewat Telegram dikabari ke chat resmi (berhasil atau gagal). */
  async function laporDokumen(doc) {
    if (!AKTIF || !CHAT_ID) return false;
    let teks;
    if (doc.status === 'gagal') teks = `Gagal membaca ${doc.originalName}: ${doc.error || 'tidak diketahui'}.\nCoba kirim ulang dengan foto yang lebih jelas dan terang, atau unggah lewat web.`;
    else {
      const x = doc.data || {};
      teks = [`Selesai dibaca: ${x.judul || doc.originalName}`, `Jenis: ${x.jenis || '-'}`, x.nilai_angka ? `Jumlah: ${rp(x.nilai_angka)}` : null, x.tanggal ? `Tanggal: ${x.tanggal}` : null, x.jatuh_tempo ? `Jatuh tempo: ${x.jatuh_tempo}` : null, x.pihak ? `Pihak: ${x.pihak}` : null,
        '', 'Menunggu verifikasi: buka tab Dokumen di web, periksa isinya, lalu "Simpan & verifikasi".', doc.mode === 'demo' ? '(Mode demo: isinya perkiraan sederhana, bukan hasil AI.)' : null].filter((l) => l !== null).join('\n');
    }
    await kirim(CHAT_ID, teks);
    return true;
  }

  /** Satu pesan masuk. Tidak pernah melempar: galat dibalas ke pengguna. */
  async function tangani(update) {
    if (update && update.callback_query) return tanganiTombol(update.callback_query);
    const m = update && update.message;
    if (m && m.chat && typeof m.text !== 'string' && (m.photo || m.document)) return tanganiBerkas(m);
    if (!m || typeof m.text !== 'string' || !m.chat) return;
    if (Date.now() / 1000 - (m.date || 0) > MAX_UMUR_DETIK) return; // jangan menjalankan perintah basi setelah server lama mati
    const teks = m.text.trim(); if (!teks) return;
    if (!izin(m)) {
      d.audit('telegram', 'telegram-ditolak', { chat: m.chat.id, dari: m.from && m.from.id });
      if (!CHAT_ID && /^\/(start|id)\b/.test(teks)) await kirim(m.chat.id, `ID chat ini: ${m.chat.id}\nIsikan angka itu sebagai TELEGRAM_CHAT_ID saat menjalankan start.bat, lalu mulai ulang.`).catch(() => {});
      return;
    }
    const kata = teks.split(/\s+/)[0], garis = kata.startsWith('/'), cmd = garis ? kata.slice(1).split('@')[0].toLowerCase() : null, arg = garis ? teks.slice(kata.length).trim() : teks;
    d.audit('telegram', 'telegram-perintah', { perintah: cmd || 'bebas', panjang: teks.length });
    try {
      if (garis && !perintah[cmd]) return await kirim(m.chat.id, 'Perintah tidak dikenal. Ketik /bantuan.');
      if (!garis && /^(ayo\s+|tolong\s+|yuk\s+)?(panggil|adakan|mulai|kumpulkan)\s+(semua\s+)?(agen\s+)?rapat\b|^(ayo|yuk)\s+rapat\b|^rapat( sekarang| dong| yuk)?[\s!.]*$/i.test(teks)) return await perintah.rapat(m.chat.id, teks.replace(/^(ayo\s+|tolong\s+|yuk\s+)?((panggil|adakan|mulai|kumpulkan)\s+(semua\s+)?(agen\s+)?)?rapat( sekarang| dong| yuk)?[\s,:-]*/i, '').trim());
      if (!garis) { // "Bendahara, berapa kas bulan ini?" = bertanya ke agen itu; selain itu perintah bebas
        const sapa = /^([^,:\n]{2,30})[,:]\s*([\s\S]*\?)\s*$/.exec(teks), k = sapa && sapa[1].trim().toLowerCase();
        if (sapa && d.daftarAgen().some((a) => a.id === k || a.nama.toLowerCase() === k)) return await perintah.tanya(m.chat.id, sapa[1].trim() + ' ' + sapa[2]);
        const disebut = agenDisebut(teks, d.daftarAgen());
        if (disebut) return await perintah.tanya(m.chat.id, disebut.nama + ' ' + teks);
        return await perintah.bebas(m.chat.id, teks);
      }
      if (cmd === 'perintah') return arg ? await perintah.bebas(m.chat.id, arg) : await kirim(m.chat.id, 'Tulis perintahnya setelah /perintah.');
      await perintah[cmd](m.chat.id, arg);
    } catch (e) {
      if (e.telegram) {
        const pesan = String(e.message || e).replace(TOKEN, '***');
        console.error('bot Telegram (kirim):', pesan);
        if (d.audit) d.audit('telegram', 'telegram-gagal-kirim', { perintah: cmd, galat: pesan.slice(0, 200) }); // jejak: perintah jalan tetapi balasan tidak sampai
        return;
      } // jangan membalas "Gagal" lewat Telegram yang sedang lambat
      await kirim(m.chat.id, 'Gagal: ' + String(e.message || e).slice(0, 300)).catch(() => {});
    }
  }

  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
  async function loop() {
    let gagal = 0;
    while (aktif) {
      try {
        const res = await ambil(`${BASE}/bot${TOKEN}/getUpdates?timeout=${POLL_DETIK}&offset=${offset}&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D`, { timeoutMs: (POLL_DETIK + 15) * 1000 });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(`getUpdates ${res.status}: ${j.description || 'tidak diketahui'}`);
        for (const u of j.result) { offset = u.update_id + 1; writeJson('telegram-offset.json', { v: offset }); await tangani(u); }
        gagal = 0;
      } catch (e) {
        gagal++; if (gagal === 1 || gagal % 10 === 0) console.error('bot Telegram:', String(e.message || e).replace(TOKEN, '***') + (e.cause && e.cause.code ? ' (' + e.cause.code + ')' : '') + (e.cause && (KODE_ULANG.has(e.cause.code) || e.cause.code === 'UND_ERR_CONNECT_TIMEOUT') ? ' - koneksi ke Telegram lambat, putus, atau diblokir jaringan; bot mencoba lagi otomatis' : ''));
        await tunggu(Math.min(60000, 2000 * 2 ** Math.min(gagal, 5)));
      }
    }
  }
  return { tangani, ajukanPersetujuan, laporDokumen, mulai() { if (aktif || !AKTIF) return false; aktif = true; loop(); return true; }, berhenti() { aktif = false; } };
}

module.exports = { agenDisebut, buat, AKTIF, CHAT_ID_DIISI: Boolean(CHAT_ID), USER_IDS: USER_IDS.length };
