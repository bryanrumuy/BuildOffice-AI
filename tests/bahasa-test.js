'use strict';
/**
 * Uji lapisan bahasa (lib/bahasa.js + lib/i18n/en.json). Jalankan: node tests/bahasa-test.js
 * Server diuji di SALINAN sementara (data kosong), data asli tidak disentuh.
 */
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'lib', 'bahasa.js'));
const kamus = B.kamus('en');
let total = 0, gagal = 0;
const cek = (nama, ok, ket) => { total++; if (!ok) { gagal++; console.log('GAGAL ' + nama + (ket ? '  -> ' + ket : '')); } };
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const berkasJs = ['server.js', ...fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js') && f !== 'bahasa.js').map((f) => 'lib/' + f), ...fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.js')).map((f) => 'public/' + f)];
const baca = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1) Tanpa kamus, hasil olahan harus identik dengan sumber (tidak ada perubahan tak sengaja pada kode).
let beda = [];
for (const f of berkasJs) { if (B.olahJs(baca(f), () => undefined).kode !== baca(f)) beda.push(f); }
cek('olahan tanpa kamus identik dengan sumber di semua berkas', beda.length === 0, beda.join());

// 2) Setiap satuan teks tampilan punya terjemahan, penampung {#n} sama, dan kode hasil terjemahan valid.
const satuan = new Set();
for (const f of berkasJs) for (const s of B.olahJs(baca(f), () => undefined).satuan) satuan.add(s);
for (const s of B.olahHtml(baca('public/index.html'), () => undefined).satuan) satuan.add(s);
const tanpa = [...satuan].filter((s) => !(s in kamus));
cek('semua satuan teks punya terjemahan Inggris (bila gagal: node alat/bahasa-ekstrak.js lalu alat/bahasa-terjemah.js)', tanpa.length === 0, tanpa.slice(0, 5).join(' | '));
const pen = (s) => (s.match(/\{#\d+\}/g) || []).sort().join('');
const rusak = Object.entries(kamus).filter(([k, v]) => !k.includes('::') && pen(k) !== pen(v)).map(([k]) => k);
cek('penampung {#n} sama di sumber dan terjemahan', rusak.length === 0, rusak.slice(0, 3).join(' | '));
const salahSintaks = [];
for (const f of berkasJs) { try { const kode = B.terjemahkanKode(baca(f), 'en', f); new vm.Script('(function (require, module, exports, __filename, __dirname) {' + kode + '\n})', { filename: f }); } catch (e) { salahSintaks.push(f + ': ' + e.message); } }
cek('kode hasil terjemahan valid di semua berkas', salahSintaks.length === 0, salahSintaks.join('; '));
const dalamHtml = B.olahHtml(baca('public/index.html'), (t) => kamus['public/index.html::' + t] || kamus[t]).kode;
cek('index.html: judul dan tombol masuk diterjemahkan, lang=en', /<title>AI Office<\/title>/.test(dalamHtml) && />Sign in</.test(dalamHtml), dalamHtml.slice(0, 200));

// 3) Server nyata di salinan sementara, dua bahasa.
async function jalan(bahasa, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bahasa-test-'));
  for (const n of ['server.js', 'package.json']) fs.copyFileSync(path.join(ROOT, n), path.join(dir, n));
  fs.cpSync(path.join(ROOT, 'lib'), path.join(dir, 'lib'), { recursive: true }); fs.cpSync(path.join(ROOT, 'public'), path.join(dir, 'public'), { recursive: true }); fs.mkdirSync(path.join(dir, 'data'));
  const env = { ...process.env, PORT: String(port), BAHASA: bahasa, OFFICE_USERS: 'uji:sandi-uji-1|admin', NODE_PATH: path.join(ROOT, 'node_modules'), ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' };
  const p = spawn(process.execPath, ['server.js'], { cwd: dir, env, windowsHide: true });
  let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:' + port + '/api/me'); break; } catch { await tunggu(250); } }
  const url = 'http://127.0.0.1:' + port;
  const lg = await fetch(url + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'uji', password: 'sandi-uji-1' }) });
  const cookie = (lg.headers.get('set-cookie') || '').split(';')[0];
  const get = async (u) => { const r = await fetch(url + u, { headers: { cookie } }); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') }; };
  return { p, log: () => log, url, cookie, get, dir, bye: async () => { p.kill(); await tunggu(400); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* berkas masih terkunci */ } } };
}
(async () => {
  const salah = await fetch('http://127.0.0.1:1/').catch(() => null); void salah;
  const id = await jalan('id', 3481);
  const idHtml = (await id.get('/')).text, idApp = (await id.get('/app.js')).text, idMe = JSON.parse((await id.get('/api/me')).text);
  const idLoginSalah = await fetch(id.url + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'uji', password: 'salah' }) });
  const idPesan = (await idLoginSalah.json()).error;
  cek('bahasa id: halaman, klien, dan galat API tetap Indonesia', /<title>Kantor AI<\/title>/.test(idHtml) && idApp.includes('Pengaturan') && /Nama atau sandi salah/.test(idPesan) && idMe.bahasa === 'id', idPesan);
  await id.bye();

  const en = await jalan('en', 3482);
  const enHtml = (await en.get('/')).text, enApp = (await en.get('/app.js')).text, enMe = JSON.parse((await en.get('/api/me')).text);
  const enLoginSalah = await fetch(en.url + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'uji', password: 'salah' }) });
  const enPesan = (await enLoginSalah.json()).error;
  cek('bahasa en: halaman dan klien diterjemahkan (Content-Type tetap benar)', /<title>AI Office<\/title>/.test(enHtml) && />Sign in</.test(enHtml) && enApp.includes('"Save"') && !enApp.includes("'Simpan'") && (await en.get('/app.js')).type.includes('javascript'), enApp.slice(0, 120));
  cek('bahasa en: galat API berbahasa Inggris, kunci JSON tetap', /Incorrect|Wrong|Invalid/i.test(enPesan) && enLoginSalah.status === 401 && enMe.bahasaAktif === 'en', enPesan);
  cek('bahasa en: log awal server berbahasa Inggris', /running at/.test(en.log()), en.log().slice(0, 160));
  const docs = await en.get('/api/docs'), agenda = await en.get('/api/agen'), dasbor = await en.get('/api/dashboard');
  cek('bahasa en: API data tetap berfungsi (docs, agen, dashboard)', docs.status === 200 && agenda.status === 200 && dasbor.status === 200, [docs.status, agenda.status, dasbor.status].join());
  const nama = JSON.parse(agenda.text).map((a) => a.nama);
  cek('bahasa en: nama agen berbahasa Inggris', nama.includes('Project Manager') && nama.includes('General Staff'), nama.join());
  await en.bye();
  console.log(total + ' pemeriksaan, ' + gagal + ' gagal'); process.exit(gagal ? 1 : 0);
})().catch((e) => { console.log('GALAT UJI', e.stack); process.exit(2); });
