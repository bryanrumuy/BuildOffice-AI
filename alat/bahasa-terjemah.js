'use strict';
/**
 * Menerjemahkan satuan teks (alat/bahasa-satuan.json) Indonesia -> Inggris memakai penyedia AI yang sama dengan aplikasi, ke lib/i18n/en.json.
 * Bisa dilanjutkan (satuan yang sudah ada dilewati). Pakai: node alat/bahasa-terjemah.js [jumlah paralel]
 * Hasil diperiksa otomatis: penampung {#n} harus sama, kunci JSON/pengenal bertanda kutip harus tetap, perintah /xxx tetap.
 */
const fs = require('fs'), path = require('path');
const ai = require('../lib/ai');
const SATUAN = require('./bahasa-satuan.json');
const OUT = path.join(__dirname, '..', 'lib', 'i18n', 'en.json'), GAGAL = path.join(__dirname, 'bahasa-gagal.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
let kamus = {}; try { kamus = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* mulai baru */ }
const gagal = {};

const SISTEM = `You translate user-interface text, error messages, document labels, and AI system prompts of an Indonesian "virtual office" web app (AI agents helping a construction contractor with documents, bills, cash, projects, tasks, reports) into clear, natural, concise English.
INPUT: a JSON object {"id": "indonesian text"}. OUTPUT: ONLY a JSON object {"id": "english text"} with exactly the same ids. No markdown, no commentary.
HARD RULES
1. Keep every placeholder like {#0}, {#1} exactly as written (you may reorder them for natural English). Never add or drop placeholders.
2. Keep EXACTLY as written (do not translate): JSON keys and enum values in quotes or backticks (e.g. "jenis", "judul", "nilai_angka", "progres_fisik", "arah_uang", "tagih", "bayar", "masuk", "keluar", "agen:<id>", "manusia:<name>", "todo", "doing", "review", "done", "blocked", "selesai", "terblokir", "telegram"), slash commands (/tugas, /rapat, /setuju ...), ids, file names, URLs, code, emoji, numbers, "Rp", and product/brand names. In a prompt that asks for a JSON reply, the key names stay in Indonesian; only the instructions around them are English.
3. Keep line breaks, leading/trailing spaces, punctuation style, and list formatting. Keep the same tone (informal first-person "aku" of AI agents becomes natural first person "I").
4. If the text is not natural language (font name, protocol or HTTP token, user-agent, CSS), return it unchanged.
5. Where a prompt tells an AI to write in Indonesian (bahasa Indonesia), say English instead.
6. Month and weekday names and abbreviations become English (Januari->January, Agu->Aug, Senin->Monday ...). Rupiah amounts and date formats are not your concern.
GLOSSARY (use consistently): Kantor=Office; Beranda=Home; Pengaturan=Settings; Dokumen=Documents/Document; Keuangan=Finance; Proyek=Projects/Project; Tugas=Tasks/Task; Papan Tugas=Task Board; Laporan=Reports/Report; Tanya & Perintah=Ask & Command; Perintah=Command; Brief baru=New brief; Rapat=Meeting; Notulen=Minutes; Keputusan=Decisions; Tindak lanjut=Follow-up; Jadikan tugas=Make task; Pengingat=Reminder; tagihan=bill (payable) / receivable when it is owed to us; Tagihan terbuka=Open bills; Piutang=Receivables; Hutang=Payables; kas=cash; Buku kas=Cash book; draf/draft=draft; terverifikasi=verified; belum diverifikasi=unverified; Verifikasi=Verify; lunas=paid; Lunasi=Mark paid; jatuh tempo=due (date); terlambat=overdue; termin=payment term; uang muka=down payment; retensi=retention; jaminan=guarantee; progres fisik=physical progress; rencana=plan; anggaran biaya=cost budget; realisasi biaya=actual cost; pemilik=owner; pihak=party; kategori=category; Persetujuan=Approval; Kotak Persetujuan=Approval Box; Agen=Agent; Panggil rapat=Call meeting; Mulai rapat=Start meeting; Ruang Rapat=Meeting Room; Beranda kantor=Office home.
Agent names: Resepsionis=Receptionist; Pembaca Dokumen=Document Reader; Petugas Arsip=Archivist; Bendahara=Treasurer; Pengingat Jadwal=Schedule Reminder; Manajer Proyek=Project Manager; Asisten Harian=Daily Assistant; Penyusun Laporan=Report Writer; Penjaga Sistem=System Guardian; Staf Serbaguna=General Staff.
Room names: Ruang Baca=Reading Room; Arsip=Archive; Keuangan=Finance; Ruang Manajer=Manager Room; Pengingat=Reminders; Lobi=Lobby; Pelapor=Reporting; Pantry & Makan=Pantry & Dining; Ruang Santai=Lounge; Ruang Server=Server Room; Ruang Rapat=Meeting Room; Perpustakaan=Library; Gudang Arsip=Archive Storage; Taman Belakang=Back Garden.`;

const tokenKutip = (s) => (s.match(/["`][a-z_]+(?::<?[a-z_]+>?)?["`]/g) || []).map((x) => x.slice(1, -1)).filter((x, i, a) => a.indexOf(x) === i);
const perintah = (s) => (s.match(/(?:^|\s)(\/[a-z]{3,})/g) || []).map((x) => x.trim());
const penampung = (s) => (s.match(/\{#\d+\}/g) || []).sort().join('');
function periksa(src, tj) {
  if (typeof tj !== 'string') return 'bukan teks';
  if (penampung(src) !== penampung(tj)) return 'penampung berbeda';
  for (const t of tokenKutip(src)) if (!tj.includes(t)) return 'kunci hilang: ' + t;
  for (const c of perintah(src)) if (!tj.includes(c)) return 'perintah hilang: ' + c;
  if (src.length > 40 && tj.length > src.length * 4) return 'terlalu panjang';
  if (/^\s/.test(src) !== /^\s/.test(tj) || /\s$/.test(src) !== /\s$/.test(tj)) return 'spasi tepi berbeda';
  return null;
}
const jsonDari = (teks) => { const t = String(teks || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)); };

async function terjemah(pasang) {
  const masuk = Object.fromEntries(pasang.map(([id, teks]) => [id, teks]));
  const raw = await ai.callAI({ system: SISTEM, blocks: [{ kind: 'text', text: JSON.stringify(masuk) }], maxTokens: 16000 });
  return jsonDari(raw);
}

(async () => {
  const kunci = Object.keys(SATUAN).filter((k) => !(k in kamus));
  console.log('belum diterjemahkan:', kunci.length, 'dari', Object.keys(SATUAN).length);
  const batch = []; let cur = [], chars = 0;
  for (const k of kunci.sort((a, b) => a.length - b.length)) { if (cur.length && (cur.length >= 35 || chars + k.length > 7000)) { batch.push(cur); cur = []; chars = 0; } cur.push(k); chars += k.length; }
  if (cur.length) batch.push(cur);
  let selesai = 0, paralel = Number(process.argv[2] || 4), idx = 0;
  async function kerja() {
    while (idx < batch.length) {
      const nomor = idx++, isi = batch[nomor].map((k, i) => ['t' + i, k]);
      let hasil;
      try { hasil = await terjemah(isi); } catch (e) { try { hasil = await terjemah(isi); } catch (e2) { console.log('batch', nomor, 'gagal:', String(e2.message).slice(0, 120)); batch[nomor].forEach((k) => { gagal[k] = { alasan: 'batch gagal' }; }); continue; } }
      for (const [id, k] of isi) {
        let tj = hasil[id], err = periksa(k, tj);
        if (err) { try { const ulang = await terjemah([['t0', k]]); tj = ulang.t0; err = periksa(k, tj); } catch { /* tetap gagal */ } }
        if (err) gagal[k] = { alasan: err, tj }; else kamus[k] = tj;
      }
      selesai++;
      fs.writeFileSync(OUT, JSON.stringify(kamus, null, 1)); fs.writeFileSync(GAGAL, JSON.stringify(gagal, null, 1));
      console.log('batch', selesai + '/' + batch.length, 'kamus', Object.keys(kamus).length, 'gagal', Object.keys(gagal).length);
    }
  }
  await Promise.all(Array.from({ length: paralel }, kerja));
  console.log('selesai. kamus', Object.keys(kamus).length, 'gagal', Object.keys(gagal).length);
})().catch((e) => { console.error('GALAT', e.stack || e.message); process.exit(1); });
