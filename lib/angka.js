'use strict';
/**
 * Pagar akurasi: memeriksa angka penting (uang, jumlah besar, persen) yang ditulis agen terhadap sumber yang benar-benar
 * mereka terima (data bidang, hasil alat, isi perintah). Angka yang tidak ditemukan ditandai agar manusia memeriksanya;
 * tidak ada angka karangan yang lolos tanpa tanda. Angka kecil (nomor urut, tanggal, "3 dokumen") tidak diperiksa karena terlalu banyak salah tandai.
 */
const SKALA = { juta: 1e6, jt: 1e6, miliar: 1e9, milyar: 1e9, triliun: 1e12, ribu: 1e3, rb: 1e3 };
const TOLERANSI = 0.06; // angka dibulatkan ("Rp 1,3 miliar") boleh menyimpang sampai 6% dari angka asli

/** "1.276.500.000" -> 1276500000; "1,5" -> 1.5; "1,200" -> 1200 (ribuan gaya Inggris). */
function ke_angka(tok) {
  let t = tok;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Semua angka dalam teks beserta skala yang menempel (juta, miliar, %, dst). [{ nilai, skala, persen, teks }] */
function angkaDalam(teks) {
  const out = [], re = /(\d+(?:[.,]\d+)*)(\s?(?:%|‰|juta|jt|miliar|milyar|triliun|ribu|rb)\b|\s?%)?/gi;
  let m;
  while ((m = re.exec(String(teks || '')))) {
    const n = ke_angka(m[1]); if (n == null) continue;
    const s = (m[2] || '').trim().toLowerCase();
    out.push({ teks: m[0].trim(), nilai: n * (SKALA[s] || 1), dibulatkan: Boolean(SKALA[s]), persen: s === '%' || s === '‰' });
  }
  return out;
}
const tahun = (n) => Number.isInteger(n) && n >= 1900 && n <= 2100;
/** Angka yang layak diperiksa: uang/jumlah >= 1000 (bukan tahun) dan persen. */
const penting = (a) => (a.persen && a.nilai > 0) || (a.nilai >= 1000 && !tahun(a.nilai));

/** Himpunan angka dari sumber (teks apa pun, termasuk JSON). */
function himpunan(sumber) {
  const nilai = new Set(), daftar = [];
  for (const a of angkaDalam(Array.isArray(sumber) ? sumber.join('\n') : sumber)) { nilai.add(a.nilai); daftar.push(a.nilai); }
  return { nilai, daftar };
}

/** Angka penting di jawaban yang TIDAK ada di sumber. Mengembalikan daftar teks angka (unik, maks 8). */
function tidakDidukung(jawaban, sumber) {
  const { nilai, daftar } = himpunan(sumber), ada = (a) => nilai.has(a.nilai) || (a.dibulatkan && daftar.some((s) => s > 0 && Math.abs(s - a.nilai) / a.nilai <= TOLERANSI))
    || (a.persen && daftar.some((s) => Math.abs(s - a.nilai) < 0.05));
  const salah = [];
  for (const a of angkaDalam(jawaban)) if (penting(a) && !ada(a) && !salah.includes(a.teks)) salah.push(a.teks);
  return salah.slice(0, 8);
}

/** Catatan peringatan untuk ditempel di akhir jawaban; '' bila semua angka terdukung. */
function peringatan(jawaban, sumber) {
  const x = tidakDidukung(jawaban, sumber);
  return x.length ? `⚠ Periksa sendiri: angka ${x.join(', ')} tidak ditemukan di data atau hasil alat yang dibaca agen. Jangan dipakai sebelum dicek.` : '';
}

module.exports = { angkaDalam, tidakDidukung, peringatan, himpunan };
