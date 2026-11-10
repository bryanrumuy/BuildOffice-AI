'use strict';
/**
 * Penjaga Sistem: pemeriksaan kesehatan (tanpa token) dan perbaikan yang AMAN: mengulang dokumen yang gagal karena
 * gangguan sementara, membuat backup, dan memberi peringatan. Ia TIDAK PERNAH mengubah kode atau menghapus data.
 */
const fs = require('fs');
const path = require('path');
const { DATA, UPLOADS } = require('./store');

const BACKUP_DIR = path.join(DATA, 'backup');
const KEEP_SNAPSHOTS = 7, BACKUP_STALE_HOURS = 36, AUTO_BACKUP_HOURS = 24, DISK_WARN_GB = 2, DISK_DANGER_GB = 0.5, MEM_WARN_MB = 800, TOKEN_WARN = 0.8, STUCK_MIN = 10, MAX_RETRY = 2;
const TRANSIENT = /timeout|timed out|fetch failed|ECONN|ETIMEDOUT|EAI_AGAIN|API error (5\d\d|429)/i; // gangguan sementara; bukan kunci salah atau token habis
const SKIP = new Set(['secret.json', 'config.dpapi']); // rahasia tidak ikut dicadangkan
const SNAP_RE = /^\d{8}-\d{6}$/;
const stampOf = (d = new Date()) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})(\d{6})$/, '$1-$2');

const snapshots = () => { try { return fs.readdirSync(BACKUP_DIR).filter((n) => SNAP_RE.test(n)).sort(); } catch { return []; } };
function lastBackup() {
  const s = snapshots(); if (!s.length) return null;
  const n = s[s.length - 1], t = Date.UTC(+n.slice(0, 4), +n.slice(4, 6) - 1, +n.slice(6, 8), +n.slice(9, 11), +n.slice(11, 13), +n.slice(13, 15));
  return { nama: n, umurJam: (Date.now() - t) / 3600000 };
}
/** Salin berkas data (JSON, log) ke snapshot baru, dan cermin file asli secara inkremental. Simpan 7 snapshot terakhir. */
function backup() {
  const nama = stampOf(), dest = path.join(BACKUP_DIR, nama), up = path.join(BACKUP_DIR, 'uploads');
  fs.mkdirSync(dest, { recursive: true }); fs.mkdirSync(up, { recursive: true });
  let berkas = 0, uploadBaru = 0;
  for (const f of fs.readdirSync(DATA, { withFileTypes: true })) {
    if (f.isFile() && !SKIP.has(f.name) && !f.name.endsWith('.tmp')) { fs.copyFileSync(path.join(DATA, f.name), path.join(dest, f.name)); berkas++; }
  }
  if (fs.existsSync(UPLOADS)) for (const f of fs.readdirSync(UPLOADS)) if (!fs.existsSync(path.join(up, f))) { fs.copyFileSync(path.join(UPLOADS, f), path.join(up, f)); uploadBaru++; }
  for (const lama of snapshots().slice(0, -KEEP_SNAPSHOTS)) fs.rmSync(path.join(BACKUP_DIR, lama), { recursive: true, force: true });
  return { snapshot: nama, berkas, uploadBaru };
}

/** c: { docs, antrean, berjalan, tokens, limit, mode, supervised } -> [{ id, nama, status: ok|info|peringatan|bahaya, ket }] */
function periksa(c) {
  const out = [], add = (id, nama, status, ket) => out.push({ id, nama, status, ket });
  const mb = Math.round(process.memoryUsage().rss / 1048576), up = process.uptime();
  add('server', 'Server', mb > MEM_WARN_MB ? 'peringatan' : 'ok', `Hidup ${Math.floor(up / 3600)} jam ${Math.floor(up / 60) % 60} menit, memori ${mb} MB`);
  try { const s = fs.statfsSync(DATA), gb = s.bavail * s.bsize / 1e9; add('disk', 'Ruang disk', gb < DISK_DANGER_GB ? 'bahaya' : gb < DISK_WARN_GB ? 'peringatan' : 'ok', `${gb.toFixed(1)} GB bebas`); }
  catch { add('disk', 'Ruang disk', 'info', 'Tidak bisa dibaca di sistem ini'); }
  try { fs.accessSync(DATA, fs.constants.W_OK); add('tulis', 'Folder data', 'ok', 'Bisa ditulis'); } catch { add('tulis', 'Folder data', 'bahaya', 'Tidak bisa ditulis: data baru tidak akan tersimpan'); }
  const gagal = c.docs.filter((d) => d.status === 'gagal');
  add('gagal', 'Dokumen gagal dibaca', gagal.length ? 'peringatan' : 'ok', gagal.length ? `${gagal.length} dokumen: ${gagal.slice(0, 3).map((d) => d.originalName).join(', ')}` : 'Tidak ada');
  const macet = c.docs.filter((d) => d.status === 'diproses' && Date.now() - Date.parse(d.uploadedAt) > STUCK_MIN * 60000 && !c.antrean && !c.berjalan);
  add('macet', 'Dokumen macet', macet.length ? 'bahaya' : 'ok', macet.length ? `${macet.length} dokumen berstatus "diproses" lebih dari ${STUCK_MIN} menit` : 'Tidak ada');
  if (c.mode === 'ai') { const r = c.limit ? c.tokens / c.limit : 0; add('token', 'Batas token bulan ini', r >= 1 ? 'bahaya' : r >= TOKEN_WARN ? 'peringatan' : 'ok', `${Math.round(r * 100)}% terpakai (${c.tokens.toLocaleString('id-ID')} dari ${c.limit.toLocaleString('id-ID')})`); }
  else add('token', 'Penyedia AI', 'info', 'Mode demo (tanpa AI)');
  const lb = lastBackup();
  add('backup', 'Backup data', !lb || lb.umurJam > BACKUP_STALE_HOURS ? 'peringatan' : 'ok', lb ? `Terakhir ${Math.round(lb.umurJam)} jam lalu (${lb.nama})` : 'Belum pernah dibuat');
  add('pengawas', 'Restart otomatis', c.supervised ? 'ok' : 'peringatan', c.supervised ? 'Aktif (dijalankan lewat start.bat)' : 'Tidak aktif: jalankan lewat start.bat agar server hidup lagi sendiri bila mati');
  return out;
}

/** Ulangi dokumen gagal karena gangguan sementara (maks 2x per dokumen). paksa = abaikan jenis galat & batas (aksi manual admin). */
function perbaiki({ docs, retry, retryCounts, paksa = false }) {
  const aksi = [];
  for (const d of docs.filter((x) => x.status === 'gagal')) {
    const n = retryCounts.get(d.id) || 0;
    if (!paksa && (n >= MAX_RETRY || !TRANSIENT.test(d.error || ''))) continue;
    retry(d.id); retryCounts.set(d.id, n + 1);
    aksi.push({ jenis: 'ulang-dokumen', ket: `Mengulang "${d.originalName}" (percobaan ${n + 1})` });
  }
  return aksi;
}

module.exports = { periksa, backup, lastBackup, snapshots, perbaiki, AUTO_BACKUP_HOURS, BACKUP_DIR };
