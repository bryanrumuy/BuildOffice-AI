'use strict';
// Mengumpulkan semua satuan teks tampilan (Indonesia) dari kode sumber dan HTML ke alat/bahasa-satuan.json (kunci -> daftar berkas).
// Pakai: node alat/bahasa-ekstrak.js
const fs = require('fs'), path = require('path');
const B = require('../lib/bahasa');
const ROOT = path.join(__dirname, '..');
const berkas = ['server.js', ...fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js') && f !== 'bahasa.js').map((f) => 'lib/' + f),
  ...fs.readdirSync(path.join(ROOT, 'public')).filter((f) => /\.(js|html)$/.test(f)).map((f) => 'public/' + f)];
const peta = {};
for (const f of berkas) {
  const kode = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hasil = /\.html$/.test(f) ? B.olahHtml(kode, () => undefined) : B.olahJs(kode, () => undefined);
  for (const k of hasil.satuan) (peta[k] = peta[k] || new Set()).add(f);
}
const out = Object.fromEntries(Object.entries(peta).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, [...v]]));
fs.writeFileSync(path.join(__dirname, 'bahasa-satuan.json'), JSON.stringify(out, null, 1));
const n = Object.keys(out).length, huruf = Object.keys(out).reduce((a, k) => a + k.length, 0);
console.log(berkas.length + ' berkas, ' + n + ' satuan unik, ' + huruf + ' karakter');
