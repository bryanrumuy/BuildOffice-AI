'use strict';
/** Mode Perintah (tab Tanya & Perintah): perintah bebas ke agen serbaguna yang memakai alat (baca data, buat tugas, catat kas draft, buat berkas). Pesan keluar tetap menunggu persetujuan. */
const MAX_LAMPIRAN = 3;
const TEMPLATES = [
  ['Buat file Excel', 'Buat file Excel (xlsx) berisi daftar semua tagihan yang belum lunas: keterangan, pihak, tanggal, jumlah, arah. Urutkan dari yang paling dekat jatuh tempo dan beri total di baris terakhir.'],
  ['Catat nota ke kas', 'Baca dokumen terlampir (nota atau kwitansi) lalu catat transaksinya ke buku kas sebagai draft, dengan kategori yang paling sesuai.'],
  ['Rencana kerja + tugas', 'Susun rencana kerja untuk: [tulis pekerjaannya]. Buat tugas-tugas di Papan Tugas lengkap dengan penanggung jawab dan tenggat yang masuk akal.'],
  ['Laporan Word', 'Buat laporan Word (docx) ringkasan kondisi kantor bulan ini untuk pemilik: kas, tagihan yang harus dibayar atau diterima, proyek, dan keputusan yang dibutuhkan.'],
  ['Analisis risiko', 'Analisis dokumen terlampir: apa risiko terbesarnya, apa penyebabnya, dan beri 3 rekomendasi tindakan yang konkret beserta tenggatnya.'],
  ['Draf surat teguran', 'Buatkan draf surat teguran resmi kepada pihak terkait atas kewajiban atau tenggat yang belum dipenuhi, berdasarkan dokumen terlampir. Sertakan nomor dan tanggal dokumen rujukan.'],
  ['Draf perpanjangan izin', 'Buatkan draf surat permohonan perpanjangan izin berdasarkan dokumen terlampir. Sertakan data yang tersedia dan beri tanda [ISI] pada data yang belum ada.'],
  ['Ringkasan untuk pemilik', 'Tulis ringkasan satu halaman untuk pemilik usaha: kondisi terkini, uang yang harus dibayar atau diterima dalam 30 hari, dan keputusan yang dibutuhkan darinya.'],
  ['Bandingkan dokumen', 'Bandingkan dokumen terlampir: apa yang sama, apa yang berbeda, dan adakah angka atau tanggal yang saling bertentangan.'],
  ['Cek kejanggalan', 'Periksa dokumen terlampir beserta data kantor: adakah angka, tanggal, atau tagihan yang janggal, ganda, atau tidak konsisten? Sebutkan buktinya.'],
  ['Pesan WhatsApp', 'Tulis pesan WhatsApp singkat dan sopan untuk mengingatkan pihak terkait tentang pembayaran atau tenggat pada dokumen terlampir.'],
];
const agenState = { docs: [], pilih: new Set(), teks: '', konteks: false, busy: false, agen: 'pelaksana', daftarAgen: [] };
const clipText = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

async function loadAgen() {
  const [docs, hasil, agen] = await Promise.all([api('/api/docs'), api('/api/hasil'), api('/api/agen')]);
  agenState.daftarAgen = agen.filter((a) => a.bisaDitugasi);
  agenState.docs = docs.filter((d) => d.data);
  agenState.pilih = new Set([...agenState.pilih].filter((id) => agenState.docs.some((d) => d.id === id)));
  renderAgen(hasil);
}

async function jalankanPerintah() {
  const teks = agenState.teks.trim();
  if (!teks) return toast('Tulis perintahnya dulu.', 'bad');
  agenState.busy = true; renderBusy();
  try {
    await api('/api/perintah', { method: 'POST', body: { instruksi: teks, docIds: [...agenState.pilih], konteks: agenState.konteks, agen: agenState.agen } });
    toast('Selesai. Hasilnya ada di bawah.'); refreshDashboard();
  } catch (e) { toast(errText(e), 'bad'); }
  agenState.busy = false; loadAgen();
}
function renderBusy() {
  const b = $('#agenRun'), s = $('#agenStatus'); if (!b) return;
  b.disabled = agenState.busy; b.textContent = agenState.busy ? 'Agen sedang bekerja…' : 'Jalankan';
  s.textContent = agenState.busy ? 'Membaca dokumen dan menulis hasil. Biasanya 10–40 detik; jangan tutup halaman ini.' : '';
}

function lampiranList() {
  const full = agenState.pilih.size >= MAX_LAMPIRAN;
  if (!agenState.docs.length) return h('div', { class: 'muted' }, 'Belum ada dokumen yang bisa dilampirkan. Unggah dulu di tab Dokumen.');
  return h('div', { class: 'picklist', role: 'group', 'aria-label': 'Dokumen terlampir' }, agenState.docs.map((d) => {
    const cb = h('input', { type: 'checkbox', id: 'pk' + d.id, onchange: (e) => { if (e.target.checked) agenState.pilih.add(d.id); else agenState.pilih.delete(d.id); loadAgenLight(); } });
    cb.checked = agenState.pilih.has(d.id); cb.disabled = full && !cb.checked;
    return h('label', { class: 'pick', for: 'pk' + d.id }, cb, h('span', {}, d.data.judul, h('span', { class: 'muted' }, ` · ${d.data.jenis} · ${d.originalName}`)));
  }));
}
let lastHasil = [];
function loadAgenLight() { renderAgen(lastHasil); }

function renderAgen(hasil) {
  lastHasil = hasil;
  const box = $('#agenBody'); box.replaceChildren();
  const demo = state.me.mode !== 'ai';
  const ta = h('textarea', { rows: '4', maxlength: '6000', placeholder: 'Tulis perintah dengan bahasa biasa. Contoh: "Buat draf surat teguran ke CV Karya Bersama soal keterlambatan pengiriman, pakai dokumen terlampir."', 'aria-label': 'Perintah untuk agen', value: agenState.teks, oninput: (e) => { agenState.teks = e.target.value; } });
  const kons = h('input', { type: 'checkbox', id: 'agenKonteks', onchange: (e) => { agenState.konteks = e.target.checked; } }); kons.checked = agenState.konteks;
  box.append(...[
    demo ? h('div', { class: 'card' }, h('span', { class: 'chip warn' }, 'Butuh mode AI'), ' Fitur ini memakai AI. Jalankan ulang lewat start.bat dan isi kunci API supaya bisa dipakai.') : null,
    h('div', { class: 'card' },
      h('h3', {}, 'Minta agen mengerjakan sesuatu'),
      h('div', { class: 'chips' }, TEMPLATES.map(([label, isi]) => h('button', { class: 'chip', type: 'button', onclick: () => { agenState.teks = isi; ta.value = isi; ta.focus(); } }, label))),
      h('div', { style: 'margin-top:10px' }, ta),
      h('label', { class: 'f', style: 'margin-top:10px;max-width:340px' }, 'Dikerjakan oleh (sesuai pos)', h('select', { 'aria-label': 'Agen yang mengerjakan', value: agenState.agen, onchange: (e) => { agenState.agen = e.target.value; } }, agenState.daftarAgen.map((a) => h('option', { value: a.id }, `${a.nama} — ${a.ringkas}`)))),
      h('div', { class: 'muted', style: 'margin:10px 0 4px' }, `Lampirkan dokumen bila perlu (maksimal ${MAX_LAMPIRAN}). AI membaca file aslinya. Agen juga bisa mencari dan membaca dokumen lain sendiri.`),
      lampiranList(),
      h('div', { class: 'row', style: 'margin-top:10px' }, kons, h('label', { for: 'agenKonteks', class: 'muted' }, 'Beri agen ringkasan data kantor di awal (matikan untuk menghemat token; agen tetap bisa membaca datanya sendiri)')),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn primary need-staf', id: 'agenRun', disabled: demo ? 'disabled' : false, onclick: jalankanPerintah }, 'Jalankan'), h('span', { class: 'muted', id: 'agenStatus', role: 'status' })),
      h('div', { class: 'muted', style: 'margin-top:8px' }, 'Agen bisa membaca data kantor, membuat tugas, mencatat kas sebagai DRAFT (belum masuk laporan sampai kamu verifikasi), menghitung, dan membuat berkas Word/Excel/PDF. Ia tidak bisa membayar, melunasi, menghapus, atau mengirim pesan langsung: pesan hanya diusulkan ke Kotak Persetujuan. Periksa hasilnya sebelum dipakai.')),
    h('div', { id: 'berkasList' }),
    h('h3', { style: 'margin:6px 0 0' }, 'Hasil sebelumnya'),
    ...(hasil.length ? hasil.map(hasilCard) : [h('div', { class: 'empty' }, 'Belum ada hasil. Coba salah satu contoh perintah di atas.')]),
  ].filter(Boolean));
  renderBusy(); loadBerkas().catch(() => {});
}

/** Daftar berkas buatan agen (unduh; admin boleh menghapus). */
async function loadBerkas() {
  const box = $('#berkasList'); if (!box) return;
  const l = await api('/api/berkas');
  box.replaceChildren(...(l.length ? [h('div', { class: 'card' }, h('h3', {}, 'Berkas buatan agen'), l.slice(0, 8).map((b) => berkasBaris(b)))] : []));
}
function berkasBaris(b) {
  const hapus = guard(async () => { if (confirm('Hapus berkas "' + b.nama + '"?')) { await api('/api/berkas/' + b.id, { method: 'DELETE' }); loadBerkas(); } });
  return h('div', { class: 'agent-row' }, h('span', { class: 'chip' }, b.format.toUpperCase()), h('div', { style: 'flex:1;min-width:0' }, h('a', { href: '/api/berkas/' + b.id + '/unduh' }, b.nama), h('div', { class: 'muted' }, Math.max(1, Math.round(b.ukuran / 1024)) + ' KB · ' + (b.oleh || '') + ' · ' + new Date(b.t).toLocaleString('id-ID'))), h('button', { class: 'btn small danger need-admin', onclick: hapus }, 'Hapus'));
}
/** Langkah yang dikerjakan agen lewat alat (centang = berhasil, silang = ditolak/gagal). */
const langkahList = (l) => (l && l.length ? h('details', { class: 'langkah' }, h('summary', {}, 'Yang dikerjakan agen (' + l.length + ' langkah)'), l.map((x) => h('div', { class: x.ok ? 'ok' : 'bad' }, (x.ok ? '✓ ' : '✗ ') + x.ringkas))) : null);

function hasilCard(r) {
  const salin = async () => { try { await navigator.clipboard.writeText(Md.plain(r.hasil)); toast('Disalin'); } catch { toast('Gagal menyalin. Blok teksnya lalu salin manual.', 'bad'); } };
  const hapus = guard(async () => { if (confirm('Hapus hasil ini?')) { await api('/api/hasil/' + r.id, { method: 'DELETE' }); loadAgen(); } });
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, clipText(r.instruksi, 140)), h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: salin }, 'Salin'), h('a', { class: 'btn small', href: `/api/hasil/${r.id}.txt` }, 'Unduh .txt'), h('button', { class: 'btn small danger need-admin', onclick: hapus }, 'Hapus'))),
    h('div', { class: 'muted' }, `${r.docs.length ? 'Dokumen: ' + r.docs.map((d) => d.nama).join(', ') + ' · ' : 'Tanpa dokumen · '}${r.oleh} · ${new Date(r.t).toLocaleString('id-ID')} · ${r.agen ? r.agen + ' · ' : ''}${r.model}`),
    h('div', { class: 'md' }, Md.dom(r.hasil, h)), langkahList(r.langkah), r.berkas && r.berkas.length ? h('div', { class: 'row', style: 'margin-top:8px' }, r.berkas.map((b) => h('a', { class: 'btn small', href: '/api/berkas/' + b.id + '/unduh' }, '⬇ ' + b.nama))) : null);
}
