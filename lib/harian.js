'use strict';
/**
 * Asisten Harian: sapaan dan standup dari data nyata (tugas, tenggat, persetujuan, proyek). Tanpa token.
 * Netral bidang: isinya mengikuti apa yang ada di Papan Tugas dan data kantor, apa pun jenis pekerjaannya.
 */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MAX_ITEM = 6, MAX_BEBAN = 6;
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const clip = (s, n = 60) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const sapaan = (jam) => (jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam');
const kapan = (n) => (n < 0 ? `lewat ${-n} hari` : n === 0 ? 'hari ini' : n === 1 ? 'besok' : `${n} hari lagi`);
function tanggalPanjang(iso) { const d = new Date(iso + 'T00:00:00'); return `${HARI[d.getDay()]} ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; }
const baris = (r) => `• ${kapan(r.sisa_hari)} — ${clip(r.label)}${r.judul ? ' (' + clip(r.judul, 40) + ')' : ''}${r.jumlah ? ' ' + rp(r.jumlah) : ''}`;

/** reminders: item { label, judul, sisa_hari, jumlah } terurut; perhatian: { review, blocked, persetujuan, gagal, belumVerifikasi }; beban: [{ nama, jumlah }]. */
function buildStandup({ kantor, tanggal, jam, reminders = [], perhatian = {}, beban = [], kas, proyek = [] }) {
  const prioritas = reminders.filter((r) => r.sisa_hari <= 1), mendekati = reminders.filter((r) => r.sisa_hari >= 2 && r.sisa_hari <= 7);
  const out = [`${sapaan(jam)}! Standup ${kantor || 'kantor'} · ${tanggalPanjang(tanggal)}`, ''];
  if (prioritas.length) { out.push(`Prioritas hari ini (${prioritas.length}):`); prioritas.slice(0, MAX_ITEM).forEach((r) => out.push(baris(r))); if (prioritas.length > MAX_ITEM) out.push(`… dan ${prioritas.length - MAX_ITEM} lainnya`); }
  else out.push('Tidak ada yang mendesak hari ini.');
  if (mendekati.length) { out.push('', `Dalam 7 hari ke depan (${mendekati.length}):`); mendekati.slice(0, MAX_ITEM).forEach((r) => out.push(baris(r))); }
  const butuh = [perhatian.persetujuan ? `${perhatian.persetujuan} persetujuan menunggu` : '', perhatian.review ? `${perhatian.review} tugas menunggu dicek` : '', perhatian.blocked ? `${perhatian.blocked} tugas terblokir` : '',
    perhatian.gagal ? `${perhatian.gagal} dokumen gagal dibaca` : '', perhatian.belumVerifikasi ? `${perhatian.belumVerifikasi} dokumen belum diverifikasi` : ''].filter(Boolean);
  if (butuh.length) out.push('', 'Perlu keputusan atau pengecekan: ' + butuh.join(', ') + '.');
  if (proyek.length) { out.push('', `Proyek berisiko (${proyek.length}):`); proyek.slice(0, 4).forEach((p) => out.push(`• ${clip(p.nama, 40)} — ${p.pesan}`)); }
  if (beban.length) out.push('', 'Tugas terbuka per penanggung jawab: ' + beban.slice(0, MAX_BEBAN).map((b) => `${clip(b.nama, 24)} ${b.jumlah}`).join(' · '));
  if (kas) out.push('', `Kas bulan ini (terverifikasi): masuk ${rp(kas.masuk)}, keluar ${rp(kas.keluar)}.`);
  return out.join('\n');
}

module.exports = { buildStandup, sapaan, tanggalPanjang };
