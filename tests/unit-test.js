'use strict';
/**
 * Uji unit tanpa server: penguraian angka/tanggal & jenis file (lib/extract.js, murni tanpa penyimpanan), dan
 * enkripsi pengaturan di start.ps1 (Save-Config/Load-Config, Windows DPAPI) dijalankan di folder sementara.
 * Jalankan: node tests/unit-test.js
 */
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, penghitung } = require('./bantu/server-sementara');
const ex = require(path.join(ROOT, 'lib', 'extract.js'));

const { cek, selesai } = penghitung();
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function ujiAngka() {
  const kasus = [['Rp 1.276.500.000,-', 1276500000], ['48,75 juta', 48750000], ['1,5 miliar', 1500000000], ['Rp 250.000', 250000], ['12.500,50', 12501], [1500.4, 1500], [0, null], [-5, null], ['abc', null], [null, null], ['2 jt', 2000000], ['3.5 juta', 3500000]];
  const salah = kasus.filter(([i, o]) => ex.parseRupiah(i) !== o).map(([i, o]) => `${JSON.stringify(i)} -> ${ex.parseRupiah(i)} (harus ${o})`);
  cek('parseRupiah: format Indonesia (titik ribuan, koma desimal, juta/miliar)', salah.length === 0, salah.join('; '));
  const pct = [['41,5%', 41.5], [100, 100], [101, null], [-1, null], ['abc', null], ['33.33', 33.3]];
  const salahPct = pct.filter(([i, o]) => ex.cleanPct(i) !== o).map(([i]) => i);
  cek('cleanPct: 0..100 dengan satu desimal, di luar rentang -> null', salahPct.length === 0, salahPct.join());
  cek('cleanDate: hanya YYYY-MM-DD yang valid', ex.cleanDate('2026-02-01') === '2026-02-01' && ex.cleanDate('2026-13-45') === null && ex.cleanDate('01/02/2026') === null && ex.cleanDate(20260201) === null);
  cek('today: format YYYY-MM-DD (tanggal lokal)', /^\d{4}-\d{2}-\d{2}$/.test(ex.today()));
}

function ujiJenisFile() {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
  const hasil = [ex.sniff(Buffer.from('%PDF-1.7')), ex.sniff(png), ex.sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), ex.sniff(webp), ex.sniff(Buffer.from('teks biasa')), ex.sniff(Buffer.from([0x4d, 0x5a, 0x00]))];
  cek('sniff: jenis file dari isi (pdf, png, jpeg, webp, teks), biner lain ditolak', sama(hasil, ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', null]), JSON.stringify(hasil));
  cek('sniff: ekstensi palsu tidak berpengaruh (PDF berisi biner -> ditolak)', ex.sniff(Buffer.from([0, 1, 2, 3])) === null);
}

function ujiNormalisasi() {
  const kat = ['Material', 'Lainnya'];
  const n = ex.normalize({ jenis: 'invoice', judul: '  Invoice  ', nilai: 'Rp 2.000.000', kategori: 'Material', pihak: [{ nama: 'PT A' }, 'CV B', 5], arah_uang: 'keluar',
    jadwal: [{ label: 'Termin 1', tanggal: '2026-03-01', jumlah: '1 juta', arah: 'bayar' }, { label: 'tanpa tanggal' }, null, { tanggal: '2026-04-01', arah: 'x' }],
    poin: ['a', '', 7, 'b'], proyek: { nama: 'Gedung', periode: '2026-10', progres_fisik: '45,5%', anggaran: '1 miliar' } }, 'cadangan.pdf', kat);
  cek('normalize: judul dirapikan, nilai_angka dari teks nilai, pihak daftar digabung', n.judul === 'Invoice' && n.nilai_angka === 2000000 && n.pihak === 'PT A, CV B' && n.kategori === 'Material', JSON.stringify(n));
  cek('normalize: jadwal tanpa tanggal dibuang, label & arah default', n.jadwal.length === 2 && n.jadwal[0].jumlah === 1000000 && n.jadwal[1].label === 'Tenggat' && n.jadwal[1].arah === null, JSON.stringify(n.jadwal));
  cek('normalize: poin hanya teks, proyek dinormalkan', sama(n.poin, ['a', 'b']) && n.proyek && n.proyek.progres_fisik === 45.5 && n.proyek.anggaran === 1e9, JSON.stringify(n.proyek));
  const kosong = ex.normalize('bukan objek', 'nama.pdf', kat);
  cek('normalize: masukan rusak -> nilai aman (jenis lainnya, judul cadangan)', kosong.jenis === 'lainnya' && kosong.judul === 'nama.pdf' && kosong.jadwal.length === 0 && kosong.proyek === null);
  cek('parseJsonReply: ambil JSON dari teks AI; bukan JSON -> galat jelas', sama(ex.parseJsonReply('Ini hasilnya: {"a":1} selesai'), { a: 1 }) && (() => { try { ex.parseJsonReply('tidak ada'); return false; } catch (e) { return /JSON/.test(e.message); } })());
  const d = ex.demoExtract('KWITANSI No: KW-9\nCV Maju Jaya\n2026-05-02\nTotal Rp 750.000', 'Kwitansi Pasir.txt', kat);
  cek('demoExtract: kwitansi, nomor, pihak, nilai tanpa AI', d.jenis === 'kwitansi' && d.nomor === 'KW-9' && /CV Maju Jaya/.test(d.pihak) && d.nilai_angka === 750000 && d.jatuh_tempo === null, JSON.stringify(d));
}

/** Enkripsi pengaturan (data\config.dpapi) memakai fungsi asli dari start.ps1, di folder sementara. */
function ujiEnkripsiPengaturan() {
  if (process.platform !== 'win32') { console.log('LEWATI enkripsi pengaturan DPAPI (hanya di Windows)'); return; }
  const sumber = fs.readFileSync(path.join(ROOT, 'start.ps1'), 'utf8');
  const a = sumber.indexOf('$cfgFile ='), b = sumber.indexOf('function New-AutoAccount');
  if (!cek('start.ps1: blok Load-Config/Save-Config ditemukan', a > 0 && b > a)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-dpapi-'));
  const RAHASIA = 'sk-uji-rahasia-' + Date.now();
  const skrip = `$ErrorActionPreference = 'Stop'\n${sumber.slice(a, b)}
foreach ($k in $persistKeys) { [Environment]::SetEnvironmentVariable($k, $null, 'Process') }
$env:ANTHROPIC_API_KEY = '${RAHASIA}'; $env:OFFICE_USERS = 'bos:sandi-uji|admin'
if (-not (Save-Config)) { throw 'Save-Config gagal' }
$c = Load-Config
Write-Output ('JSON=' + ($c | ConvertTo-Json -Compress))
Set-Content $cfgFile 'rusak-bukan-dpapi' -Encoding ascii
$r = Load-Config
Write-Output ('RUSAK=' + ($null -eq $r))
foreach ($k in $persistKeys) { [Environment]::SetEnvironmentVariable($k, $null, 'Process') }
Remove-Item $cfgFile
Write-Output ('KOSONG=' + (Save-Config))\n`;
  fs.writeFileSync(path.join(dir, 'uji.ps1'), skrip);
  // Periksa isi berkas terenkripsi lewat skrip terpisah yang hanya menjalankan Save-Config (uji.ps1 nanti merusaknya).
  fs.writeFileSync(path.join(dir, 'simpan.ps1'), `$ErrorActionPreference = 'Stop'\n${sumber.slice(a, b)}\nforeach ($k in $persistKeys) { [Environment]::SetEnvironmentVariable($k, $null, 'Process') }\n$env:ANTHROPIC_API_KEY = '${RAHASIA}'\n[void](Save-Config)\n`);
  const exe = [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), 'powershell.exe'].find((p) => !path.isAbsolute(p) || fs.existsSync(p));
  const ps = (f) => spawnSync(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(dir, f)], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  try {
    const s1 = ps('simpan.ps1');
    if (s1.error) { console.log('LEWATI enkripsi pengaturan DPAPI (powershell.exe tidak tersedia: ' + s1.error.message + ')'); return; }
    const f = path.join(dir, 'data', 'config.dpapi');
    const isiFile = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    cek('DPAPI: Save-Config menulis data/config.dpapi', isiFile.length > 100, (s1.stderr || '').slice(0, 300));
    cek('DPAPI: kunci API tidak tersimpan polos (juga bukan base64/UTF-16 polos)', !isiFile.includes(RAHASIA) && !isiFile.includes(Buffer.from(RAHASIA).toString('base64')) && !Buffer.from(isiFile.trim(), 'hex').toString('utf16le').includes(RAHASIA) && /^[0-9a-f]+\s*$/i.test(isiFile));
    const r = ps('uji.ps1'), out = r.stdout || '';
    const json = (out.match(/^JSON=(.*)$/m) || [])[1];
    let cfg = null; try { cfg = JSON.parse(json); } catch { /* dicek di bawah */ }
    cek('DPAPI: Load-Config membuka kembali isi yang sama (akun Windows ini)', cfg && cfg.ANTHROPIC_API_KEY === RAHASIA && cfg.OFFICE_USERS === 'bos:sandi-uji|admin' && Object.keys(cfg).length === 2, out + (r.stderr || '').slice(0, 300));
    cek('DPAPI: berkas rusak / dari akun lain -> Load-Config null (tidak melempar)', /^RUSAK=True/m.test(out), out);
    cek('DPAPI: tidak ada yang disimpan bila tidak ada pengaturan', /^KOSONG=False/m.test(out) && !fs.existsSync(f), out);
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* abaikan */ } }
}

ujiAngka();
ujiJenisFile();
ujiNormalisasi();
ujiEnkripsiPengaturan();
process.exit(selesai());
