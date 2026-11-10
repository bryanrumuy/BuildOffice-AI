'use strict';
/** Penyimpanan JSON sederhana di folder data\ (tulis atomik lewat file .tmp). */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const UPLOADS = path.join(DATA, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true, mode: 0o700 });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); } catch { return fallback; }
}
function writeJson(file, obj) {
  const tmp = path.join(DATA, file + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, path.join(DATA, file));
}

module.exports = { DATA, UPLOADS, readJson, writeJson };
