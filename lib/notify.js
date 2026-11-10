'use strict';
/** Notifikasi Telegram (opsional). Aktif jika TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di-set. */
const { ambil } = require('./jaringan');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const BASE = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const MAX_LEN = 4000; // batas Telegram 4096 karakter
const SOON_DAYS = 14;

const enabled = () => Boolean(TOKEN && CHAT_ID);

async function sendTelegram(text) {
  if (!enabled()) throw new Error('Telegram belum diatur (TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID).');
  const res = await ambil(`${BASE}/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: text.slice(0, MAX_LEN), disable_web_page_preview: true }),
    timeoutMs: 20000,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error('Telegram error ' + res.status + ': ' + (body.description || 'tidak diketahui'));
}

/** Kirim file (mis. laporan PDF) ke chat Telegram. */
async function sendDocument(buf, filename, caption, mime = 'application/pdf') {
  if (!enabled()) throw new Error('Telegram belum diatur (TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID).');
  const fd = new FormData();
  fd.append('chat_id', CHAT_ID); fd.append('caption', String(caption || '').slice(0, 1000));
  fd.append('document', new Blob([buf], { type: mime }), filename);
  const res = await ambil(`${BASE}/bot${TOKEN}/sendDocument`, { method: 'POST', body: fd, timeoutMs: 60000 });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error('Telegram error ' + res.status + ': ' + (body.description || 'tidak diketahui'));
}

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
function buildDigest({ namaKantor, tanggal, reminders, pending, kas, proyek = [] }) {
  const soon = reminders.filter((r) => r.sisa_hari <= SOON_DAYS);
  const lines = [`${namaKantor || 'Kantor AI'} — ringkasan ${tanggal}`, ''];
  lines.push(soon.length ? `Jatuh tempo ≤ ${SOON_DAYS} hari (${soon.length}):` : `Tidak ada jatuh tempo dalam ${SOON_DAYS} hari.`);
  for (const r of soon.slice(0, 15)) {
    const when = r.sisa_hari < 0 ? `lewat ${-r.sisa_hari} hari` : r.sisa_hari === 0 ? 'hari ini' : `${r.sisa_hari} hari lagi`;
    lines.push(`• ${r.tanggal} (${when}) ${r.label} — ${r.judul}${r.jumlah ? ' ' + rp(r.jumlah) : ''}`);
  }
  if (proyek.length) { lines.push('', `Proyek berisiko (${proyek.length}):`); for (const p of proyek.slice(0, 5)) lines.push(`• ${p.nama} — ${p.pesan}`); }
  lines.push('', `Menunggu verifikasi: ${pending.docs} dokumen, ${pending.kas} transaksi kas`);
  lines.push(`Kas bulan ini (terverifikasi): masuk ${rp(kas.masuk)}, keluar ${rp(kas.keluar)}`);
  return lines.join('\n');
}

module.exports = { enabled, sendTelegram, sendDocument, buildDigest };
