'use strict';
/**
 * Klien HTTP untuk Telegram yang tahan jaringan tidak stabil. fetch bawaan Node memutus sambungan baru setelah 10 detik (tidak bisa diubah),
 * padahal jalur ke Telegram dari sebagian jaringan kadang butuh lebih lama atau IPv6-nya macet. Di sini:
 * - batas sambung 30 detik (TELEGRAM_SAMBUNG_DETIK), IPv4 dan IPv6 dicoba bergantian (cepat berpindah bila salah satunya macet);
 * - sambungan dipakai ulang (keep-alive) supaya tidak jabat tangan TLS tiap pesan;
 * - kegagalan SEBELUM permintaan terkirim (belum tersambung, ditolak, DNS) diulang otomatis sampai 3 kali dengan jeda; kegagalan setelah terkirim
 *   (lambat membalas, putus di tengah) TIDAK diulang di sini supaya pesan tidak terkirim ganda; pemanggil yang memutuskan.
 * Balasannya mirip fetch: { ok, status, headers, json(), text(), arrayBuffer() }. Galat membawa cause.code seperti fetch, dan name "TimeoutError" untuk batas waktu total.
 */
const http = require('http');
const https = require('https');

const SAMBUNG_MS = Number(process.env.TELEGRAM_SAMBUNG_DETIK || 30) * 1000;
const JEDA_ULANG = [1000, 3000]; // jeda sebelum percobaan ke-2 dan ke-3
const bagikanAgen = (lib, opsi) => new lib.Agent({ keepAlive: true, maxSockets: 8, keepAliveMsecs: 15000, ...opsi });
const AGEN = { 'https:': bagikanAgen(https, { autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 1500 }), 'http:': bagikanAgen(http, {}) };
const KODE_ULANG = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET']);

const galat = (kode, pesan, sebelumTerkirim) => Object.assign(new Error(pesan || 'fetch failed'), { cause: { code: kode }, sebelumTerkirim });
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/** Satu percobaan. totalMs = batas waktu seluruh permintaan sejak mulai; sambungMs = batas untuk tersambung. */
function sekali(url, { method, headers, body, totalMs, sambungMs }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), lib = u.protocol === 'http:' ? http : https;
    let tersambung = false, selesai = false, req, pSambung, pTotal;
    const akhiri = (fn, nilai) => { if (selesai) return; selesai = true; clearTimeout(pSambung); clearTimeout(pTotal); fn(nilai); };
    const gagal = (e) => { akhiri(reject, e); try { req.destroy(); } catch { /* sudah tertutup */ } };
    try {
      req = lib.request({ protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method, agent: AGEN[u.protocol],
        headers: { ...headers, ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) } }, (res) => {
        const potongan = [];
        res.on('data', (d) => potongan.push(d));
        res.on('error', (e) => gagal(galat(e.code || 'ECONNRESET', e.message, false)));
        res.on('close', () => { if (!res.complete) gagal(galat('ECONNRESET', 'koneksi terputus saat membaca balasan', false)); });
        res.on('end', () => akhiri(resolve, balasan(res, Buffer.concat(potongan))));
      });
    } catch (e) { return reject(galat(e.code || 'ERR_INVALID_URL', e.message, true)); }
    req.on('socket', (s) => {
      if (!s.connecting) { tersambung = true; return; }
      s.once(u.protocol === 'http:' ? 'connect' : 'secureConnect', () => { tersambung = true; clearTimeout(pSambung); });
    });
    pSambung = setTimeout(() => { if (!tersambung) gagal(galat('ETIMEDOUT', 'tidak bisa tersambung dalam ' + Math.round(sambungMs / 1000) + ' detik', true)); }, sambungMs);
    pTotal = setTimeout(() => gagal(Object.assign(new Error('batas waktu terlampaui'), { name: 'TimeoutError', sebelumTerkirim: false })), totalMs);
    req.on('error', (e) => {
      // Sambungan lama (keep-alive) yang sudah ditutup server memutus kita sebelum ada balasan: permintaan belum diproses, aman diulang.
      const basi = req.reusedSocket && e.code === 'ECONNRESET';
      gagal(galat(e.code || e.name, e.message, !tersambung || basi));
    });
    req.end(body);
  });
}
function balasan(res, buf) {
  const status = res.statusCode || 0;
  return { ok: status >= 200 && status < 300, status, headers: res.headers, buffer: buf,
    json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

/**
 * ambil(url, { method, headers, body (string | Buffer | FormData), timeoutMs, sambungMs, jeda })
 * Hanya kegagalan sebelum terkirim yang diulang (maksimal 1 + jeda.length kali).
 */
async function ambil(url, { method = 'GET', headers = {}, body, timeoutMs = 40000, sambungMs = SAMBUNG_MS, jeda = JEDA_ULANG } = {}) {
  let h = { ...headers }, isi = body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) { const r = new Response(body); h['content-type'] = r.headers.get('content-type'); isi = Buffer.from(await r.arrayBuffer()); }
  const mulai = Date.now();
  for (let i = 0; ; i++) {
    const sisa = timeoutMs - (Date.now() - mulai);
    if (sisa <= 0) throw Object.assign(new Error('batas waktu terlampaui'), { name: 'TimeoutError' });
    try { return await sekali(url, { method, headers: h, body: isi, totalMs: sisa, sambungMs: Math.min(sambungMs, sisa) }); }
    catch (e) {
      const bolehUlang = e.sebelumTerkirim && KODE_ULANG.has(e.cause && e.cause.code) && i < jeda.length;
      // Bila sisa waktu tak cukup untuk menunggu dan mencoba lagi, berhenti sekarang dengan galat aslinya (jangan menunggu melewati batas total).
      if (!bolehUlang || timeoutMs - (Date.now() - mulai) <= jeda[i]) throw e;
      await tidur(jeda[i]);
    }
  }
}

module.exports = { ambil, KODE_ULANG };
