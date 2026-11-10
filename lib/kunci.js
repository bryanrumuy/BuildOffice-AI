'use strict';
/**
 * Satu server per folder data. Dua server yang memakai data\ yang sama bisa saling menimpa file JSON, dan semuanya akan
 * menarik pesan bot Telegram yang sama (perintah dijalankan oleh server lama yang belum diperbarui). Kunci berisi PID;
 * kunci milik proses yang sudah mati diabaikan, jadi tidak pernah menghalangi setelah komputer mati mendadak.
 */
const fs = require('fs');
const path = require('path');
const { DATA } = require('./store');

const FILE = path.join(DATA, 'server.lock');
const hidup = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** { ok: true } bila kunci berhasil diambil; { ok: false, pid, port } bila server lain masih hidup. */
function ambil(port) {
  try {
    const l = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (l && l.pid && l.pid !== process.pid && hidup(l.pid)) return { ok: false, pid: l.pid, port: l.port };
  } catch { /* belum ada atau rusak: abaikan */ }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ pid: process.pid, port, mulai: new Date().toISOString() }));
  return { ok: true };
}
/** Lepas kunci hanya jika milik proses ini. */
function lepas() {
  try { const l = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (l.pid === process.pid) fs.rmSync(FILE, { force: true }); } catch { /* sudah tidak ada */ }
}

module.exports = { ambil, lepas, FILE };
