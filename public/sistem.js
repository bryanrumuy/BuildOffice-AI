'use strict';
/** Kartu di Pengaturan untuk Asisten Harian (standup), Pelapor (laporan mingguan), dan Penjaga Sistem (kesehatan, backup). */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const STATUS_CHIP = { ok: 'ok', info: 'info', peringatan: 'warn', bahaya: 'bad' };

const jalankan = (path, pesan, after) => guard(async () => { const r = await api(path, { method: 'POST' }); toast(typeof pesan === 'function' ? pesan(r) : pesan); if (after) after(); });

async function loadSistem() {
  const box = $('#sistemBox'); if (!box) return;
  const me = state.me, k = await api('/api/kesehatan');
  const pratinjau = h('pre', { class: 'digest hide' });
  const lihatStandup = guard(async () => { pratinjau.textContent = (await api('/api/standup')).text; pratinjau.classList.remove('hide'); });
  const baris = k.checks.map((c) => h('div', { class: 'agent-row' }, h('span', { class: 'chip ' + (STATUS_CHIP[c.status] || '') }, c.status), h('div', {}, h('b', {}, c.nama), h('div', { class: 'muted' }, c.ket))));
  box.replaceChildren(
    h('div', { class: 'card' }, h('h3', {}, 'Penjaga Sistem'), h('div', { class: 'muted' }, 'Memeriksa kesehatan kantor tanpa memakai token. Ia hanya melakukan perbaikan aman: mengulang dokumen yang gagal karena gangguan sementara (maks 2 kali), membuat backup, dan memberi peringatan lewat Telegram. Ia tidak pernah mengubah kode atau menghapus data.'),
      h('div', { style: 'margin-top:8px' }, baris),
      h('div', { class: 'row need-admin', style: 'margin-top:10px' },
        h('button', { class: 'btn primary', onclick: jalankan('/api/penjaga/jalankan', (r) => r.aksi.length ? `${r.aksi.length} tindakan dijalankan` : 'Semua sehat, tidak ada yang perlu diperbaiki', loadSistem) }, 'Cek & perbaiki sekarang'),
        h('button', { class: 'btn', onclick: jalankan('/api/penjaga/backup', (r) => `Backup dibuat (${r.berkas} berkas)`, loadSistem) }, 'Backup sekarang'),
        h('button', { class: 'btn', onclick: jalankan('/api/penjaga/ulang-dokumen', (r) => r.aksi.length ? `${r.aksi.length} dokumen diulang` : 'Tidak ada dokumen gagal', loadSistem) }, 'Ulangi dokumen gagal'))),
    h('div', { class: 'card' }, h('h3', {}, 'Perintah lewat Telegram'),
      h('div', { class: 'row' }, h('span', { class: 'chip ' + (me.telegramBot ? 'ok' : 'warn') }, me.telegramBot ? 'Aktif' : me.telegramBotSetup ? 'Menunggu chat ID' : 'Belum aktif'), me.agenWeb ? h('span', { class: 'chip warn' }, 'Agen boleh membuka web') : null),
      h('div', { class: 'muted', style: 'margin-top:8px' }, me.telegramBot ? 'Tulis apa saja ke bot kamu di Telegram dan agen serbaguna mengerjakannya, mis. "buat file Excel daftar tagihan 30 hari". Ketik /bantuan di bot untuk semua perintah (/tugas, /kerjakan, /setuju, /status, /laporan).' : me.telegramBotSetup ? 'Token bot sudah terbaca, tetapi chat ID belum. Kirim /start ke bot kamu, catat ID yang dibalas, lalu isi di start.bat (TELEGRAM_CHAT_ID).' : 'Isi token bot dan chat ID saat menjalankan start.bat. Bot menarik pesan sendiri (tanpa alamat publik).'),
      h('ul', { class: 'steps' }, h('li', {}, 'Hanya chat yang cocok dengan chat ID kamu yang dilayani; pesan orang lain diabaikan dan dicatat di log.'), h('li', {}, 'Di grup, hanya pengguna di TELEGRAM_USER_IDS yang dilayani.'), h('li', {}, 'Tidak ada perintah untuk menghapus data, mengubah pengaturan, membayar, atau melunasi tagihan.'), h('li', {}, 'Pesan keluar yang diusulkan agen tetap butuh /setuju darimu.'))),
    h('div', { class: 'card' }, h('h3', {}, 'Asisten Harian: standup pagi'),
      h('div', { class: 'muted' }, `Sapaan dan ringkasan: apa yang jatuh tempo, siapa memegang tugas apa, apa yang menunggu keputusan. ${me.digestHour != null ? `Terkirim otomatis tiap hari setelah jam ${me.digestHour}:00.` : 'Kirim otomatis aktif bila DIGEST_HOUR diatur.'}`),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn', onclick: lihatStandup }, 'Pratinjau standup'),
        h('button', { class: 'btn primary need-admin', disabled: me.telegram ? false : 'disabled', onclick: jalankan('/api/standup/kirim', 'Standup terkirim ke Telegram') }, 'Kirim sekarang')), pratinjau),
    h('div', { class: 'card' }, h('h3', {}, 'Pelapor: laporan mingguan'),
      h('div', { class: 'muted' }, `Progres proyek, kas, tagihan, dan tugas dalam satu file untuk pemilik. ${me.laporanHari != null ? `Terkirim otomatis tiap ${HARI[me.laporanHari]}.` : 'Kirim otomatis aktif bila LAPORAN_HARI diatur (0 = Minggu … 6 = Sabtu).'}`),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('a', { class: 'btn', href: '/api/laporan-mingguan.html', target: '_blank', rel: 'noopener' }, 'Buka (HTML)'),
        me.pdfTersedia ? h('a', { class: 'btn', href: '/api/laporan-mingguan.pdf' }, 'Unduh PDF') : h('span', { class: 'muted' }, 'PDF butuh Edge/Chrome di komputer ini; di HTML pakai Cetak → Simpan sebagai PDF.'),
        h('button', { class: 'btn primary need-admin', disabled: me.telegram ? false : 'disabled', onclick: jalankan('/api/laporan-mingguan/kirim', (r) => `Laporan ${r.format.toUpperCase()} terkirim ke Telegram`) }, 'Kirim ke Telegram'))));
}
