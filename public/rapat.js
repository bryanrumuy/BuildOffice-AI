'use strict';
/** Rapat kantor di Beranda: tombol memanggil rapat, dan kartu notulen rapat terakhir (butir tindak lanjut bisa dijadikan tugas). */
let rapatBerjalan = false;

function panggilRapat() {
  openForm({ title: 'Panggil rapat', submitLabel: 'Mulai rapat', note: 'Semua agen berkumpul di Ruang Rapat, Manajer Proyek memimpin, tiap agen melapor dari data bidangnya, lalu notulen disusun. Rapat tidak mengubah data.',
    fields: [{ key: 'agenda', label: 'Agenda (boleh kosong untuk rapat rutin)', type: 'textarea', wide: true, placeholder: 'Mis. bahas tagihan yang terlambat dan dokumen yang belum diverifikasi' }],
    onSubmit: async (v) => {
      rapatBerjalan = true; toast('Memanggil semua agen ke Ruang Rapat…'); showTab('beranda');
      api('/api/rapat', { method: 'POST', body: { agenda: v.agenda } }).then(() => loadRapat()).catch((e) => toast(errText(e), 'bad')).finally(() => { rapatBerjalan = false; });
    } });
}

async function loadRapat() {
  const box = $('#rapatIsi'); if (!box) return;
  const l = await api('/api/rapat'), r = l[0];
  if (!r) { box.replaceChildren(h('div', { class: 'muted' }, 'Belum ada rapat. Klik "Panggil rapat" di samping kantor, atau ketik "rapat" ke bot Telegram.')); return; }
  const nama = (id) => nameOf(id);
  box.replaceChildren(...[
    h('div', { class: 'muted' }, `${new Date(r.t).toLocaleString('id-ID')}${r.agenda ? ' · agenda: ' + r.agenda : ' · rapat rutin'}${r.tanpaAI ? ' · disusun dari data (tanpa AI)' : ''}`),
    h('div', { class: 'row need-admin' }, h('button', { class: 'btn small', onclick: guard(async () => { await api(`/api/rapat/${r.id}/telegram`, { method: 'POST' }); toast('Notulen terkirim ke Telegram'); }) }, 'Kirim notulen ke Telegram')),
    r.ringkasan ? h('p', {}, r.ringkasan) : null,
    r.keputusan.length ? h('div', {}, h('b', {}, 'Keputusan'), h('ul', { class: 'steps' }, r.keputusan.map((k) => h('li', {}, k)))) : null,
    r.tindak_lanjut.length ? h('div', {}, h('b', {}, 'Tindak lanjut'), r.tindak_lanjut.map((t, i) => h('div', { class: 'agent-row' },
      h('div', { style: 'flex:1;min-width:0' }, t.judul, h('div', { class: 'muted' }, t.pemilik.startsWith('agen:') ? nama(t.pemilik.slice(5)) : t.pemilik.slice(8))),
      t.tugasId ? h('span', { class: 'chip ok' }, 'sudah jadi tugas') : h('button', { class: 'btn small need-staf', onclick: guard(async () => { await api(`/api/rapat/${r.id}/tugas`, { method: 'POST', body: { indeks: i } }); toast('Dijadikan tugas di Papan Tugas'); loadRapat(); refreshDashboard(); }) }, 'Jadikan tugas')))) : h('div', { class: 'muted' }, 'Tidak ada tindak lanjut.'),
    h('details', { class: 'langkah' }, h('summary', {}, `Jalannya rapat (${r.percakapan.length} ucapan)`), r.percakapan.map((p) => h('div', {}, h('b', {}, nama(p.dari) + ': '), p.teks))),
  ].filter(Boolean));
}
