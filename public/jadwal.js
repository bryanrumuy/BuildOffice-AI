'use strict';
/** Pengaturan: laporan wajib terjadwal per agen (siapa melapor apa, kapan; ubah jam, matikan, pratinjau, kirim sekarang). */
const JENIS_LAPORAN = { 'keuangan-mingguan': 'Kas 7 hari, draf, dan tagihan', 'pengingat-harian': 'Jatuh tempo 7 hari ke depan' };
const jadwalForm = (x) => openForm({
  title: 'Ubah jadwal: ' + x.agenNama, submitLabel: 'Simpan', values: { hari: String(x.hari), jam: String(x.jam) },
  fields: [...(x.frekuensi === 'mingguan' ? [{ key: 'hari', label: 'Hari', type: 'select', options: HARI_MINGGU }] : []), { key: 'jam', label: 'Jam (0-23)', type: 'number' }],
  onSubmit: async (v) => { await api('/api/jadwal/' + x.id, { method: 'PUT', body: x.frekuensi === 'mingguan' ? { hari: v.hari, jam: v.jam } : { jam: v.jam } }); toast('Jadwal tersimpan'); loadJadwal(); },
});
async function loadJadwal() {
  const box = $('#jadwalBox'); if (!box) return;
  const daftar = await api('/api/jadwal'), pratinjau = h('pre', { class: 'digest hide' });
  const guardAksi = (fn) => async () => { try { await fn(); } catch (e) { toast(errText(e), 'bad'); } };
  const baris = daftar.map((x) => h('tr', { class: x.aktif ? '' : 'muted' },
    td(h('b', {}, x.agenNama), h('div', { class: 'muted' }, JENIS_LAPORAN[x.jenis] || 'Ringkasan bidangnya')), td(x.teks),
    td(x.terakhir ? fmtDate(x.terakhir) : h('span', { class: 'muted' }, 'belum pernah')), td(h('span', { class: 'chip ' + (x.aktif ? 'ok' : '') }, x.aktif ? 'Aktif' : 'Dimatikan')),
    actionCell(h('button', { class: 'btn small', onclick: () => jadwalForm(x) }, 'Ubah'),
      h('button', { class: 'btn small', onclick: guardAksi(async () => { await api('/api/jadwal/' + x.id, { method: 'PUT', body: { aktif: !x.aktif } }); loadJadwal(); }) }, x.aktif ? 'Matikan' : 'Aktifkan'),
      h('button', { class: 'btn small', onclick: guardAksi(async () => { pratinjau.textContent = (await api('/api/jadwal/' + x.id + '/pratinjau')).text; pratinjau.classList.remove('hide'); }) }, 'Pratinjau'),
      h('button', { class: 'btn small primary', disabled: state.me.telegram ? false : 'disabled', onclick: guardAksi(async () => { await api('/api/jadwal/' + x.id + '/kirim', { method: 'POST' }); toast('Laporan terkirim ke Telegram'); loadJadwal(); }) }, 'Kirim sekarang'))));
  box.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'Laporan rutin agen'),
    h('div', { class: 'muted' }, 'Agen melapor sendiri ke Telegram pada hari dan jam ini, tanpa token AI. Bila server baru menyala setelah jamnya, laporan hari itu tetap dikirim. Satu laporan per jadwal per hari.'),
    state.me.telegram ? null : h('div', { class: 'muted', style: 'margin-top:6px' }, 'Telegram belum diatur, jadi laporan belum bisa terkirim.'),
    h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Agen', 'Jadwal', 'Terakhir terkirim', 'Status'].map((t) => h('th', {}, t)), h('th', {}))), h('tbody', {}, ...baris))), pratinjau));
}
