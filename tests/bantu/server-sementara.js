'use strict';
/**
 * Alat bantu uji: server Kantor AI di SALINAN sementara (folder data kosong), tanpa kunci AI dan tanpa Telegram.
 * Data asli (data\) tidak pernah dibaca atau disentuh. Juga penghitung pemeriksaan bersama.
 */
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/** Folder node_modules yang dipakai proyek (bisa di folder induk, mis. saat dijalankan dari git worktree). */
function folderModul() {
  try { return path.resolve(require.resolve('express/package.json', { paths: [ROOT] }), '..', '..'); }
  catch { return path.join(ROOT, 'node_modules'); }
}

/** Penghitung pemeriksaan: cek(nama, ok, ket). Ringkasan dicetak dengan pola "N pemeriksaan, M gagal" (dibaca tests/jalankan-semua.js). */
function penghitung() {
  let total = 0, gagal = 0;
  const cek = (nama, ok, ket) => { total++; if (!ok) { gagal++; console.log('GAGAL ' + nama + (ket !== undefined ? '  -> ' + String(ket).slice(0, 300) : '')); } return Boolean(ok); };
  const selesai = () => { console.log(total + ' pemeriksaan, ' + gagal + ' gagal'); return gagal ? 1 : 0; };
  return { cek, selesai, hitung: () => ({ total, gagal }) };
}

const portKosong = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.unref(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** Salin kode aplikasi ke folder sementara dengan data\ kosong. Kembalikan path foldernya. */
function salinAplikasi(awalan = 'kantor-uji-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), awalan));
  for (const n of ['server.js', 'package.json']) fs.copyFileSync(path.join(ROOT, n), path.join(dir, n));
  for (const d of ['lib', 'public']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data'));
  return dir;
}

/** Lingkungan aman: tanpa kunci AI/Telegram, tugas latar ditunda, akun uji. */
function lingkungan(tambahan = {}) {
  return { ...process.env, NODE_PATH: folderModul(), BAHASA: 'id', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', AI_PROVIDER: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '',
    DIGEST_HOUR: '', LAPORAN_HARI: '', AGENT_AI: '', AGEN_WEB: '', HOST: '127.0.0.1', PENJAGA_MULAI_DETIK: '3600', OFFICE_USERS: 'uji:sandi-uji-1|admin', ...tambahan };
}

/** Jalankan skrip Node kecil di folder salinan (mis. untuk menyiapkan data uji lewat modul lib/). */
function jalankanDi(dir, kode, env = {}) {
  const r = spawnSync(process.execPath, ['-e', kode], { cwd: dir, env: lingkungan(env), encoding: 'utf8', windowsHide: true, timeout: 60000 });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** Mulai server di folder salinan. opsi: { dir, env, siapkan(dir) }. */
async function mulaiServer(opsi = {}) {
  const dir = opsi.dir || salinAplikasi();
  if (opsi.siapkan) await opsi.siapkan(dir);
  const port = await portKosong(), url = 'http://127.0.0.1:' + port;
  const p = spawn(process.execPath, ['server.js'], { cwd: dir, env: lingkungan({ PORT: String(port), ...(opsi.env || {}) }), windowsHide: true });
  let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
  let hidup = false;
  for (let i = 0; i < 80 && p.exitCode === null; i++) { try { await fetch(url + '/api/me'); hidup = true; break; } catch { await tunggu(250); } }
  if (!hidup) { p.kill(); throw new Error('Server uji tidak hidup. Log:\n' + log.slice(0, 2000)); }
  return {
    p, dir, url, port, log: () => log,
    async tutup() { p.kill(); await tunggu(400); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* berkas masih terkunci di Windows; folder temp dibersihkan OS */ } },
  };
}

/** Klien HTTP kecil dengan cookie sesi. */
function klien(url, cookie = '') {
  const minta = async (metode, jalur, badan, header = {}) => {
    const h = { ...header }; if (cookie) h.cookie = cookie;
    let body = badan;
    if (badan !== undefined && !(badan instanceof FormData)) { h['content-type'] = 'application/json'; body = JSON.stringify(badan); }
    const r = await fetch(url + jalur, { method: metode, headers: h, body, redirect: 'manual' });
    const buf = Buffer.from(await r.arrayBuffer()), teks = buf.toString('utf8');
    let json = null; try { json = JSON.parse(teks); } catch { /* bukan JSON */ }
    return { status: r.status, json, teks, buf, header: r.headers };
  };
  return {
    get cookie() { return cookie; },
    get: (j, h) => minta('GET', j, undefined, h), post: (j, b, h) => minta('POST', j, b, h), put: (j, b) => minta('PUT', j, b), patch: (j, b) => minta('PATCH', j, b), del: (j) => minta('DELETE', j),
    async masuk(user, password) { const r = await minta('POST', '/api/login', { user, password }); if (r.status === 200) cookie = (r.header.get('set-cookie') || '').split(';')[0]; return r; },
  };
}

/** Tunggu sampai fungsi mengembalikan nilai truthy (atau waktu habis -> null). */
async function tungguSampai(fn, ms = 20000, jeda = 250) {
  const akhir = Date.now() + ms;
  while (Date.now() < akhir) { const v = await fn(); if (v) return v; await tunggu(jeda); }
  return null;
}

module.exports = { ROOT, tunggu, folderModul, penghitung, salinAplikasi, lingkungan, jalankanDi, mulaiServer, klien, tungguSampai };
