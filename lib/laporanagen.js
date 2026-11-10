'use strict';
/** Isi laporan rutin tiap agen (teks untuk Telegram), disusun dari data nyata tanpa AI dan tanpa token. */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MAX_BARIS = 15, MAX_PANJANG = 3800;
const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + Math.abs(Number(n) || 0).toLocaleString('id-ID');
const tgl = (iso) => { const [, m, d] = iso.split('-'); return `${+d} ${BULAN[m - 1]}`; };
const kapan = (n) => (n < 0 ? `lewat ${-n} hari` : n === 0 ? 'hari ini' : `${n} hari lagi`);

function baris(r) {
  const apa = r.kind === 'tugas' ? `${r.label}${r.judul ? ' (' + r.judul + ')' : ''}` : `${r.label}${r.pihak ? ' — ' + r.pihak : ''}`;
  return `• ${tgl(r.tanggal)} (${kapan(r.sisa_hari)}) ${apa}${r.jumlah ? ' ' + rp(r.jumlah) : ''}`;
}
/** Daftar baris dipotong MAX_BARIS; sisanya diringkas "dan N lainnya". */
function daftarBaris(rs) { const out = rs.slice(0, MAX_BARIS).map(baris); if (rs.length > MAX_BARIS) out.push(`…dan ${rs.length - MAX_BARIS} lainnya`); return out; }
const batas = (t) => (t.length > MAX_PANJANG ? t.slice(0, MAX_PANJANG - 1) + '…' : t);

const PENYUSUN = {
  'pengingat-harian'({ kantor, tanggalTeks, reminders = [] }) {
    const telat = reminders.filter((r) => r.sisa_hari < 0), dekat = reminders.filter((r) => r.sisa_hari >= 0 && r.sisa_hari <= 7);
    const out = [`${kantor} — Pengingat Jadwal, ${tanggalTeks}`, ''];
    if (!telat.length && !dekat.length) out.push('Tidak ada yang jatuh tempo dalam 7 hari ke depan.');
    if (telat.length) out.push(`Terlambat (${telat.length}):`, ...daftarBaris(telat), '');
    if (dekat.length) out.push(`Jatuh tempo ≤ 7 hari (${dekat.length}):`, ...daftarBaris(dekat));
    return out.join('\n').trim();
  },
  'keuangan-mingguan'({ kantor, tanggalTeks, reminders = [], kas7 = { masuk: 0, keluar: 0 }, draf = 0, tagihanTerbuka = { jumlah: 0, bayar: 0, tagih: 0 } }) {
    const tg = reminders.filter((r) => r.kind === 'tagihan' && r.sisa_hari <= 14);
    const out = [`${kantor} — Laporan Bendahara, minggu s.d. ${tanggalTeks}`, '',
      `Kas 7 hari terakhir (terverifikasi): masuk ${rp(kas7.masuk)}, keluar ${rp(kas7.keluar)}, selisih ${rp(kas7.masuk - kas7.keluar)}.`,
      draf ? `${draf} transaksi draf menunggu verifikasi (belum dihitung di atas).` : 'Tidak ada transaksi draf yang menunggu.',
      tagihanTerbuka.jumlah ? `Tagihan terbuka ${tagihanTerbuka.jumlah}: harus dibayar ${rp(tagihanTerbuka.bayar)}, akan diterima ${rp(tagihanTerbuka.tagih)}.` : 'Tidak ada tagihan terbuka.'];
    if (tg.length) out.push('', 'Tagihan jatuh tempo ≤ 14 hari atau terlambat:', ...daftarBaris(tg));
    return out.join('\n');
  },
  'agen-ringkas'({ kantor, tanggalTeks, namaAgen = 'Agen', teksAgen = '', tindak = [] }) {
    const out = [`${kantor} — Laporan ${namaAgen}, ${tanggalTeks}`, '', teksAgen];
    if (tindak.length) out.push('', 'Perlu tindak lanjut:', ...tindak.slice(0, 6).map((t) => '• ' + t.judul));
    return out.join('\n');
  },
};
/** jenis: 'pengingat-harian' | 'keuangan-mingguan' | lainnya = laporan agen umum. */
const susun = (jenis, data) => batas((PENYUSUN[jenis] || PENYUSUN['agen-ringkas'])(data));

module.exports = { susun, JENIS: Object.keys(PENYUSUN) };
