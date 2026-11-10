'use strict';
/**
 * Excel kantoran: rumus hidup (bukan angka mati), format rupiah/tanggal/persen, banyak lembar, ringkasan lintas lembar,
 * sel isian berwarna, dropdown + warna status, siap cetak A4. Semua rumus dihitung dulu (fast-formula-parser) agar hasilnya
 * tersimpan di berkas (tampil benar di pratinjau/ponsel) dan agar error rumus tertangkap SEBELUM berkas dibuat.
 * Konvensi mengikuti skill xlsx publik (anthropics/skills): rumus bukan hasil hitung mati, nol error, asumsi tertulis,
 * isian biru, persen disimpan sebagai pecahan.
 */
const ExcelJS = require('exceljs');
const FormulaParser = require('fast-formula-parser');

const MAX_LEMBAR = 10, MAX_BARIS = 5000, MAX_KOLOM = 40, MAX_RUMUS = 400;
const WARNA = { tinta: 'FF16213A', abu: 'FF4B5563', redup: 'FF7A828C', garis: 'FFD6D9DE', isian: 'FF0000FF', isianLatar: 'FFFFF9DB' };
const FONT = 'Arial';
const FORMAT = {
  rupiah: '#,##0;(#,##0);"-"', angka: '#,##0;(#,##0);"-"', persen: '0.0%;(0.0%);"-"', tanggal: 'dd mmm yyyy', catatan: '@',
};
const FORMAT_KPI = { rupiah: '"Rp "#,##0;("Rp "#,##0);"-"' }; // angka utama di ringkasan memakai awalan Rp
const GAYA_BARIS = ['judul', 'subtotal', 'total', 'indent', 'indent2'];
const TIPE = ['teks', 'tanggal', 'rupiah', 'angka', 'persen', 'status', 'kode', 'catatan'];
const TOTAL_FN = { jumlah: 'SUM', rata: 'AVERAGE', min: 'MIN', maks: 'MAX', hitung: 'COUNTA' };
const DILARANG = /\b(WEBSERVICE|HYPERLINK|FILTERXML|CALL|REGISTER|EXEC|SHELL|DDE|RTD|INFO|ENCODEURL|IMPORTXML|IMPORTDATA|IMPORTRANGE)\s*\(|\[|\]|:\/\/|\\\\/i;
const STATUS_WARNA = [
  [/terlambat|bahaya|gagal|blokir|macet|ditolak/i, 'FFFBEDEE', 'FF8C2F39'], [/waspada|perhatian|review|menunggu|draf|draft|belum/i, 'FFFBF3E2', 'FF7A5200'],
  [/lunas|aman|selesai|ok|sehat|terverifikasi|setuju/i, 'FFE8F2EA', 'FF2F6B3A'],
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const serial = (d) => (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000;
const tanggalIso = (s) => { const [y, m, d] = s.split('-').map(Number), x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCMonth() === m - 1 ? x : null; };
const bersih = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const namaLembar = (s, i) => bersih(s, 60).replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Lembar ' + (i + 1);
const colName = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** "Rp 1.500.000" / "15%" / "1.234,5" -> angka (untuk kolom angka); selain itu dikembalikan apa adanya. */
function keAngka(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!/^-?\s*(Rp\.?\s*)?-?[\d.,]+\s*%?$/i.test(t) || !/\d/.test(t)) return v;
  const pct = t.endsWith('%'), neg = /^-|-\s*\d/.test(t.replace(/Rp\.?\s*/i, ''));
  let n = t.replace(/Rp\.?/i, '').replace(/[%\s-]/g, '');
  n = /,\d{1,2}$/.test(n) ? n.replace(/\./g, '').replace(',', '.') : n.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const x = Number(n); if (!Number.isFinite(x)) return v;
  const h = neg ? -x : x;
  return pct ? h / 100 : h;
}

/** Lembar mentah dari agen -> lembar ternormalisasi (kolom bertipe, baris sel). Melempar Error berisi pesan yang bisa diperbaiki agen. */
function normalisasi(spec) {
  let daftar = Array.isArray(spec.lembar) && spec.lembar.length ? spec.lembar : null;
  if (!daftar && Array.isArray(spec.baris) && spec.baris.length) {
    const [kepala, ...isi] = spec.baris.map((r) => (Array.isArray(r) ? r : [r]));
    const kolom = kepala.map((j, c) => {
      const nilai = isi.map((r) => r[c]).filter((v) => v !== '' && v != null && !(typeof v === 'string' && v.startsWith('=')));
      const j2 = bersih(j, 60) || 'Kolom ' + (c + 1);
      if (nilai.length && nilai.every((v) => typeof v === 'string' && ISO.test(v))) return { judul: j2, tipe: 'tanggal' };
      if (nilai.length && nilai.every((v) => typeof v === 'number')) return { judul: j2, tipe: /\b(rp|rupiah)\b/i.test(j2) ? 'rupiah' : 'angka' };
      return { judul: j2, tipe: 'teks' };
    });
    daftar = [{ nama: 'Data', judul: spec.judul, kolom, baris: isi }];
  }
  if (!daftar) throw new Error('xlsx butuh "lembar" (disarankan) atau "baris" (baris pertama = judul kolom).');
  if (daftar.length > MAX_LEMBAR) throw new Error(`Maksimal ${MAX_LEMBAR} lembar.`);
  const dipakai = new Set();
  return daftar.map((l, i) => {
    let nama = namaLembar(l && l.nama, i), n = 2;
    while (dipakai.has(nama.toLowerCase())) nama = nama.slice(0, 28) + ' ' + n++;
    dipakai.add(nama.toLowerCase());
    const kolom = (Array.isArray(l.kolom) ? l.kolom : []).slice(0, MAX_KOLOM).map((k, c) => ({
      judul: bersih(k && k.judul, 60) || 'Kolom ' + (c + 1), tipe: TIPE.includes(k && k.tipe) ? k.tipe : 'teks', lebar: Number(k && k.lebar) || 0,
      input: Boolean(k && k.input), pilihan: Array.isArray(k && k.pilihan) ? k.pilihan.map((p) => bersih(p, 40)).filter(Boolean).slice(0, 25) : null,
      total: TOTAL_FN[k && k.total] ? k.total : null,
    }));
    const item = (Array.isArray(l.baris) ? l.baris : []).slice(0, MAX_BARIS).map((r) => (r && !Array.isArray(r) && Array.isArray(r.sel) ? { sel: r.sel, gaya: GAYA_BARIS.includes(r.gaya) ? r.gaya : null } : { sel: Array.isArray(r) ? r : [r], gaya: null }));
    const baris = item.map((x) => x.sel.slice(0, kolom.length || MAX_KOLOM)), gaya = item.map((x) => x.gaya);
    if (baris.length && !kolom.length) throw new Error(`Lembar "${nama}": "baris" butuh "kolom" (judul dan tipe tiap kolom).`);
    const ringkasan = (Array.isArray(l.ringkasan) ? l.ringkasan : []).slice(0, 40).map((x) => ({ label: bersih(x && x.label, 80), nilai: x && x.nilai, tipe: TIPE.includes(x && x.tipe) ? x.tipe : 'angka' })).filter((x) => x.label);
    if (!baris.length && !ringkasan.length) throw new Error(`Lembar "${nama}" kosong: isi "baris" (dengan "kolom") atau "ringkasan".`);
    return { nama, judul: bersih(l.judul, 120) || nama, subjudul: bersih(l.subjudul, 160), kolom, baris, gaya, ringkasan, total: Boolean(l.total), catatan: (Array.isArray(l.catatan) ? l.catatan : []).map((c) => bersih(c, 300)).filter(Boolean).slice(0, 15) };
  });
}

/** Tata letak: baris kepala/awal/akhir/total tiap lembar (dipakai penanda {awal} {akhir} {total} {r} {Lembar:total}). */
function tataLetak(lembar) {
  for (const l of lembar) {
    l.barisKpi = l.ringkasan.length ? 4 : 0;
    l.kepala = l.baris.length ? (l.ringkasan.length ? 4 + l.ringkasan.length + 1 : 4) : 0;
    l.awal = l.kepala + 1; l.akhir = l.kepala + l.baris.length; l.barisTotal = l.total && l.baris.length ? l.akhir + 1 : 0;
    l.labelBaris = new Map(); // judul baris (sel pertama) -> nomor baris, untuk acuan {@Judul} dan {Lembar:@Judul}
    const catatLabel = (teks, r) => { const k = String(teks == null ? '' : teks).trim().toLowerCase(); if (k && !k.startsWith('=') && !l.labelBaris.has(k)) l.labelBaris.set(k, r); };
    l.ringkasan.forEach((x, i) => catatLabel(x.label, l.barisKpi + i));
    l.baris.forEach((b, i) => catatLabel(b[0], l.awal + i));
  }
}
function isiPenanda(f, l, r, semua) {
  return f.replace(/\{r([+-]\d+)?\}/g, (_, d) => r + (d ? Number(d) : 0)).replace(/\{awal\}/g, l.awal).replace(/\{akhir\}/g, l.akhir).replace(/\{total\}/g, l.barisTotal || l.akhir + 1)
    .replace(/\{@([^{}]+)\}/g, (m, nama) => { const r2 = l.labelBaris.get(nama.trim().toLowerCase()); if (!r2) throw new Error(`Penanda ${m}: tidak ada baris berjudul "${nama.trim()}" di lembar "${l.nama}".`); return r2; })
    .replace(/\{([^{}:]+):@([^{}]+)\}/g, (m, n, nama) => { const t = semua.find((x) => x.nama.toLowerCase() === n.trim().toLowerCase()); if (!t) throw new Error(`Penanda ${m}: lembar "${n}" tidak ada.`); const r2 = t.labelBaris.get(nama.trim().toLowerCase()); if (!r2) throw new Error(`Penanda ${m}: tidak ada baris berjudul "${nama.trim()}" di lembar "${t.nama}".`); return r2; })
    .replace(/\{([^{}:]+):(awal|akhir|total)\}/g, (m, n, k) => { const t = semua.find((x) => x.nama.toLowerCase() === n.trim().toLowerCase()); if (!t) throw new Error(`Penanda ${m}: lembar "${n}" tidak ada.`); return k === 'total' ? (t.barisTotal || t.akhir + 1) : t[k]; });
}

/** Bangun peta sel { lembar: Map("r,c" -> {v, f, kunci}) } dari lembar ternormalisasi. */
function bangunSel(lembar) {
  const peta = new Map(), galat = [];
  for (const l of lembar) {
    const sel = new Map(); peta.set(l.nama, sel);
    const taruh = (r, c, v, tipe) => {
      if (v === '' || v == null) return;
      if (typeof v === 'string' && v.startsWith('=')) {
        const f = isiPenanda(v, l, r, lembar).slice(1).trim();
        if (f.length > MAX_RUMUS || DILARANG.test(f)) { galat.push(`${l.nama}!${colName(c)}${r}: rumus tidak diizinkan atau terlalu panjang`); return; }
        if (/SUMPRODUCT\s*\([^)]*([*<>=]|--)/i.test(f)) { galat.push(`${l.nama}!${colName(c)}${r}: SUMPRODUCT berkondisi tidak didukung, pakai SUMIFS/COUNTIFS`); return; }
        sel.set(r + ',' + c, { f }); return;
      }
      if (typeof v === 'string' && tipe === 'tanggal' && ISO.test(v.trim())) { const d = tanggalIso(v.trim()); if (d) { sel.set(r + ',' + c, { v: serial(d), tanggal: true }); return; } }
      if (['rupiah', 'angka', 'persen'].includes(tipe)) {
        v = keAngka(v);
        if (typeof v !== 'number' || !Number.isFinite(v)) { galat.push(`${l.nama}!${colName(c)}${r}: kolom ${tipe} harus berisi angka, bukan "${bersih(v, 30)}"`); return; }
        if (tipe === 'persen' && Math.abs(v) > 10) { galat.push(`${l.nama}!${colName(c)}${r}: persen harus pecahan (0,15 = 15%), bukan ${v}`); return; }
      }
      sel.set(r + ',' + c, { v: typeof v === 'number' || typeof v === 'boolean' ? v : bersih(v, 2000) });
    };
    l.ringkasan.forEach((x, i) => { taruh(l.barisKpi + i, 2, x.nilai, x.tipe); x.input = typeof x.nilai !== 'string' || !String(x.nilai).startsWith('='); });
    l.baris.forEach((row, i) => l.kolom.forEach((k, c) => taruh(l.awal + i, c + 1, row[c], k.tipe)));
    if (l.barisTotal) l.kolom.forEach((k, c) => {
      const fn = k.total ? TOTAL_FN[k.total] : ['rupiah', 'angka'].includes(k.tipe) ? 'SUM' : null;
      if (fn) sel.set(l.barisTotal + ',' + (c + 1), { f: `${fn}(${colName(c)}${l.awal}:${colName(c)}${l.akhir})` });
    });
  }
  return { peta, galat };
}

/* ---------- SUMIFS & kawan-kawan (belum ada di fast-formula-parser) ---------- */
const regexWildcard = (s) => new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
/** Kriteria gaya Excel: angka, ">5", "<>x", "=teks", "a*" (wildcard), tanpa beda huruf besar/kecil. */
function cocok(nilai, kriteria) {
  if (typeof kriteria === 'number') return typeof nilai === 'number' && nilai === kriteria;
  if (typeof kriteria === 'boolean') return nilai === kriteria;
  const k = String(kriteria == null ? '' : kriteria), m = /^(<>|>=|<=|>|<|=)([\s\S]*)$/.exec(k), op = m ? m[1] : '=', rhs = m ? m[2] : k;
  const n = rhs.trim() !== '' && Number.isFinite(Number(rhs)) ? Number(rhs) : null;
  if (n !== null) {
    if (typeof nilai !== 'number') return op === '<>';
    return { '=': nilai === n, '<>': nilai !== n, '>': nilai > n, '<': nilai < n, '>=': nilai >= n, '<=': nilai <= n }[op];
  }
  const kosong = nilai === undefined || nilai === null || nilai === '';
  if (rhs === '') return op === '<>' ? !kosong : op === '=' ? kosong : false;
  if (typeof nilai !== 'string') return op === '<>';
  const sama = /[*?]/.test(rhs) ? regexWildcard(rhs).test(nilai) : nilai.toLowerCase() === rhs.toLowerCase();
  return op === '<>' ? !sama : op === '=' ? sama : false;
}
const gepeng = (r) => (Array.isArray(r) ? r.flat() : [r]);
/** Argumen fungsi tambahan datang bersarang ({value:{value:[[...]]}}): buka sampai nilai (skalar atau larik 2D). */
const buka = (a) => { let v = a; while (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) v = v.value; return v; };
function ifs(jenis) {
  return (context, ...args) => {
    const adaTarget = jenis !== 'COUNTIFS', mulai = adaTarget ? 1 : 0;
    if (args.length < mulai + 2 || (args.length - mulai) % 2) throw FormulaParser.FormulaError.VALUE;
    const rentang = args.filter((_, i) => i < mulai || (i - mulai) % 2 === 0).map((a) => gepeng(buka(a)));
    const kriteria = args.filter((_, i) => i >= mulai && (i - mulai) % 2 === 1).map((a) => gepeng(buka(a))[0]);
    const target = rentang[0], syarat = adaTarget ? rentang.slice(1) : rentang;
    if (syarat.some((r) => r.length !== target.length)) throw FormulaParser.FormulaError.VALUE;
    const kena = target.filter((_, i) => syarat.every((r, j) => cocok(r[i], kriteria[j])));
    if (jenis === 'COUNTIFS') return kena.length;
    const angka = kena.filter((v) => typeof v === 'number');
    if (jenis === 'SUMIFS') return angka.reduce((a, b) => a + b, 0);
    if (jenis === 'AVERAGEIFS') { if (!angka.length) throw FormulaParser.FormulaError.DIV0; return angka.reduce((a, b) => a + b, 0) / angka.length; }
    if (jenis === 'MAXIFS') return angka.length ? Math.max(...angka) : 0;
    return angka.length ? Math.min(...angka) : 0;
  };
}
const FUNGSI_IFS = Object.fromEntries(['SUMIFS', 'COUNTIFS', 'AVERAGEIFS', 'MAXIFS', 'MINIFS'].map((n) => [n, ifs(n)]));

/* Fungsi harian kantor yang belum ada di fast-formula-parser (MIN/MAX pun belum ada). Perilaku mengikuti Excel. */
const { FormulaError: GALAT } = FormulaParser;
const angkaSaja = (args) => args.flatMap((a) => { const v = buka(a); return Array.isArray(v) ? v.flat().filter((x) => typeof x === 'number') : typeof v === 'number' ? [v] : typeof v === 'boolean' ? [Number(v)] : []; });
const semuaNilai = (args) => args.flatMap((a) => gepeng(buka(a)));
const kosong = (v) => v === undefined || v === null || v === '';
const skalar = (a) => gepeng(buka(a))[0];
const urut = (xs) => [...xs].sort((a, b) => a - b);
const PMT = (r, n, pv, fv = 0, t = 0) => (r === 0 ? -(pv + fv) / n : -(r * (fv + pv * (1 + r) ** n)) / ((1 + r * t) * ((1 + r) ** n - 1)));
const FV = (r, n, pmt, pv = 0, t = 0) => (r === 0 ? -(pv + pmt * n) : -(pv * (1 + r) ** n + pmt * (1 + r * t) * (((1 + r) ** n - 1) / r)));
const jumlah = (xs) => xs.reduce((a, b) => a + b, 0);
const SUBTOTAL = { 1: (v, x) => (x.length ? jumlah(x) / x.length : (() => { throw GALAT.DIV0; })()), 2: (v, x) => x.length, 3: (v) => v.filter((y) => !kosong(y)).length, 4: (v, x) => (x.length ? Math.max(...x) : 0), 5: (v, x) => (x.length ? Math.min(...x) : 0), 9: (v, x) => jumlah(x) };
const FUNGSI_TAMBAHAN = {
  MAX: (c, ...a) => { const x = angkaSaja(a); return x.length ? Math.max(...x) : 0; },
  MIN: (c, ...a) => { const x = angkaSaja(a); return x.length ? Math.min(...x) : 0; },
  COUNTA: (c, ...a) => semuaNilai(a).filter((v) => !kosong(v)).length,
  COUNTBLANK: (c, ...a) => semuaNilai(a).filter(kosong).length,
  MEDIAN: (c, ...a) => { const x = urut(angkaSaja(a)); if (!x.length) throw GALAT.NUM; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; },
  LARGE: (c, rentang, k) => { const x = urut(angkaSaja([rentang])), n = Number(skalar(k)); if (!Number.isInteger(n) || n < 1 || n > x.length) throw GALAT.NUM; return x[x.length - n]; },
  SMALL: (c, rentang, k) => { const x = urut(angkaSaja([rentang])), n = Number(skalar(k)); if (!Number.isInteger(n) || n < 1 || n > x.length) throw GALAT.NUM; return x[n - 1]; },
  UPPER: (c, t) => String(skalar(t) == null ? '' : skalar(t)).toUpperCase(),
  MATCH: (c, cari, rentang, tipe) => {
    const kunci = skalar(cari), daftar = gepeng(buka(rentang)), jenis = tipe === undefined ? 1 : Number(skalar(tipe));
    const sama = (v) => (typeof kunci === 'string' && typeof v === 'string' ? (/[*?]/.test(kunci) ? regexWildcard(kunci).test(v) : v.toLowerCase() === kunci.toLowerCase()) : v === kunci);
    if (jenis === 0) { const i = daftar.findIndex(sama); if (i < 0) throw GALAT.NA; return i + 1; }
    let hasil = -1;
    daftar.forEach((v, i) => { if (typeof v === typeof kunci && (jenis > 0 ? v <= kunci : v >= kunci) && (hasil < 0 || (jenis > 0 ? v >= daftar[hasil] : v <= daftar[hasil]))) hasil = i; });
    if (hasil < 0) throw GALAT.NA; return hasil + 1;
  },
  SUBTOTAL: (c, kode, ...a) => { const f = SUBTOTAL[Number(skalar(kode)) % 100]; if (!f) throw GALAT.VALUE; return f(semuaNilai(a), angkaSaja(a)); },
  PMT: (c, r, n, pv, fv, t) => PMT(Number(skalar(r)), Number(skalar(n)), Number(skalar(pv)), fv === undefined ? 0 : Number(skalar(fv)), t === undefined ? 0 : Number(skalar(t))),
  FV: (c, r, n, p, pv, t) => FV(Number(skalar(r)), Number(skalar(n)), Number(skalar(p)), pv === undefined ? 0 : Number(skalar(pv)), t === undefined ? 0 : Number(skalar(t))),
};
const FUNGSI = { ...FUNGSI_IFS, ...FUNGSI_TAMBAHAN };
const FUNGSI_AMAN = 'SUM, SUMIF(S), COUNT, COUNTA, COUNTIF(S), COUNTBLANK, AVERAGE, AVERAGEIF(S), MIN, MAX, MINIFS, MAXIFS, MEDIAN, LARGE, SMALL, SUBTOTAL, IF, IFS, IFERROR, AND, OR, NOT, ROUND(UP/DOWN), ABS, INT, MOD, POWER, SQRT, INDEX, MATCH, VLOOKUP, TODAY, DATE, YEAR, MONTH, DAY, EOMONTH, EDATE, DATEDIF, NETWORKDAYS, TEXT, CONCATENATE, LEFT, RIGHT, LEN, UPPER, PMT, FV';

/** Hitung semua rumus. Mengembalikan { hasil: Map(lembar -> Map(kunci -> nilai)), galat: [pesan] }. */
function hitungRumus(lembar, peta) {
  const hasil = new Map(), sedang = new Set(), siklus = new Set(), galat = [];
  for (const l of lembar) hasil.set(l.nama, new Map());
  const cari = (nama) => lembar.find((x) => x.nama.toLowerCase() === String(nama).toLowerCase());
  const nilaiSel = (nama, r, c) => {
    const l = cari(nama); if (!l) return new FormulaParser.FormulaError('#REF!');
    const s = peta.get(l.nama).get(r + ',' + c); if (!s) return undefined;
    if (s.f === undefined) return s.v;
    const h = hasil.get(l.nama), k = r + ',' + c;
    if (h.has(k)) return h.get(k);
    const id = l.nama + '!' + k;
    if (sedang.has(id)) { siklus.add(id); return new FormulaParser.FormulaError('#REF!', 'Rumus berputar (sirkular)'); }
    sedang.add(id);
    let v; try { v = buatParser().parse(s.f, { sheet: l.nama, row: r, col: c }); } catch (e) { v = e instanceof FormulaParser.FormulaError ? e : new FormulaParser.FormulaError('#NAME?'); }
    sedang.delete(id); h.set(k, v); return v;
  };
  // Satu parser per rumus: parser tidak aman dipakai bersarang (rentang berisi rumus lain merusak statusnya).
  const buatParser = () => new FormulaParser({
    functionsNeedContext: FUNGSI,
    onCell: ({ sheet, row, col }) => nilaiSel(sheet, row, col),
    onRange: ({ sheet, from, to }) => { const o = []; for (let r = from.row; r <= to.row; r++) { const x = []; for (let c = from.col; c <= to.col; c++) x.push(nilaiSel(sheet, r, c)); o.push(x); } return o; },
  });
  for (const l of lembar) for (const [k, s] of peta.get(l.nama)) {
    if (s.f === undefined) continue;
    const [r, c] = k.split(',').map(Number), v = nilaiSel(l.nama, r, c);
    if (v instanceof FormulaParser.FormulaError || (typeof v === 'number' && !Number.isFinite(v))) galat.push(`${l.nama}!${colName(c - 1)}${r}  =${s.f}  → ${v && v.error ? v.error : '#NUM!'}`);
  }
  // SUM dan kawan-kawan melewati sel galat di dalam rentang, jadi rujukan ke diri sendiri tidak muncul sebagai galat biasa: catat terpisah.
  for (const id of siklus) {
    const [nama, kunci] = id.split('!'), [r, c] = kunci.split(',').map(Number);
    galat.push(`${nama}!${colName(c - 1)}${r}  → rumus merujuk dirinya sendiri (melingkar); Excel akan memberi peringatan. Rentang jumlah tidak boleh memuat sel totalnya: pakai baris data saja, atau minta total otomatis dengan "total": true pada lembar`);
  }
  return { hasil, galat };
}

function lebarOtomatis(l, c, k) {
  if (k.lebar) return Math.min(70, Math.max(6, k.lebar));
  const panjang = [k.judul.length, ...l.baris.slice(0, 200).map((r) => String(r[c] == null ? '' : r[c]).length)];
  const dasar = { rupiah: 18, angka: 14, persen: 10, tanggal: 14, catatan: 9 }[k.tipe];
  return dasar || Math.min(48, Math.max(10, Math.max(...panjang) + 2));
}

/** Spec { lembar | baris, judul, kantor, oleh, tanggal } -> Buffer xlsx. Melempar Error bila ada rumus/angka bermasalah. */
async function buatXlsx(spec) {
  const lembar = normalisasi(spec);
  tataLetak(lembar);
  const { peta, galat: g1 } = bangunSel(lembar);
  if (g1.length) throw new Error('Perbaiki dulu:\n' + g1.slice(0, 12).join('\n'));
  const { hasil, galat: g2 } = hitungRumus(lembar, peta);
  if (g2.length) throw new Error('Rumus bermasalah (perbaiki lalu buat ulang). Fungsi yang didukung: ' + FUNGSI_AMAN + '.\n' + g2.slice(0, 12).join('\n'));

  const wb = new ExcelJS.Workbook(), kantor = bersih(spec.kantor, 80), tgl = spec.tanggal || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  wb.creator = bersih(spec.oleh, 60) || 'Kantor AI'; wb.created = new Date(); wb.title = bersih(spec.judul, 120) || lembar[0].judul;
  wb.calcProperties = { fullCalcOnLoad: true };
  const tipis = { style: 'thin', color: { argb: WARNA.garis } };
  const kotak = { bottom: tipis }; // hanya garis tipis di bawah tiap baris
  const tinta = (style) => ({ style, color: { argb: WARNA.tinta } });

  for (const l of lembar) {
    const ws = wb.addWorksheet(l.nama, { views: [{ showGridLines: false, ...(l.kepala ? { state: 'frozen', ySplit: l.kepala } : {}) }] });
    const nKol = Math.max(l.kolom.length, l.ringkasan.length ? 2 : 0, 1), sel = peta.get(l.nama), hs = hasil.get(l.nama);
    ws.properties.defaultRowHeight = 18;
    ws.getRow(1).height = 26; ws.getRow(2).height = 16;
    ws.getCell('A1').value = l.judul; ws.getCell('A1').font = { name: 'Georgia', size: 16, color: { argb: WARNA.tinta } };
    ws.getCell('A2').value = [l.subjudul, l.kolom.some((k) => k.tipe === 'rupiah') || l.ringkasan.some((x) => x.tipe === 'rupiah') ? '(dalam Rupiah)' : '', kantor, tgl].filter(Boolean).join('  ·  '); ws.getCell('A2').font = { name: FONT, size: 9, color: { argb: WARNA.redup } };
    for (let c = 1; c <= nKol; c++) ws.getCell(3, c).border = { top: tinta('thin') };
    ws.getRow(3).height = 6;

    const tulis = (cell, s, tipe, gaya = {}) => {
      if (s.f !== undefined) { const v = hs.get(cell.row + ',' + cell.col); cell.value = { formula: s.f, result: v instanceof FormulaParser.FormulaError ? undefined : v }; } else cell.value = s.tanggal ? new Date(Date.UTC(1899, 11, 30) + s.v * 86400000) : s.v;
      const fmt = (gaya.kpi && FORMAT_KPI[tipe]) || FORMAT[tipe]; if (fmt) cell.numFmt = fmt;
      cell.font = { name: FONT, size: tipe === 'catatan' ? 8 : 10, ...(tipe === 'catatan' ? { color: { argb: WARNA.redup } } : {}), ...gaya.font }; cell.alignment = { vertical: 'middle', horizontal: ['rupiah', 'angka', 'persen'].includes(tipe) ? 'right' : tipe === 'tanggal' || tipe === 'catatan' ? 'center' : 'left', wrapText: tipe === 'teks', ...gaya.alignment };
      cell.border = kotak; if (gaya.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gaya.fill } };
    };
    let adaIsian = false;
    const terapkanGaya = (cell, g, c) => {
      if (!g) return;
      const dasar = { name: FONT, size: 10, ...(cell.font || {}) };
      if (g === 'indent' || g === 'indent2') { if (c === 0) cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', indent: g === 'indent' ? 1 : 2 }; return; }
      cell.font = { ...dasar, bold: true, color: { argb: WARNA.tinta } };
      if (g === 'subtotal') cell.border = { top: tinta('thin'), bottom: tipis };
      if (g === 'total') cell.border = { top: tinta('thin'), bottom: tinta('double') };
    };

    l.ringkasan.forEach((x, i) => {
      const r = l.barisKpi + i, a = ws.getCell(r, 1), b = ws.getCell(r, 2), s = sel.get(r + ',2');
      a.value = x.label; a.font = { name: FONT, size: 10, color: { argb: WARNA.abu } }; a.border = kotak; a.alignment = { vertical: 'middle' };
      if (s) { const isian = x.input; adaIsian = adaIsian || isian; tulis(b, s, x.tipe, { kpi: true, font: { bold: !isian, ...(isian ? { color: { argb: WARNA.isian } } : {}) }, ...(isian ? { fill: WARNA.isianLatar } : {}) }); }
      ws.getRow(r).height = 20;
    });

    if (l.kepala) {
      l.kolom.forEach((k, c) => { const h = ws.getCell(l.kepala, c + 1); h.value = k.judul.toUpperCase(); h.font = { name: FONT, size: 8, bold: true, color: { argb: WARNA.abu } }; h.alignment = { vertical: 'middle', horizontal: ['rupiah', 'angka', 'persen'].includes(k.tipe) ? 'right' : ['tanggal', 'catatan'].includes(k.tipe) ? 'center' : 'left', wrapText: true }; h.border = { top: tinta('medium'), bottom: tinta('thin') }; ws.getColumn(c + 1).width = lebarOtomatis(l, c, k); });
      ws.getRow(l.kepala).height = 24;
      l.baris.forEach((row, i) => {
        const r = l.awal + i; ws.getRow(r).height = 18;
        l.kolom.forEach((k, c) => {
          const s = sel.get(r + ',' + (c + 1)), cell = ws.getCell(r, c + 1), g = l.gaya[i];
          if (!s) { cell.border = kotak; terapkanGaya(cell, g, c); return; }
          const isian = k.input && s.f === undefined; adaIsian = adaIsian || isian;
          tulis(cell, s, k.tipe, { fill: isian ? WARNA.isianLatar : undefined, font: isian ? { color: { argb: WARNA.isian } } : {} }); terapkanGaya(cell, g, c);
        });
      });
      l.kolom.forEach((k, c) => {
        const col = colName(c), rentang = `${col}${l.awal}:${col}${l.akhir}`;
        if (k.pilihan && k.pilihan.length) for (let r = l.awal; r <= l.akhir; r++) ws.getCell(r, c + 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + k.pilihan.join(',').replace(/"/g, '') + '"'] };
        if (k.tipe === 'status') ws.addConditionalFormatting({ ref: rentang, rules: statusAturan(col, l.awal) });
      });
      if (l.barisTotal) l.kolom.forEach((k, c) => {
        const cell = ws.getCell(l.barisTotal, c + 1), s = sel.get(l.barisTotal + ',' + (c + 1));
        if (c === 0 && !s) cell.value = 'Total'; if (s) tulis(cell, s, k.tipe);
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: WARNA.tinta } };
        cell.border = { top: tinta('thin'), bottom: tinta('double') };
      });
      ws.autoFilter = { from: { row: l.kepala, column: 1 }, to: { row: l.kepala, column: l.kolom.length } };
    } else { ws.getColumn(1).width = 42; ws.getColumn(2).width = 22; }

    let r = (l.barisTotal || l.akhir || l.barisKpi + l.ringkasan.length - 1) + 2;
    const catat = (teks, gaya) => { const c = ws.getCell(r++, 1); c.value = teks; c.font = { name: FONT, size: 9, color: { argb: WARNA.redup }, ...gaya }; };
    if (l.catatan.length) { catat('Catatan & asumsi', { bold: true, color: { argb: WARNA.tinta } }); l.catatan.forEach((t) => catat('• ' + t)); }
    if (adaIsian) catat('Sel biru berlatar kuning = angka isian (boleh diubah); sel hitam = rumus, hasilnya ikut berubah.', { italic: true });
    catat('Disusun otomatis oleh agen AI. Periksa angka sebelum dipakai.', { italic: true });

    ws.pageSetup = { paperSize: 9, orientation: nKol > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 }, ...(l.kepala ? { printTitlesRow: `${l.kepala}:${l.kepala}` } : {}) };
    ws.headerFooter = { oddFooter: `&L&8${(kantor ? kantor + ' · ' : '').replace(/&/g, '&&')}${l.judul.replace(/&/g, '&&')}&R&8Halaman &P dari &N` };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Aturan warna status (Terlambat merah, Perhatian kuning, Lunas hijau) untuk kolom 'col' mulai baris awal. */
function statusAturan(col, awal) {
  const ref = `${col}${awal}`;
  return STATUS_WARNA.map(([re, bg, fg], i) => {
    const kata = re.source.split('|').map((k) => `ISNUMBER(SEARCH("${k.replace(/[^a-z]/gi, '')}",${ref}))`).join(',');
    return { type: 'expression', priority: i + 1, formulae: [`OR(${kata})`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } }, font: { color: { argb: fg }, bold: true } } };
  });
}

module.exports = { buatXlsx, normalisasi, keAngka, FORMAT, FUNGSI_AMAN };
