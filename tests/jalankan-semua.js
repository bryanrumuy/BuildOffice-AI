'use strict';
/**
 * Jalankan semua berkas uji tests/*-test.js berurutan (tiap berkas di proses sendiri) dan cetak jumlah pemeriksaan.
 * Dipakai oleh "npm test". Tiap berkas wajib mencetak baris "N pemeriksaan, M gagal" dan keluar dengan kode 0 bila lulus.
 */
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');

const berkas = fs.readdirSync(__dirname).filter((f) => f.endsWith('-test.js')).sort();
let total = 0, gagal = 0;
const masalah = [];
for (const f of berkas) {
  const mulai = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || ''), m = out.match(/(\d+) pemeriksaan, (\d+) gagal/);
  const n = m ? Number(m[1]) : 0, g = m ? Number(m[2]) : 0;
  total += n; gagal += g;
  const lulus = r.status === 0 && m && g === 0;
  if (!lulus) masalah.push(f);
  console.log(`${lulus ? 'LULUS' : 'GAGAL'}  ${f.padEnd(22)} ${String(n).padStart(4)} pemeriksaan, ${g} gagal  (${((Date.now() - mulai) / 1000).toFixed(1)} dtk)`);
  const rincian = out.split('\n').filter((l) => l.trim() && !/^\d+ pemeriksaan, \d+ gagal$/.test(l.trim()));
  if (!lulus || rincian.some((l) => /^LEWATI/.test(l))) for (const l of rincian) console.log('       ' + l);
  if (!m && r.error) console.log('       ' + r.error.message);
}
console.log(`\nTotal: ${total} pemeriksaan di ${berkas.length} berkas, ${gagal} gagal${masalah.length ? ' (bermasalah: ' + masalah.join(', ') + ')' : ''}`);
process.exit(masalah.length ? 1 : 0);
