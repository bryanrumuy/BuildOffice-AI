'use strict';
/**
 * Uji keamanan: login, sesi bertanda tangan, peran (401/403), header keamanan, path traversal pada unduhan,
 * pengaturan & rahasia (secret.json, config.dpapi tidak ikut backup), dan batas percobaan login.
 * Jalankan: node tests/keamanan-test.js  (server di SALINAN sementara dengan data kosong; data asli tidak disentuh)
 */
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { penghitung, mulaiServer, klien } = require('./bantu/server-sementara');

const { cek, selesai } = penghitung();
const AKUN = 'uji:sandi-uji-1|admin,staf1:sandi-staf-1|staf,lihat:sandi-lihat-1|pengamat';

/** GET dengan path mentah (fetch menormalkan "../" dan "%2e%2e", jadi tidak bisa dipakai untuk uji traversal). */
const getMentah = (port, jalur, cookie) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: jalur, method: 'GET', headers: cookie ? { cookie } : {} }, (res) => {
    const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, teks: Buffer.concat(c).toString('utf8') }));
  });
  req.on('error', reject); req.end();
});

async function ujiLogin(s, kunciRahasia) {
  const anon = klien(s.url);
  const salah = await anon.post('/api/login', { user: 'uji', password: 'salah' });
  cek('login: sandi salah -> 401 dengan pesan umum', salah.status === 401 && /Nama atau sandi salah/.test(salah.json && salah.json.error), salah.teks);
  const tanpa = await anon.post('/api/login', { user: 'tidak-ada', password: 'sandi-uji-1' });
  cek('login: pengguna tak dikenal -> 401 (pesan sama, tidak membocorkan nama)', tanpa.status === 401 && tanpa.json.error === salah.json.error, tanpa.teks);
  const kosong = await anon.post('/api/login', {});
  cek('login: badan kosong -> 401, bukan 500', kosong.status === 401, kosong.status);

  const admin = klien(s.url), r = await admin.masuk('uji', 'sandi-uji-1'), sc = r.header.get('set-cookie') || '';
  cek('login: sandi benar -> 200 dan nama pengguna', r.status === 200 && r.json.user === 'uji', r.teks);
  cek('login: cookie sesi HttpOnly + SameSite=Strict + Path=/', /^sid=/.test(sc) && /HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc) && /Path=\//.test(sc), sc);
  const me = await admin.get('/api/me');
  cek('/api/me: peran admin, mode demo tanpa kunci AI, Telegram mati', me.status === 200 && me.json.role === 'admin' && me.json.mode === 'demo' && me.json.provider === null && me.json.telegram === false, me.teks.slice(0, 200));

  // Token dirusak / dipalsukan
  const sid = decodeURIComponent(admin.cookie.slice(4)), [b, mac] = sid.split('.');
  const rusak = mac.slice(0, -1) + (mac.slice(-1) === 'A' ? 'B' : 'A');
  cek('sesi: tanda tangan dirusak -> 401', (await klien(s.url, 'sid=' + encodeURIComponent(b + '.' + rusak)).get('/api/me')).status === 401);
  const palsu = Buffer.from(JSON.stringify({ u: 'uji', exp: Date.now() + 1e9 })).toString('base64url');
  cek('sesi: isi diganti tanpa kunci -> 401', (await klien(s.url, 'sid=' + encodeURIComponent(palsu + '.' + mac)).get('/api/me')).status === 401);
  const tanda = (obj) => { const x = Buffer.from(JSON.stringify(obj)).toString('base64url'); return 'sid=' + encodeURIComponent(x + '.' + crypto.createHmac('sha256', kunciRahasia).update(x).digest('base64url')); };
  cek('sesi: token kedaluwarsa (ditandatangani benar) -> 401', (await klien(s.url, tanda({ u: 'uji', exp: Date.now() - 1000 })).get('/api/me')).status === 401);
  cek('sesi: token untuk pengguna yang tidak terdaftar -> 401', (await klien(s.url, tanda({ u: 'hantu', exp: Date.now() + 60000 })).get('/api/me')).status === 401);
  cek('sesi: token sah buatan sendiri (kendali positif) -> 200', (await klien(s.url, tanda({ u: 'uji', exp: Date.now() + 60000 })).get('/api/me')).status === 200);
  cek('sesi: cookie sampah -> 401', (await klien(s.url, 'sid=abc').get('/api/me')).status === 401);

  const keluar = await admin.post('/api/logout', {});
  cek('logout: cookie dihapus (Max-Age=0)', keluar.status === 200 && /sid=;.*Max-Age=0/.test(keluar.header.get('set-cookie') || ''), keluar.header.get('set-cookie'));
  return 3; // jumlah login gagal yang sudah tercatat untuk IP ini
}

async function ujiPenjaga(s) {
  const anon = klien(s.url);
  const GET = ['/api/me', '/api/docs', '/api/tagihan', '/api/kas', '/api/proyek', '/api/tugas', '/api/rapat', '/api/hasil', '/api/berkas', '/api/dashboard', '/api/reminders', '/api/kesehatan', '/api/agen', '/api/persetujuan', '/api/events'];
  const lolos = [];
  for (const j of GET) { const r = await anon.get(j); if (r.status !== 401) lolos.push(j + '=' + r.status); }
  cek('tanpa login: semua GET data -> 401', lolos.length === 0, lolos.join(', '));
  const TULIS = [['post', '/api/docs'], ['post', '/api/tagihan'], ['post', '/api/proyek'], ['post', '/api/tugas'], ['post', '/api/rapat'], ['put', '/api/settings'], ['post', '/api/chat'], ['post', '/api/perintah'], ['del', '/api/berkas/x'], ['del', '/api/hasil/x'], ['post', '/api/penjaga/backup']];
  const lolos2 = [];
  for (const [m, j] of TULIS) { const r = await anon[m](j, m === 'del' ? undefined : {}); if (r.status !== 401) lolos2.push(m + ' ' + j + '=' + r.status); }
  cek('tanpa login: semua tulis -> 401', lolos2.length === 0, lolos2.join(', '));

  const lihat = klien(s.url); await lihat.masuk('lihat', 'sandi-lihat-1');
  cek('pengamat: boleh membaca (GET /api/docs 200)', (await lihat.get('/api/docs')).status === 200);
  const fd = new FormData(); fd.append('files', new Blob(['halo']), 'a.txt');
  const PENGAMAT = [['post', '/api/docs', fd], ['post', '/api/tagihan', { label: 'x', tanggal: '2030-01-01', jumlah: 1 }], ['post', '/api/proyek', { nama: 'x', bulan: '2026-01', progres: 1 }],
    ['post', '/api/tugas', { judul: 'x' }], ['post', '/api/rapat', {}], ['post', '/api/kas', { uraian: 'x', jumlah: 1 }], ['patch', '/api/docs/x', {}], ['put', '/api/settings', { namaKantor: 'x' }]];
  const salah = [];
  for (const [m, j, b] of PENGAMAT) { const r = await lihat[m](j, b); if (r.status !== 403) salah.push(m + ' ' + j + '=' + r.status); }
  cek('pengamat: semua tulis -> 403', salah.length === 0, salah.join(', '));
  cek('pengamat: tulis ditolak tanpa membuat data', (await lihat.get('/api/tugas')).json.length === 0 && (await lihat.get('/api/docs')).json.length === 0);

  const staf = klien(s.url); await staf.masuk('staf1', 'sandi-staf-1');
  const ADMIN = [['put', '/api/settings', { namaKantor: 'x' }], ['del', '/api/docs/x'], ['del', '/api/tagihan/x'], ['del', '/api/tugas/x'], ['del', '/api/proyek/x'], ['del', '/api/berkas/x'], ['del', '/api/hasil/x'],
    ['post', '/api/penjaga/backup', {}], ['post', '/api/agen', {}], ['post', '/api/notify/digest', {}], ['post', '/api/rapat/x/telegram', {}]];
  const salah2 = [];
  for (const [m, j, b] of ADMIN) { const r = await staf[m](j, b); if (r.status !== 403) salah2.push(m + ' ' + j + '=' + r.status); }
  cek('staf: aksi khusus admin -> 403', salah2.length === 0, salah2.join(', '));
  cek('staf: boleh menulis (POST /api/tugas 201)', (await staf.post('/api/tugas', { judul: 'Tugas staf' })).status === 201);
}

async function ujiHeaderDanTraversal(s, kunciRahasia, adminCookie) {
  const r = await fetch(s.url + '/'), h = (n) => r.headers.get(n) || '';
  cek('header keamanan: nosniff, DENY, no-referrer, CSP frame-ancestors, tanpa X-Powered-By', h('x-content-type-options') === 'nosniff' && h('x-frame-options') === 'DENY' && h('referrer-policy') === 'no-referrer' && /frame-ancestors 'none'/.test(h('content-security-policy')) && !r.headers.has('x-powered-by'));

  const JALUR = ['/api/berkas/..%2F..%2Fsecret.json/unduh', '/api/berkas/%2e%2e%2fsecret.json/unduh', '/api/berkas/..%5C..%5Csecret.json/unduh', '/api/docs/..%2Fsecret.json/file', '/api/docs/..%2F..%2Fdata%2Fsecret.json/file',
    '/api/hasil/..%2F..%2Fsecret.json.txt', '/api/hasil/..%2Fsecret.txt', '/../data/secret.json', '/..%2fdata%2fsecret.json', '/%2e%2e/data/secret.json', '/%2e%2e%2fdata%2fsecret.json', '/..%5cdata%5csecret.json',
    '/data/secret.json', '/lib/store.js', '/server.js', '/../server.js', '/public/../data/secret.json'];
  const bocor = [], bukan404 = [];
  for (const j of JALUR) {
    const x = await getMentah(s.port, j, adminCookie);
    if (x.teks.includes(kunciRahasia) || /require\(|readJson/.test(x.teks)) bocor.push(j);
    if (![400, 403, 404].includes(x.status)) bukan404.push(j + '=' + x.status);
  }
  cek('path traversal: tidak ada jalur yang membocorkan secret.json atau kode server', bocor.length === 0, bocor.join(', '));
  cek('path traversal: semua jalur berbahaya -> 400/403/404', bukan404.length === 0, bukan404.join(', '));
  cek('path traversal: tanpa login pun tetap ditolak', (await getMentah(s.port, '/api/berkas/..%2F..%2Fsecret.json/unduh')).status === 401);
}

async function ujiPengaturan(s) {
  const admin = klien(s.url); await admin.masuk('uji', 'sandi-uji-1');
  const kosong = await admin.put('/api/settings', { namaKantor: '   ', kategori: [] });
  cek('pengaturan: nama kantor kosong -> 400', kosong.status === 400, kosong.teks);
  const r = await admin.put('/api/settings', { namaKantor: '  PT Uji Konstruksi  ', kategori: ['Material', 'Material', '', 123, 'Upah'], bidang: 'tidak-ada', bahasa: 'xx' });
  cek('pengaturan: nama dirapikan, kategori unik + "Lainnya" ditambahkan, bahasa tak dikenal -> id',
    r.status === 200 && r.json.namaKantor === 'PT Uji Konstruksi' && JSON.stringify(r.json.kategori) === '["Material","Upah","Lainnya"]' && r.json.bahasa === 'id', r.teks);
  const tersimpan = JSON.parse(fs.readFileSync(path.join(s.dir, 'data', 'settings.json'), 'utf8'));
  cek('pengaturan: tersimpan di data/settings.json salinan uji', tersimpan.namaKantor === 'PT Uji Konstruksi', JSON.stringify(tersimpan));
  cek('pengaturan: /api/me memakai nama & kategori baru', (await admin.get('/api/me')).json.kantor === 'PT Uji Konstruksi');
  const banyak = await admin.put('/api/settings', { namaKantor: 'x'.repeat(200), kategori: Array.from({ length: 40 }, (_, i) => 'K' + i) });
  cek('pengaturan: nama dipotong 80 karakter, kategori maks 20 (+Lainnya)', banyak.json.namaKantor.length === 80 && banyak.json.kategori.length === 21, banyak.json.kategori.length);

  const sec = JSON.parse(fs.readFileSync(path.join(s.dir, 'data', 'secret.json'), 'utf8'));
  cek('rahasia: secret.json berisi kunci acak 256-bit (hex 64)', /^[0-9a-f]{64}$/.test(sec.key), sec.key && sec.key.length);

  const b = await admin.post('/api/penjaga/backup', {});
  const snap = b.json && path.join(s.dir, 'data', 'backup', b.json.snapshot), isi = snap && fs.existsSync(snap) ? fs.readdirSync(snap) : [];
  cek('backup: snapshot dibuat oleh admin', b.status === 200 && isi.includes('settings.json'), b.teks + ' ' + isi.join());
  cek('backup: secret.json dan config.dpapi (terenkripsi) TIDAK ikut dicadangkan', !isi.includes('secret.json') && !isi.includes('config.dpapi') && !isi.some((n) => n.endsWith('.tmp')), isi.join());
}

async function ujiBatasLogin(s, gagalSebelumnya) {
  const anon = klien(s.url);
  const status = [];
  for (let i = gagalSebelumnya; i < 10; i++) status.push((await anon.post('/api/login', { user: 'uji', password: 'salah-' + i })).status);
  cek('batas login: 10 percobaan gagal pertama -> 401', status.every((x) => x === 401), status.join());
  const ke11 = await anon.post('/api/login', { user: 'uji', password: 'salah' });
  cek('batas login: percobaan ke-11 -> 429', ke11.status === 429 && /Terlalu banyak/.test(ke11.json.error), ke11.teks);
  const benar = await anon.post('/api/login', { user: 'uji', password: 'sandi-uji-1' });
  cek('batas login: sandi benar pun ditolak selama terkunci (tanpa cookie)', benar.status === 429 && !benar.header.get('set-cookie'), benar.status);
  const audit = fs.readFileSync(path.join(s.dir, 'data', 'audit.log'), 'utf8');
  cek('batas login: kegagalan dicatat di audit.log tanpa menyimpan sandi', /"login-gagal"/.test(audit) && !audit.includes('salah-3') && !audit.includes('sandi-uji-1'));
}

(async () => {
  const s = await mulaiServer({ env: { OFFICE_USERS: AKUN }, siapkan: (dir) => fs.writeFileSync(path.join(dir, 'data', 'config.dpapi'), 'tiruan-terenkripsi') });
  try {
    const kunciRahasia = JSON.parse(fs.readFileSync(path.join(s.dir, 'data', 'secret.json'), 'utf8')).key;
    const gagal = await ujiLogin(s, kunciRahasia);
    await ujiPenjaga(s);
    const admin = klien(s.url); await admin.masuk('uji', 'sandi-uji-1');
    await ujiHeaderDanTraversal(s, kunciRahasia, admin.cookie);
    await ujiPengaturan(s);
    await ujiBatasLogin(s, gagal); // terakhir: setelah ini IP uji terkunci 15 menit
  } finally { await s.tutup(); }
  process.exit(selesai());
})().catch((e) => { console.log('GALAT UJI', e.stack); process.exit(2); });
