'use strict';
/**
 * Panel di samping kantor 2.5D: kotak persetujuan, formulir "Brief baru" dengan perkiraan token dari pemakaian nyata,
 * dan daftar agen per ruangan (klik ruangan atau agen untuk memfokuskan kamera). Hanya tampilan: semua perintah memakai API yang sudah ada.
 */
const Panel = (() => {
  const MODE = {
    rapat: { label: 'Rapat kantor', jenis: 'rapat', ket: 'Semua agen berkumpul di Ruang Rapat dan melapor dari data bidangnya.', ph: 'Agenda rapat (boleh kosong untuk rapat rutin)…', butuhTeks: false, mulai: 'Mulai rapat' },
    instruksi: { label: 'Pecah jadi tugas', jenis: 'instruksi', ket: 'Manajer memecah brief menjadi tugas di Papan Tugas.', ph: 'Tulis pekerjaan yang ingin diurus, mis. siapkan acara keluarga bulan depan…', butuhTeks: true, mulai: 'Minta Manajer' },
    perintah: { label: 'Perintah agen', jenis: 'perintah', ket: 'Agen serbaguna memakai alat (baca data, buat berkas, catat kas draft).', ph: 'Tulis perintah, mis. buatkan ringkasan tagihan bulan ini…', butuhTeks: true, mulai: 'Jalankan' },
  };
  const ANGKA = new Intl.NumberFormat('id-ID');
  const dasarTeks = (e) => (e.dasar === 'riwayat' ? `dari ${e.n} pemakaian sebelumnya` : 'perkiraan awal, makin akurat setelah dipakai');
  let biaya = null, mode = 'rapat', sibuk = false, fokus = null, el = {};
  const warnaAgen = (id) => (typeof Avatars !== 'undefined' && Avatars.LOOKS[id] ? Avatars.LOOKS[id].shirt : '#5aa9ff');

  /* ---------- perkiraan biaya ---------- */
  async function muatBiaya() { try { biaya = await api('/api/biaya'); } catch { biaya = null; } renderBiaya(); }
  function renderBiaya() {
    if (!el.biaya) return;
    const m = MODE[mode], e = biaya && biaya.jenis.find((x) => x.jenis === m.jenis);
    if (!e) { el.biaya.textContent = ''; return; }
    el.biaya.className = 'biaya' + (e.cukup ? '' : ' bad');
    if (!biaya.ai) { el.biaya.replaceChildren(h('b', {}, 'Mode demo: tanpa token'), ' · agen memakai data nyata kantor saja.'); return; }
    el.biaya.replaceChildren(h('b', {}, `±${ANGKA.format(e.token)} token`), ` (${ANGKA.format(e.min)}–${ANGKA.format(e.maks)}) · ${ANGKA.format(e.persenBulan)}% dari batas bulanan`,
      h('div', { class: 'muted' }, `${dasarTeks(e)}. ${e.cukup ? `Sisa bulan ini ${ANGKA.format(e.sisaBulan)} token.` : 'Sisa token bulan ini tidak cukup.'}`));
  }

  /* ---------- Brief baru ---------- */
  function setMode(k) {
    mode = k; const m = MODE[k];
    for (const b of el.modes.children) b.classList.toggle('on', b.dataset.mode === k);
    el.teks.placeholder = m.ph; el.ket.textContent = m.ket; el.mulai.textContent = sibuk ? 'Sedang berjalan…' : m.mulai; renderBiaya(); cekTombol();
  }
  const cekTombol = () => { el.mulai.disabled = sibuk || (MODE[mode].butuhTeks && !el.teks.value.trim()); };
  async function mulai() {
    const m = MODE[mode], teks = el.teks.value.trim();
    if (sibuk || (m.butuhTeks && !teks)) return;
    sibuk = true; setMode(mode);
    try {
      if (mode === 'rapat') { toast('Memanggil semua agen ke Ruang Rapat…'); await api('/api/rapat', { method: 'POST', body: { agenda: teks } }); loadRapat().catch(() => {}); }
      else if (mode === 'instruksi') { const r = await api('/api/instruksi', { method: 'POST', body: { teks, docIds: [] } }); toast(r.tugas && r.tugas.length ? `${r.tugas.length} tugas dibuat di Papan Tugas.` : 'Manajer butuh penjelasan tambahan, buka tab Tugas.'); }
      else { await api('/api/perintah', { method: 'POST', body: { instruksi: teks } }); toast('Perintah selesai. Hasilnya ada di tab Tanya & Perintah.'); }
      el.teks.value = '';
    } catch (e) { toast(errText(e), 'bad'); }
    sibuk = false; setMode(mode); muatBiaya(); refreshDashboard().catch(() => {});
  }

  /* ---------- kotak persetujuan ---------- */
  async function muatPersetujuan() {
    let daftar = []; try { daftar = await api('/api/persetujuan?status=menunggu'); } catch { /* panel tetap tampil tanpa kartu */ }
    if (!el.setuju) return;
    el.setuju.classList.toggle('hide', !daftar.length);
    if (!daftar.length) return el.setuju.replaceChildren();
    const p = daftar[0], putus = (aksi, pesan) => guard(async () => { await api(`/api/persetujuan/${p.id}/${aksi}`, { method: 'POST' }); toast(pesan); muatPersetujuan(); refreshDashboard().catch(() => {}); });
    el.setuju.replaceChildren(
      h('div', { class: 'row between' }, h('b', {}, `${nameOf(p.oleh)} minta izin kirim pesan`), daftar.length > 1 ? h('span', { class: 'chip warn' }, `+${daftar.length - 1} lagi`) : null),
      h('div', { class: 'kutip' }, p.teks.length > 220 ? p.teks.slice(0, 220) + '…' : p.teks),
      h('div', { class: 'row' },
        h('button', { class: 'btn small primary need-staf', disabled: state.me && state.me.telegram ? false : 'disabled', title: state.me && state.me.telegram ? '' : 'Telegram belum diatur', onclick: putus('setuju', 'Terkirim ke Telegram') }, 'Setujui & kirim'),
        h('button', { class: 'btn small need-staf', onclick: putus('tolak', 'Ditolak, tidak dikirim') }, 'Nanti dulu'),
        h('button', { class: 'btn small', onclick: () => showTab('tugas') }, 'Lihat semua')));
  }

  /* ---------- agen per ruangan ---------- */
  function kelompok() {
    const peta = new Map(); // id ruangan -> agen
    for (const a of state.agents) {
      const r = typeof Iso !== 'undefined' ? Iso.ruangAgen(a.id) : null, k = r ? r.id : '_lain';
      if (!peta.has(k)) peta.set(k, []); peta.get(k).push(a);
    }
    return Pathing.ROOMS.filter((r) => peta.has(r.id)).map((r) => ({ id: r.id, nama: r.nama, agen: peta.get(r.id) })).concat(peta.has('_lain') ? [{ id: null, nama: 'Lainnya', agen: peta.get('_lain') }] : []);
  }
  function renderAgen() {
    if (!el.agen) return;
    const lapor = (state.dash && state.dash.agenLapor) || {};
    el.agen.replaceChildren(...kelompok().map((g) => h('div', { class: 'grup' + (g.id && g.id === fokus ? ' on' : '') },
      h('button', { class: 'grup-h', type: 'button', onclick: () => g.id && Office.focusRoom(fokus === g.id ? null : g.id), title: g.id ? 'Fokuskan kamera ke ' + g.nama : '' }, h('span', {}, g.nama), h('span', { class: 'muted' }, `${g.agen.length} agen`)),
      ...g.agen.map((a) => {
        const teks = a.status === 'idle' ? (lapor[a.id] || a.ringkas || 'Menunggu pekerjaan') : a.tugas || (a.status === 'working' ? 'Bekerja…' : 'Selesai');
        return h('div', { class: 'ag', role: 'button', tabindex: '0', title: `Klik untuk bertanya kepada ${a.nama}. ${a.ringkas || ''}`,
          onclick: () => { pilihAgen(a); setTanyaMode('tanya'); showTab('tanya'); }, onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); } },
          h('span', { class: 'av', style: `background:${warnaAgen(a.id)}` }, a.kode || a.nama.slice(0, 2).toUpperCase()),
          h('div', { class: 'ag-t' }, h('b', {}, a.nama), h('div', { class: 'muted' }, a.ringkas || '')),
          h('div', { class: 'ag-s' }, h('span', { class: 'dot ' + a.status }), h('span', { class: 'muted ag-st' }, teks)));
      }))));
  }

  function bangun() {
    el = { setuju: $('#panelSetuju'), brief: $('#panelBrief'), agen: $('#agentList') };
    el.modes = h('div', { class: 'seg modes' }, Object.entries(MODE).map(([k, m]) => h('button', { type: 'button', 'data-mode': k, onclick: () => setMode(k) }, m.label)));
    el.teks = h('textarea', { rows: 3, maxlength: 2000, 'aria-label': 'Brief baru' }); el.teks.addEventListener('input', cekTombol);
    el.ket = h('div', { class: 'muted' }); el.biaya = h('div', { class: 'biaya' });
    el.mulai = h('button', { class: 'btn primary', type: 'button', onclick: mulai }, 'Mulai');
    el.brief.replaceChildren(h('div', { class: 'row between' }, h('h3', {}, 'Brief baru'), el.modes), el.teks, el.ket, el.biaya, h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Agen tak memakai token saat idle.'), el.mulai));
    setMode('rapat'); muatBiaya(); muatPersetujuan();
    Office.onFocus((id) => { fokus = id; renderAgen(); });
  }
  return { bangun, muatBiaya, muatPersetujuan, renderAgen };
})();
