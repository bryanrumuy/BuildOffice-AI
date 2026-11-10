'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');
const laporanfile = require('../lib/laporanfile.js');
const OUT = process.argv[2] || path.join(__dirname, '..', 'contoh-kontraktor');
fs.mkdirSync(OUT, { recursive: true });
const FOOT = '<div style="margin-top:14px;border-top:1px solid #d5d9df;padding-top:4px;font:7.5pt Arial;color:#8a94a3">Dokumen contoh untuk pengujian sistem Kantor AI. Seluruh nama perusahaan, pejabat, nomor, dan angka bersifat fiktif.</div>';
const docs = [...require('./docs1'), ...require('./docs2'), ...require('./docs3'), ...require('./docs4')];
const png = require('./docs2').png;
(async () => {
  const only = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
  let n = 0;
  for (const d of docs) {
    if (only && !only.test(d.f)) continue;
    const pdf = await laporanfile.toPdf(d.html.replace('</body>', FOOT + '</body>'));
    if (!pdf) throw new Error('PDF gagal: ' + d.f);
    fs.writeFileSync(path.join(OUT, d.f), pdf); n++;
  }
  const exe = laporanfile.browserPath();
  for (const g of png) {
    if (only && !only.test(g.f)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foto-')), src = path.join(dir, 'x.html'); fs.writeFileSync(src, g.html, 'utf8');
    await new Promise((res, rej) => execFile(exe, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(dir, 'p')}`, `--window-size=${g.w},${g.h}`, '--force-device-scale-factor=2', `--screenshot=${path.join(OUT, g.f)}`, 'file:///' + src.split(path.sep).join('/')], { timeout: 30000, windowsHide: true }, (e) => (e ? rej(e) : res())));
    fs.rmSync(dir, { recursive: true, force: true }); n++;
  }
  console.log(n + ' berkas ditulis ke ' + OUT);
})().catch((e) => { console.error('GALAT', e.stack || e.message); process.exit(1); });
