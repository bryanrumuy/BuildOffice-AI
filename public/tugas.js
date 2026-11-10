'use strict';
/** Tab Tugas: instruksi ke Manajer, Kotak Persetujuan, Papan Tugas, dan daftar agen. Bidang pekerjaan apa pun; tidak terikat satu jenis usaha. */
const MAX_LAMPIRAN_TUGAS = 3;
const KOLOM = [['todo', 'Akan dikerjakan'], ['doing', 'Dikerjakan'], ['review', 'Perlu dicek'], ['blocked', 'Terblokir'], ['done', 'Selesai']];
const CONTOH_INSTRUKSI = ['Siapkan acara keluarga bulan depan', 'Urus perpanjangan izin usaha', 'Susun laporan keuangan semester ini', 'Rencanakan renovasi dapur: tahapan dan anggarannya'];
const tugasState = { teks: '', pilih: new Set(), docs: [], agen: [], busy: false, pertanyaan: null, kerja: new Set() };
const ownerName = (p) => (!p ? 'Belum ada penanggung jawab' : p.startsWith('agen:') ? (tugasState.agen.find((a) => a.id === p.slice(5)) || { nama: p.slice(5) }).nama : p.slice(8));

async function loadTugas() {
  const [tugas, setuju, agen, docs] = await Promise.all([api('/api/tugas'), api('/api/persetujuan?status=menunggu'), api('/api/agen'), api('/api/docs')]);
  tugasState.agen = agen; tugasState.docs = docs.filter((d) => d.data);
  tugasState.pilih = new Set([...tugasState.pilih].filter((id) => tugasState.docs.some((d) => d.id === id)));
  renderTugas({ tugas, setuju });
}

async function kirimInstruksi() {
  const teks = tugasState.teks.trim();
  if (!teks) return toast('Tulis instruksinya dulu.', 'bad');
  tugasState.busy = true; tugasState.pertanyaan = null; renderTugasBusy();
  try {
    const r = await api('/api/instruksi', { method: 'POST', body: { teks, docIds: [...tugasState.pilih] } });
    if (r.tugas.length) { tugasState.teks = ''; tugasState.pilih.clear(); toast(`${r.tugas.length} tugas dibuat di papan.`); }
    else tugasState.pertanyaan = r.instruksi;
    refreshDashboard();
  } catch (e) { toast(errText(e), 'bad'); }
  tugasState.busy = false; loadTugas();
}
function renderTugasBusy() {
  const b = $('#instRun'), s = $('#instStatus'); if (!b) return;
  b.disabled = tugasState.busy; b.textContent = tugasState.busy ? 'Manajer menyusun rencana…' : 'Minta Manajer memecah';
  s.textContent = tugasState.busy ? 'Biasanya 10–30 detik; jangan tutup halaman ini.' : '';
}

const kerjakan = (t) => guard(async () => {
  tugasState.kerja.add(t.id); loadTugasLight();
  try { await api(`/api/tugas/${t.id}/kerjakan`, { method: 'POST' }); toast('Agen selesai. Periksa hasilnya di kolom "Perlu dicek".'); refreshDashboard(); }
  finally { tugasState.kerja.delete(t.id); loadTugas(); }
});
const pindah = (t, status) => guard(async () => { await api('/api/tugas/' + t.id, { method: 'PATCH', body: { status } }); loadTugas(); refreshDashboard(); });
let lastTugas = null;
function loadTugasLight() { if (lastTugas) renderTugas(lastTugas); }

const siapAgen = (tugas) => tugas.filter((t) => t.status === 'todo' && t.pemilik && t.pemilik.startsWith('agen:')).length;
async function kerjakanSemua() {
  const r = await api('/api/tugas/kerjakan-semua', { method: 'POST' });
  toast('Agen mulai mengerjakan ' + r.jumlah + ' tugas. Hasilnya muncul di kolom "Perlu dicek".'); loadTugas();
}
function tugasForm() {
  const pilihan = [{ value: '', label: '(belum ditentukan)' }, ...tugasState.agen.filter((a) => a.bisaDitugasi).map((a) => ({ value: 'agen:' + a.id, label: 'Agen: ' + a.nama })), { value: 'manusia', label: 'Manusia (isi nama di bawah)' }];
  openForm({ title: 'Tugas baru', submitLabel: 'Tambah', fields: [
    { key: 'judul', label: 'Judul', wide: true }, { key: 'deskripsi', label: 'Rincian (opsional)', type: 'textarea', wide: true },
    { key: 'pemilik', label: 'Dikerjakan oleh', type: 'select', options: pilihan }, { key: 'nama', label: 'Nama penanggung jawab (jika manusia)' }, { key: 'tenggat', label: 'Tenggat', type: 'date' }],
  onSubmit: async (v) => {
    const pemilik = v.pemilik === 'manusia' ? (v.nama.trim() ? 'manusia:' + v.nama.trim() : '') : v.pemilik;
    await api('/api/tugas', { method: 'POST', body: { judul: v.judul, deskripsi: v.deskripsi, pemilik, tenggat: v.tenggat || null } });
    loadTugas(); refreshDashboard();
  } });
}

function tugasDetail(t) {
  const dlg = $('#dlg'), form = $('#dlgForm');
  const salin = async () => { try { await navigator.clipboard.writeText(Md.plain(t.hasil)); toast('Disalin'); } catch { toast('Gagal menyalin. Blok teksnya lalu salin manual.', 'bad'); } };
  form.replaceChildren(...[
    h('h3', {}, t.judul),
    h('div', { class: 'muted' }, [ownerName(t.pemilik), t.tenggat ? 'tenggat ' + fmtDate(t.tenggat) : 'tanpa tenggat', t.kelompok ? 'dari: ' + t.kelompok.judul : ''].filter(Boolean).join(' · ')),
    t.deskripsi ? h('p', {}, t.deskripsi) : null,
    t.hasil ? h('div', {}, h('div', { class: 'row between' }, h('b', {}, 'Hasil kerja'), h('button', { class: 'btn small', type: 'button', onclick: salin }, 'Salin')), h('div', { class: 'md' }, Md.dom(t.hasil, h))) : null,
    langkahList(t.langkah), t.berkas && t.berkas.length ? h('div', { class: 'row' }, t.berkas.map((id) => h('a', { class: 'btn small', href: '/api/berkas/' + id + '/unduh' }, '⬇ Berkas hasil'))) : null,
    h('b', {}, 'Riwayat'),
    h('div', { class: 'riwayat' }, t.riwayat.slice(-12).reverse().map((r) => h('div', { class: 'act' }, h('span', { class: 'num' }, new Date(r.t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })), h('span', {}, `${r.oleh}: ${r.aksi}${r.ket ? ' — ' + r.ket : ''}`)))),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Tutup'))].filter(Boolean));
  form.onsubmit = (e) => { e.preventDefault(); dlg.close(); };
  dlg.showModal();
}

function tugasCard(t, demo) {
  const lewat = t.tenggat && t.status !== 'done' && daysUntil(t.tenggat) < 0, milikAgen = Boolean(t.pemilik && t.pemilik.startsWith('agen:')), sibuk = tugasState.kerja.has(t.id);
  const gerak = h('select', { class: 'need-staf', 'aria-label': 'Ubah status ' + t.judul, value: t.status, onchange: (e) => pindah(t, e.target.value)() }, KOLOM.map(([v, l]) => h('option', { value: v }, l)));
  return h('div', { class: 'tugas' + (lewat ? ' late' : '') },
    h('b', {}, t.judul),
    h('div', { class: 'muted' }, ownerName(t.pemilik) + (t.tenggat ? ` · ${fmtDate(t.tenggat)}${lewat ? ' (terlambat)' : ''}` : '')),
    t.kelompok ? h('div', { class: 'muted' }, '↳ ' + clipText(t.kelompok.judul, 40)) : null,
    h('div', { class: 'row', style: 'margin-top:6px' },
      milikAgen && t.status !== 'done' ? h('button', { class: 'btn small primary need-staf', disabled: demo || sibuk || tugasState.busy ? 'disabled' : false, onclick: kerjakan(t) }, sibuk ? 'Agen bekerja…' : 'Kerjakan') : null,
      h('button', { class: 'btn small', onclick: () => tugasDetail(t) }, t.hasil ? 'Lihat hasil' : 'Detail'),
      h('button', { class: 'btn small danger need-admin', onclick: guard(async () => { if (confirm(`Hapus tugas "${t.judul}"?`)) { await api('/api/tugas/' + t.id, { method: 'DELETE' }); loadTugas(); refreshDashboard(); } }) }, 'Hapus')),
    gerak);
}

function persetujuanCard(p) {
  const putus = (aksi, pesan) => guard(async () => { await api(`/api/persetujuan/${p.id}/${aksi}`, { method: 'POST' }); toast(pesan); loadTugas(); });
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, `${nameOf(p.oleh)} ingin mengirim pesan Telegram`), h('div', { class: 'row' },
      h('button', { class: 'btn small primary need-staf', disabled: state.me.telegram ? false : 'disabled', title: state.me.telegram ? '' : 'Telegram belum diatur', onclick: putus('setuju', 'Terkirim ke Telegram') }, 'Setujui & kirim'),
      h('button', { class: 'btn small danger need-staf', onclick: putus('tolak', 'Ditolak, tidak dikirim') }, 'Tolak'))),
    h('pre', { class: 'hasil' }, p.teks));
}

function agenCard(a) {
  const ubah = () => openForm({ title: 'Ubah agen ' + a.nama, fields: [{ key: 'peran', label: 'Peran (apa tugas agen ini)', type: 'textarea', wide: true }, { key: 'tujuan', label: 'Tujuan', wide: true }], values: a,
    onSubmit: async (v) => { await api('/api/agen/' + a.id, { method: 'PUT', body: v }); toast('Agen diperbarui'); loadTugas(); } });
  return h('div', { class: 'agent-row' }, h('span', { class: 'dot ' + ((state.agents.find((x) => x.id === a.id) || {}).status || 'idle') }),
    h('div', { style: 'flex:1;min-width:0' }, h('b', {}, a.nama), ' ', h('span', { class: 'chip' }, a.bawaan ? 'bawaan' : 'kustom'), a.bisaDitugasi ? null : ' ', a.bisaDitugasi ? null : h('span', { class: 'chip' }, 'tidak diberi tugas tertulis'),
      h('div', { class: 'muted' }, a.peran)),
    h('div', { class: 'row need-admin' }, h('button', { class: 'btn small', onclick: ubah }, 'Ubah'),
      a.bawaan ? null : h('button', { class: 'btn small danger', onclick: guard(async () => { if (confirm(`Hapus agen "${a.nama}"?`)) { await api('/api/agen/' + a.id, { method: 'DELETE' }); loadTugas(); } }) }, 'Hapus')));
}
const agenBaru = () => openForm({ title: 'Agen baru', submitLabel: 'Tambah', note: 'Agen baru langsung bisa diberi tugas oleh Manajer maupun manual. Cukup tulis perannya dengan bahasa biasa.',
  fields: [{ key: 'nama', label: 'Nama (mis. Agen Penagih)' }, { key: 'tujuan', label: 'Tujuan (opsional)' }, { key: 'peran', label: 'Peran: apa yang dikerjakan agen ini (min. 10 huruf)', type: 'textarea', wide: true }],
  onSubmit: async (v) => { await api('/api/agen', { method: 'POST', body: v }); toast('Agen ditambahkan'); loadTugas(); } });

function instruksiCard(demo) {
  const ta = h('textarea', { rows: '3', maxlength: '3000', 'aria-label': 'Instruksi untuk Manajer', value: tugasState.teks, oninput: (e) => { tugasState.teks = e.target.value; },
    placeholder: 'Tulis pekerjaan besar apa saja dengan bahasa biasa. Manajer memecahnya jadi tugas kecil, menentukan siapa yang mengerjakan dan tenggatnya.' });
  const penuh = tugasState.pilih.size >= MAX_LAMPIRAN_TUGAS;
  const daftar = tugasState.docs.length ? h('div', { class: 'picklist', role: 'group', 'aria-label': 'Dokumen terlampir' }, tugasState.docs.map((d) => {
    const cb = h('input', { type: 'checkbox', id: 'tk' + d.id, onchange: (e) => { if (e.target.checked) tugasState.pilih.add(d.id); else tugasState.pilih.delete(d.id); loadTugasLight(); } });
    cb.checked = tugasState.pilih.has(d.id); cb.disabled = penuh && !cb.checked;
    return h('label', { class: 'pick', for: 'tk' + d.id }, cb, h('span', {}, d.data.judul, h('span', { class: 'muted' }, ` · ${d.originalName}`)));
  })) : h('div', { class: 'muted' }, 'Tidak ada dokumen terlampir. (Opsional: unggah di tab Dokumen.)');
  const q = tugasState.pertanyaan;
  return h('div', { class: 'card' }, h('h3', {}, 'Beri instruksi ke Manajer'),
    demo ? h('div', { style: 'margin-bottom:8px' }, h('span', { class: 'chip warn' }, 'Butuh mode AI'), ' Manajer memakai AI. Papan Tugas tetap bisa dipakai manual.') : null,
    h('div', { class: 'chips', style: 'margin:0 0 8px' }, CONTOH_INSTRUKSI.map((c) => h('button', { class: 'chip', type: 'button', onclick: () => { tugasState.teks = c; ta.value = c; ta.focus(); } }, c))),
    ta, h('div', { class: 'muted', style: 'margin:10px 0 4px' }, `Lampirkan dokumen bila perlu (maks ${MAX_LAMPIRAN_TUGAS}).`), daftar,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn primary need-staf', id: 'instRun', disabled: demo ? 'disabled' : false, onclick: kirimInstruksi }, 'Minta Manajer memecah'), h('span', { class: 'muted', id: 'instStatus', role: 'status' })),
    q ? h('div', { class: 'card', style: 'margin-top:12px;border-color:var(--warn)' }, h('b', {}, 'Manajer butuh penjelasan dulu, belum ada tugas dibuat:'), h('ul', { class: 'steps' }, q.pertanyaan.map((x) => h('li', {}, x))), h('div', { class: 'muted' }, 'Lengkapi instruksinya di atas lalu kirim lagi.')) : null,
    h('div', { class: 'muted', style: 'margin-top:8px' }, 'Manajer hanya membuat tugas. Agen menulis hasil, tapi pesan keluar (Telegram) menunggu persetujuanmu di Kotak Persetujuan.'));
}

function renderTugas(data) {
  lastTugas = data;
  const box = $('#tugasBody'), demo = state.me.mode !== 'ai', { tugas, setuju } = data;
  const kolom = KOLOM.map(([v, label]) => { const isi = tugas.filter((t) => t.status === v); return h('div', { class: 'kolom' }, h('div', { class: 'kolom-h' }, label, h('span', { class: 'chip' }, String(isi.length))), isi.length ? isi.map((t) => tugasCard(t, demo)) : h('div', { class: 'muted' }, '—')); });
  box.replaceChildren(...[
    instruksiCard(demo),
    setuju.length ? h('div', { class: 'stack' }, h('h3', { style: 'margin:6px 0 0' }, `Kotak Persetujuan (${setuju.length})`), ...setuju.map(persetujuanCard)) : null,
    h('div', { class: 'row between' }, h('h3', { style: 'margin:6px 0 0' }, 'Papan Tugas'), h('div', { class: 'row' }, h('button', { class: 'btn need-staf', disabled: demo || tugasState.busy || !siapAgen(tugas) ? 'disabled' : false, title: 'Agen mengerjakan semua tugas berstatus "Akan dikerjakan", berurutan sesuai syaratnya', onclick: guard(kerjakanSemua) }, 'Kerjakan semua tugas agen' + (siapAgen(tugas) ? ' (' + siapAgen(tugas) + ')' : '')), h('button', { class: 'btn need-staf', onclick: tugasForm }, '+ Tugas manual'))),
    tugas.length ? h('div', { class: 'kanban' }, kolom) : h('div', { class: 'empty' }, 'Papan masih kosong. Beri instruksi ke Manajer, atau tambah tugas manual.'),
    h('div', { class: 'row between' }, h('h3', { style: 'margin:6px 0 0' }, 'Agen'), h('button', { class: 'btn need-admin', onclick: agenBaru }, '+ Agen baru')),
    h('div', { class: 'card' }, tugasState.agen.map(agenCard))].filter(Boolean));
  renderTugasBusy();
}
