'use strict';
/**
 * Lapisan bahasa. Kode sumber tetap berbahasa Indonesia (bahasa "id", bawaan). Untuk bahasa lain (kini "en") teks tampilan,
 * pesan galat, dan prompt AI diganti SAAT DIMUAT memakai kamus lib/i18n/<bahasa>.json, tanpa mengubah berkas sumber:
 *  - server: hook Module._extensions menerjemahkan lib/*.js dan server.js sebelum dikompilasi;
 *  - klien : middleware menerjemahkan public/*.js dan public/index.html sebelum dikirim.
 * Satuan terjemahan = string, template string, atau rangkaian "a" + b + "c" (dijadikan satu kalimat dengan penampung {#0}, {#1}, ...,
 * sehingga urutan kata bahasa tujuan bebas). Teks yang bukan tampilan (kunci objek, perbandingan, selector, URL, nama kelas CSS,
 * kata tunggal huruf kecil) tidak disentuh supaya logika dan data tersimpan tetap sama.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const BAHASA_ADA = ['id', 'en'];
const TANPA_TERJEMAH = new Set(['Lainnya', 'Material', 'Upah', 'Transport', 'Perizinan', 'Operasional', 'Pajak', 'Penjualan', 'Rp', 'AI', 'OK', 'CSV', 'PDF', 'Excel', 'Word', 'Telegram', 'Docx', 'Xlsx', 'JSON']);
// kata kecil yang bukan teks tampilan (kelas CSS, nilai atribut, status teknis)
const KATA_TEKNIS = new Set(['end', 'idle', 'middle', 'start', 'warn', 'left', 'right', 'center', 'late', 'good', 'bad', 'out', 'off', 'done', 'doing', 'review', 'blocked', 'todo', 'hide', 'show', 'none', 'auto', 'flat', 'iso', 'hidden', 'disabled', 'selected', 'checked', 'button', 'submit', 'admin', 'staf', 'pengamat', 'demo', 'manual']);
// satuan yang kelihatan seperti teks tetapi sebenarnya nama kelas CSS / pengenal
const UNIT_ABAI = new Set(['chip {#0}', 'tag {#0}', 'biaya{#0}', 'kursi{#0}', 'agent {#0}']);
const KUNCI_ABAI = new Set(['class', 'className', 'id', 'style', 'type', 'href', 'src', 'role', 'rel', 'target', 'method', 'for', 'htmlFor', 'name', 'value', 'accept', 'autocomplete', 'inputmode', 'enctype', 'download', 'tabindex', 'viewBox', 'fill', 'stroke', 'd', 'points', 'transform', 'xmlns', 'cursor', 'content-type', 'Content-Type', 'Content-Disposition', 'Cache-Control', 'Set-Cookie', 'cookie', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Content-Security-Policy', 'aria-pressed', 'aria-hidden', 'aria-selected', 'aria-live', 'aria-current', 'aria-expanded', 'aria-controls', 'aria-modal', 'color', 'font', 'filter', 'width', 'height', 'min', 'max', 'step', 'pattern', 'lang', 'charset', 'locale', 'kode', 'warna', 'ikon']);
const METODE_ABAI = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'has', 'get', 'set', 'delete', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches', 'addEventListener', 'removeEventListener', 'test', 'match', 'matchAll', 'split', 'replace', 'replaceAll', 'localeCompare', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute', 'toggle', 'contains', 'on', 'once', 'emit', 'join', 'padStart', 'padEnd', 'normalize', 'charAt', 'on', 'status', 'type', 'header', 'set', 'sendFile', 'static', 'use', 'readFileSync', 'writeFileSync', 'existsSync', 'mkdirSync', 'readdirSync', 'statSync', 'unlinkSync', 'rmSync', 'copyFileSync', 'resolve', 'dirname', 'basename', 'extname', 'relative', 'cwd', 'env']);
const FUNGSI_ABAI = new Set(['require', 'h', '$', '$$', 'api', 'fetch', 'readJson', 'writeJson', 'RegExp', 'setTimeout', 'setInterval', 'parseInt', 'parseFloat', 'Number', 'Symbol', 'Date', 'BigInt', 'execFile', 'spawn', 'exec', 'broadcast', 'audit', 'sig', 'cookieOf', 'need', 'cariAgen', 'findDoc', 'monthOf', 'ensureStatus', 'pos', 'alatBoleh']);

/** Bagian string yang layak jadi teks tampilan (bukan identifier, path, URL, dll). */
function tampakTeks(s, adaEkspr = false) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (adaEkspr && /^[a-zà-ÿ]{3,}$/.test(t) && !KATA_TEKNIS.has(t)) return true; // "{#0} agen": kata kecil di samping nilai adalah label
  if (t.length < 2 || (t.match(/[A-Za-zÀ-ɏ]/g) || []).length < 3) return false;
  if (/^(https?:|\/|\.\/|\.\.\/|#|[a-z]+:\/\/)/i.test(t) && !/\s/.test(t)) return false;
  if (/^[\w.+\-/*]+$/.test(t) && !/^[A-Z][a-z]/.test(t)) return false; // identifier, mime, kebab-case, nama berkas
  if (!/\s/.test(t)) {
    if (!/^[A-ZÀ-Þ][a-zß-ÿ]/.test(t)) return false; // satu kata hanya bila diawali huruf kapital biasa
    if (TANPA_TERJEMAH.has(t.replace(/[^A-Za-z]+$/, ''))) return false;
  }
  if (/^[\w\-]+(\s+[\w\-]+)*$/.test(t) && t === t.toLowerCase() && t.split(/\s+/).every((w) => /^[a-z][a-z0-9_-]*$/.test(w)) && t.split(/\s+/).length <= 3 && !/\b(yang|dan|di|ke|dari|untuk|belum|sudah|tidak|ada|atau|dengan|bisa|harus|lagi|semua|baru|tugas|dokumen|kas|tagihan|proyek|agen)\b/.test(t)) return false; // daftar kelas CSS
  return true;
}

let acorn = null;
const muatAcorn = () => acorn || (acorn = require('acorn'));

const ESC = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const bungkus = (n) => '{#' + n + '}';
const PENAMPUNG = /\{#(\d+)\}/g;

/** Pecah rantai a + b + "c" (asosiatif kiri) menjadi daftar bagian; null bila bukan rangkaian teks. */
function ratakan(node, kode) {
  const daun = [], gabung = [];
  (function kiri(n) { if (n.type === 'BinaryExpression' && n.operator === '+') { kiri(n.left); daun.push(n.right); } else daun.push(n); gabung.push(n); })(node);
  const adaTeks = (n) => (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral';
  const k = daun.findIndex(adaTeks);
  if (k < 0) return null;
  const bagian = [];
  if (k >= 1) {
    // semua daun sebelum teks pertama dijumlahkan dulu (angka), lalu dianggap satu ekspresi
    bagian.push({ node: gabung[k - 1], jumlah: k > 1 });
  }
  for (let i = Math.max(k, 0); i < daun.length; i++) {
    const n = daun[i];
    if (n.type === 'Literal' && typeof n.value === 'string') bagian.push({ teks: n.value });
    else if (n.type === 'TemplateLiteral') {
      n.quasis.forEach((q, j) => { bagian.push({ teks: q.value.cooked }); if (j < n.expressions.length) bagian.push({ node: n.expressions[j] }); });
    } else bagian.push({ node: n });
  }
  return bagian;
}

/**
 * Terjemahkan sumber JS. cari(kunci) -> teks tujuan (dengan {#n}) atau undefined. Bila cari mengembalikan undefined teks dibiarkan.
 * Mengembalikan { kode, satuan: [kunci...] } (satuan = seluruh kunci yang dikenali sebagai teks tampilan).
 */
function olahJs(kode, cari) {
  const ac = muatAcorn();
  const ast = ac.parse(kode, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true });
  const satuan = [], indukDari = new WeakMap();
  (function peta(n) { for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; for (const x of Array.isArray(v) ? v : [v]) if (x && typeof x.type === 'string') { indukDari.set(x, n); peta(x); } } })(ast);
  // kata kecil bermakna tampilan: cabang ? : atau || di dalam teks (`${a ? 'aktif' : 'mati'}`, 'Tanggal ' + (b ? 'bayar' : 'terima'), anak h())
  const posisiTampil = (n) => { let p = indukDari.get(n), anakTeratas = n; while (p && (p.type === 'ConditionalExpression' || p.type === 'LogicalExpression')) { if (p.type === 'ConditionalExpression' && p.test === anakTeratas) return false; anakTeratas = p; p = indukDari.get(p); } return Boolean(p) && (p.type === 'TemplateLiteral' || (p.type === 'BinaryExpression' && p.operator === '+') || (p.type === 'CallExpression' && p.callee.type === 'Identifier' && p.callee.name === 'h' && p.arguments.indexOf(anakTeratas) >= 2)); };
  const katakecil = (n, induk) => n.type === 'Literal' && typeof n.value === 'string' && /^[a-zà-ÿ]{3,}$/.test(n.value) && !KATA_TEKNIS.has(n.value) && induk && (induk.type === 'ConditionalExpression' || induk.type === 'LogicalExpression') && posisiTampil(n);
  const anak = (n) => { const o = []; for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') o.push([x, k]); } else if (v && typeof v.type === 'string') o.push([v, k]); } return o.sort((a, b) => a[0].start - b[0].start); };

  function bolehTerjemah(node, induk, kunci, kakek) {
    if (!induk) return true;
    switch (induk.type) {
      case 'Property': case 'PropertyDefinition': case 'MethodDefinition':
        if (kunci === 'key') return false;
        if (induk.key && !induk.computed) { const nm = induk.key.name || induk.key.value; if (KUNCI_ABAI.has(nm) || /^data-/.test(String(nm))) return false; }
        return true;
      case 'BinaryExpression': if (/^(===|!==|==|!=|<|<=|>|>=|in|instanceof)$/.test(induk.operator)) return false; return true;
      case 'SwitchCase': return kunci !== 'test';
      case 'MemberExpression': return !(kunci === 'property' && induk.computed);
      case 'ImportDeclaration': case 'ExportNamedDeclaration': return false;
      case 'ExpressionStatement': return !induk.directive;
      case 'NewExpression': case 'CallExpression': {
        const c = induk.callee;
        if (kunci === 'callee') return false;
        const nama = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
        if (c.type === 'Identifier' && FUNGSI_ABAI.has(nama)) { if (nama === 'h') return induk.arguments.indexOf(node) > 0; return false; }
        if (c.type === 'MemberExpression' && METODE_ABAI.has(nama)) { if (nama === 'setAttribute') return induk.arguments.indexOf(node) === 1 && /^(aria-label|title|placeholder|alt)$/.test((induk.arguments[0] || {}).value || ''); return false; }
        return true;
      }
      default: return true;
    }
  }

  function render(node, induk, kunci, kakek) {
    // satuan teks?
    const calon = (node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral' || (node.type === 'BinaryExpression' && node.operator === '+');
    if (calon && !(induk && induk.type === 'TemplateLiteral') && bolehTerjemah(node, induk, kunci, kakek)) {
      let bagian = null;
      if (node.type === 'Literal') bagian = [{ teks: node.value }];
      else if (node.type === 'TemplateLiteral') { bagian = []; node.quasis.forEach((q, j) => { bagian.push({ teks: q.value.cooked }); if (j < node.expressions.length) bagian.push({ node: node.expressions[j] }); }); }
      else bagian = ratakan(node, kode);
      if (bagian) {
        const ekspr = []; let tpl = '';
        for (const b of bagian) { if (b.teks !== undefined) tpl += b.teks; else { tpl += bungkus(ekspr.length); ekspr.push(b); } }
        // satu ekspresi tanpa teks lain bukan satuan teks
        if (!UNIT_ABAI.has(tpl) && (tampakTeks(tpl.replace(PENAMPUNG, ''), ekspr.length > 0) || katakecil(node, induk))) {
          satuan.push(tpl);
          const tujuan = cari(tpl);
          if (typeof tujuan === 'string' && tujuan !== tpl) {
            const pakai = new Set(); let ok = true;
            tujuan.replace(PENAMPUNG, (_, i) => { pakai.add(Number(i)); return ''; });
            for (let i = 0; i < ekspr.length; i++) if (!pakai.has(i)) ok = false; // ekspresi hilang: batalkan agar tidak mengubah perilaku
            for (const i of pakai) if (i >= ekspr.length) ok = false;
            if (ok) {
              const sumber = ekspr.map((e) => (e.jumlah ? '(' + render(e.node, node, 'ekspr', induk) + ')' : render(e.node, node, 'ekspr', induk)));
              if (!tujuan.includes('\n') && !/[`\\]/.test(tujuan) && !ekspr.length) return JSON.stringify(tujuan);
              return '`' + ESC(tujuan).replace(PENAMPUNG, (_, i) => '${' + sumber[Number(i)] + '}') + '`';
            }
          }
        }
      }
    }
    // bukan satuan: salin sumber dengan anak yang dirender ulang
    if (node.type === 'Property' && node.shorthand) { // { a } atau { a = 'x' }: kunci dan nilai menempati rentang yang sama
      const v = node.value;
      return v.type === 'AssignmentPattern' ? kode.slice(node.start, v.right.start) + render(v.right, v, 'right', node) + kode.slice(v.right.end, node.end) : kode.slice(node.start, node.end);
    }
    const ks = anak(node);
    if (!ks.length) return kode.slice(node.start, node.end);
    let out = '', pos = node.start;
    for (const [c, k] of ks) { out += kode.slice(pos, c.start) + render(c, node, k, induk); pos = c.end; }
    return out + kode.slice(pos, node.end);
  }
  const awal = kode.startsWith('#!') ? kode.indexOf('\n') : -1;
  const badan = render(ast, null, null, null);
  return { kode: (awal > 0 ? kode.slice(0, awal) : '') + badan, satuan };
}

/** HTML: teks antar tag + atribut tampilan + <script> inline. */
function olahHtml(html, cari, satuan = []) {
  const atribut = /\b(placeholder|title|aria-label|alt|label)="([^"]*)"/g;
  let out = html.replace(/<script(\b[^>]*)>([\s\S]*?)<\/script>/gi, (m, attr, isi) => (/src=/.test(attr) || !isi.trim() ? m : '<script' + attr + '>' + olahJs(isi, cari).kode + '</script>'));
  const bagian = out.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->)/gi);
  out = bagian.map((b, i) => {
    if (i % 2) return b;
    return b.replace(/>([^<>]+)</g, (m, teks) => {
      const t = teks.trim(); if (!t || !tampakTeks(t)) return m;
      const kunci = t.replace(/\s+/g, ' '); satuan.push(kunci);
      const tj = cari(kunci);
      return typeof tj === 'string' ? '>' + teks.replace(t, tj.replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;')) + '<' : m;
    }).replace(atribut, (m, a, v) => { const t = v.trim(); if (!t || !tampakTeks(t)) return m; satuan.push(t); const tj = cari(t); return typeof tj === 'string' ? `${a}="${tj.replace(/"/g, '&quot;')}"` : m; });
  }).join('');
  return { kode: out, satuan };
}

// ---------- kamus dan pemuatan ----------
const kamusCache = {};
function kamus(bahasa) {
  if (kamusCache[bahasa]) return kamusCache[bahasa];
  let k = {};
  try { k = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n', bahasa + '.json'), 'utf8')); } catch { /* belum ada kamus */ }
  return (kamusCache[bahasa] = k);
}

/** Bahasa aktif: env BAHASA, lalu data/settings.json, lalu "id". */
function bahasaAktif() {
  const dari = (v) => (BAHASA_ADA.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : null);
  if (dari(process.env.BAHASA)) return dari(process.env.BAHASA);
  try { const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'settings.json'), 'utf8')); if (dari(s.bahasa)) return dari(s.bahasa); } catch { /* belum ada pengaturan */ }
  return 'id';
}

const bolehModul = (file) => { const rel = path.relative(ROOT, file); return !rel.startsWith('..') && !rel.split(path.sep).includes('node_modules') && /^(server\.js|lib[\\/][^\\/]+\.js)$/.test(rel) && !/bahasa\.js$/.test(rel); };
/** Kamus dengan koreksi per berkas: kunci "public/index.html::Masuk" lebih diutamakan daripada "Masuk" (kata yang artinya bergantung konteks). */
const pencari = (bahasa, berkas) => { const k = kamus(bahasa); return (t) => (berkas && Object.prototype.hasOwnProperty.call(k, berkas + '::' + t) ? k[berkas + '::' + t] : k[t]); };
const relatif = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const terjemahkanKode = (kode, bahasa, berkas) => olahJs(kode, pencari(bahasa, berkas)).kode;

/** Dipanggil di baris pertama server.js. Mengembalikan true bila modul ini sudah dijalankan ulang dalam versi terjemahan (pemanggil harus return). */
function jalankanSebagai(file, mod) {
  const b = bahasaAktif();
  if (b === 'id' || mod.__terjemahan) return false; // versi terjemahan memuat baris yang sama lagi: jangan ulangi
  mod.__terjemahan = true;
  pasangHook(b);
  const kode = terjemahkanKode(fs.readFileSync(file, 'utf8'), b, relatif(file));
  mod.exports = {};
  mod._compile(kode, file); // jalankan sebagai modul yang sama, dengan sumber terjemahan
  return true;
}
let terpasang = null;
function pasangHook(b) {
  if (terpasang === b) return;
  terpasang = b;
  const asli = Module._extensions['.js'];
  Module._extensions['.js'] = function (mod, file) {
    if (!bolehModul(file)) return asli(mod, file);
    mod._compile(terjemahkanKode(fs.readFileSync(file, 'utf8'), b, relatif(file)), file);
  };
}

/** Middleware Express untuk berkas klien (public/*.js dan index.html). Taruh sebelum express.static. */
function middlewareKlien(publicDir, bahasa) {
  const cache = new Map();
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    let p = decodeURIComponent(req.path); if (p === '/') p = '/index.html';
    if (!/\.(js|html)$/.test(p) || p.includes('..')) return next();
    const file = path.join(publicDir, p);
    let st; try { st = fs.statSync(file); } catch { return next(); }
    const kunci = file + ':' + st.mtimeMs;
    if (!cache.has(kunci)) {
      const sumber = fs.readFileSync(file, 'utf8');
      const cari = pencari(bahasa, relatif(file));
      cache.set(kunci, /\.html$/.test(p) ? olahHtml(sumber, cari).kode.replace(/<html lang="[^"]*"/i, '<html lang="' + bahasa + '"') : olahJs(sumber, cari).kode);
    }
    res.set({ 'Content-Type': /\.html$/.test(p) ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.send(cache.get(kunci));
  };
}

module.exports = { BAHASA_ADA, tampakTeks, olahJs, olahHtml, kamus, bahasaAktif, jalankanSebagai, middlewareKlien, terjemahkanKode, pasangHook };
