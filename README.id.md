# Kantor AI

Kantor virtual untuk administrasi keluarga: agen AI mengurus dokumen, keuangan, pengingat, laporan, dan **pekerjaan apa pun** yang kamu minta lewat Papan Tugas.
Orang kantor cukup mengunggah foto/PDF atau menulis instruksi; agen membaca, mencatat, mengerjakan, dan mengingatkan. **Manusia tetap memverifikasi** semua angka dan tanggal, dan menyetujui setiap pesan keluar.

## Cara kantor ini berjalan (ringkas)

Bayangkan kantor dengan satu staf serbaguna yang bisa diperintah lewat web atau Telegram, ditambah beberapa petugas tetap yang mengurus rutinitas.

**1. Data masuk.** Kamu mengunggah dokumen (PDF, foto, teks) di tab **Dokumen**, atau mencatat kas/tagihan/progres proyek manual. Petugas alur dokumen (Resepsionis → Pembaca Dokumen → Petugas Arsip → Bendahara → Pengingat Jadwal) membaca isinya dengan AI, menyimpannya sebagai **draft**, dan mencatat kas/tagihan. **Kamu memverifikasi** sebelum angkanya masuk laporan.

**2. Data tersimpan di komputer ini**, folder `data` (file JSON dan `uploads`). Tidak ada database luar. Yang dikirim ke penyedia AI hanya isi dokumen/data yang relevan pada saat agen bekerja. Penjaga Sistem membuat backup tiap 24 jam ke `data\backup`.

**3. Kamu memberi perintah** dengan tiga cara, semuanya bidang apa pun:
- **Perintah bebas** (tab *Tanya & Perintah* → *Perintah dengan dokumen*, atau teks biasa di Telegram): agen serbaguna langsung mengerjakan, memakai alat di bawah.
- **Instruksi besar** (tab *Tugas*): Manajer Proyek memecahnya jadi tugas kecil di Papan Tugas dengan penanggung jawab dan tenggat. Tombol **Kerjakan semua tugas agen** menjalankan tugas agen berurutan sesuai syaratnya.
- **Manual**: kamu atau stafmu membuat dan memindahkan tugas sendiri.

**4. Alat yang dipakai agen** (inilah "apa saja yang bisa mereka lakukan"):

| Alat | Boleh? |
|---|---|
| Membaca dokumen, kas, tagihan, proyek, tugas | Ya, bebas |
| Menghitung (aritmetika teliti, tanpa eval) | Ya |
| Membuat dan mengubah tugas | Ya (menandai *selesai* hanya manusia) |
| Mencatat kas | Hanya **draft** (belum masuk laporan sebelum kamu verifikasi) |
| Membuat berkas Word (docx), Excel (xlsx), CSV, PDF, HTML, teks | Ya, bisa diunduh |
| Mengusulkan pesan Telegram | Hanya **usulan**; terkirim setelah kamu setujui |
| Membuka halaman web publik | Hanya bila `AGEN_WEB=1` (risiko: halaman jahat bisa mencoba menyuruh agen membocorkan data; alamat lokal/pribadi selalu diblokir) |
| Membayar, melunasi tagihan, menghapus data, mengirim pesan langsung, email, WhatsApp, mengubah kode | **Tidak bisa** |

Jadi "apa saja" berlaku untuk pekerjaan pengetahuan: menulis, menganalisis, menghitung, menyusun rencana, membuat dokumen/spreadsheet, merapikan data kantor. Hal yang menyentuh dunia luar atau uang tetap dikerjakan manusia.

**Bertanya langsung ke agen.** Di tab *Tanya & Perintah* → *Tanya cepat*, pilih satu agen (atau klik namanya di daftar agen di Beranda) lalu tanya, mis. kepada Bendahara "berapa kas bulan ini?" atau kepada Penjaga Sistem "server aman?". Tiap agen menjawab sebagai dirinya (peran dan sifatnya sendiri), memakai data bidangnya dan alat **baca saja**: percakapan ini tidak pernah mengubah data (untuk mengubah, pakai Perintah). Jawabannya juga tampil sebagai balon ucapan di kantor dan di obrolan. Di Telegram: `/tanya bendahara berapa kas bulan ini?` atau tulis "Bendahara, berapa kas bulan ini?"; `/server` menampilkan kesehatan dan keamanan sistem seketika (tanpa AI). Tanpa mode AI, agen menjawab dari data bidangnya dengan kalimat sederhana. Agen juga aktif sendiri: Asisten Harian menyapa saat kantor dibuka, agen bereaksi saat kamu memverifikasi dokumen/kas, melunasi tagihan, atau menyelesaikan tugas, dan saling mengobrol dari data nyata.

**Ketepatan dan tampilan hasil.** Agen diminta membaca isi asli dokumen sebelum merangkum (alat `baca_isi_dokumen`, memakai sedikit token), mencari dokumen menurut tanggal unggah ("hari ini"), menghitung dengan alat hitung, dan menyebut dokumen sumber. Di tab Perintah kamu bisa memilih **agen yang mengerjakan** (Staf Serbaguna, Penyusun Laporan, Asisten Harian) sesuai posnya. Tulisan agen berformat Markdown sederhana dan diterjemahkan dengan benar: di web jadi judul/daftar/tabel, di Telegram jadi teks rapi tanpa tanda bintang, di PDF/Word/HTML jadi dokumen berdesain (kop berwarna, tabel berkepala warna, angka rata kanan, nomor halaman; dokumen panjang diberi halaman sampul). Untuk agen berlangkah banyak, model gpt-6* diberi penalaran ringan (`OPENAI_AGENT_REASONING=low`, bawaan; isi `""` untuk mematikan; otomatis dimatikan bila model menolaknya). Perintah dari web tidak lagi menyertakan ringkasan data kantor secara otomatis (hemat token): agen mengambil sendiri data yang ia perlukan.

**5. Telegram sebagai remote control.** Isi token bot dan chat ID di `start.bat`; bot menarik pesanmu sendiri (tanpa alamat publik). Tulis apa saja ke bot dan agen mengerjakannya; hasil dan berkas dikirim balik. Perintah: `/tugas`, `/tugasbaru`, `/kerjakan <no>`, `/kerjakansemua`, `/selesai <no>`, `/persetujuan`, `/setuju <no>`, `/tolak <no>`, `/status`, `/standup`, `/laporan`, `/berkas`, `/baru`, `/bantuan`. Agen mengingat 4 perintah terakhir selama 6 jam (perintah, hasil, dan berkas yang dibuat) supaya "buat ulang" atau "jadikan PDF" menyambung ke pekerjaan sebelumnya; `/baru` melupakannya. Perintah yang menyebut PDF/Word/Excel/CSV mewajibkan agen membuat berkasnya. Pengaman: hanya chat yang cocok dengan `TELEGRAM_CHAT_ID` yang dilayani (di grup, hanya pengguna di `TELEGRAM_USER_IDS`, daftar ID dipisah koma); pesan lain diabaikan dan dicatat di log; pesan lebih dari 10 menit diabaikan; tidak ada perintah untuk menghapus data atau mengubah pengaturan. `TELEGRAM_PERINTAH=0` mematikan penerimaan perintah (notifikasi tetap jalan). **Jangan menempel token bot di chat atau file**; bila sudah terlihat orang lain, buat ulang lewat @BotFather (`/revoke`).

**6. Rutinitas otomatis** (tanpa perintah): standup pagi dan laporan mingguan ke Telegram (`DIGEST_HOUR`, `LAPORAN_HARI`), Penjaga Sistem memeriksa server/backup/dokumen gagal tiap `PENJAGA_MENIT`, pengingat jatuh tempo.

**Mana yang AI, mana yang kode biasa?** AI (memakai token): Pembaca Dokumen (ekstraksi), Manajer Proyek (rencana), Staf Serbaguna dan agen kustom (perintah, tugas), Tanya cepat. Kode biasa tanpa token: Resepsionis, Petugas Arsip, Bendahara, Pengingat Jadwal, Asisten Harian (standup), Penyusun Laporan (laporan mingguan), Penjaga Sistem.

## Cara kerja

Nama agen memakai jabatan kantor sehari-hari; arahkan kursor ke nama di kantor pixel untuk melihat tugasnya.

| Agen | Tugas |
|---|---|
| Resepsionis | Menerima file yang diunggah |
| Pembaca Dokumen | Membaca dokumen (AI) → jenis, nomor, tanggal, nilai, pihak, jadwal/termin, ketentuan penting |
| Petugas Arsip | Menyimpan hasilnya (belum diverifikasi) dan menjawab pertanyaan di "Tanya & Perintah" |
| Bendahara | Nota/kwitansi → transaksi **buku kas** (draft); invoice dan jadwal termin kontrak → **tagihan** |
| Pengingat Jadwal | Memantau jatuh tempo dokumen dan tagihan |
| Penyusun Laporan | Menyusun ringkasan harian dan laporan mingguan, mengirimnya ke Telegram |

Agen **idle** (tidak memakai token) kalau tidak ada kerjaan.

## Tim agen: Papan Tugas, Manajer, dan kawan-kawan

Peran agen bersifat **serbaguna**: tidak terikat satu bidang (kontraktor, acara keluarga, izin usaha, renovasi rumah, dan seterusnya). Manajer tidak berasumsi bidangnya; bila instruksi kabur, ia **bertanya** dan tidak membuat tugas.

| Agen | Tugas |
|---|---|
| Manajer Proyek | Instruksi besar (tab **Tugas**) → tugas kecil dengan penanggung jawab (agen atau manusia), tenggat, dan urutan ketergantungan di **Papan Tugas**. Tugas terlambat muncul di Beranda, standup, dan pengingat. |
| Staf Serbaguna | Mengerjakan tugas tertulis (draf surat/pesan, analisis, ringkasan, daftar periksa). Memakai alat (lihat tabel di atas). Hasil masuk ke kolom **Perlu dicek**, lengkap dengan daftar langkah yang dikerjakan dan berkas hasilnya; ia melapor **Terblokir** bila datanya kurang. |
| Asisten Harian | Standup pagi lewat Telegram: sapaan, apa yang jatuh tempo, siapa memegang tugas apa, apa yang menunggu keputusan. Tanpa analisis kehadiran manusia. |
| Penyusun Laporan | Laporan mingguan (progres proyek, kas, tagihan, tugas) sebagai file **PDF** (butuh Edge/Chrome di komputer ini) atau HTML, dikirim ke Telegram. |
| Penjaga Sistem | Memantau server, disk, dokumen gagal/macet, batas token, umur backup. Perbaikan **aman**: mengulang dokumen gagal karena gangguan sementara (maks 2×), backup otomatis tiap 24 jam (`data\backup`, 7 salinan terakhir, tanpa rahasia), peringatan Telegram. **Tidak pernah mengubah kode.** Restart otomatis bila server mati: jalankan lewat `start.bat`. |

- **Agen kustom**: admin menambah agen sendiri (mis. "Agen Penagih") dengan nama dan peran bahasa biasa, tanpa kode (tab Tugas → Agen). Agen bawaan boleh diubah perannya, tidak bisa dihapus.
- **Kotak Persetujuan**: agen hanya **mengusulkan** pesan Telegram. Pesan baru terkirim setelah staf/admin menyetujui; bila pengiriman gagal, usulan tetap menunggu. Agen tidak membayar, tidak mengubah data keuangan.
- Satu pekerjaan agen pada satu waktu, memakai token sesuai ukuran dokumen terlampir, ikut batas token bulanan. Semua tindakan tercatat di log audit.
- Mode demo: Papan Tugas manual, standup, laporan mingguan, dan Penjaga tetap jalan; Manajer dan Pelaksana butuh mode AI.
- Agen berjalan **saat tombol ditekan** (hemat token). Jadwal otomatis opsional: `DIGEST_HOUR` (standup harian) dan `LAPORAN_HARI` (laporan mingguan); Penjaga memeriksa tiap `PENJAGA_MENIT` (bawaan 10).

## Kantor pixel yang hidup

Beranda menampilkan kantor dengan **14 ruangan**: Ruang Baca, Arsip, Keuangan, Ruang Manajer, Ruang Server, Pengingat, Lobi, Pelapor, Pantry & Makan, Ruang Santai, **Ruang Rapat** (meja panjang dengan sepuluh tempat berdiri), Perpustakaan, Gudang Arsip, dan Taman Belakang (kolam, bangku, pepohonan). Sepuluh agen bawaan punya avatar dan meja sendiri (rambut, baju, aksesori berbeda): Manajer Proyek di Ruang Manajer, Asisten Harian di Lobi, Penjaga Sistem di Ruang Server, Staf Serbaguna di Pelapor. Mereka berjalan, mengobrol, dan berkeliaran seperti yang lain, dan ucapannya memakai data nyata (tugas terlambat, hasil menunggu dicek, backup, token).

- **Bekerja:** agen yang sedang memproses dokumen duduk di mejanya dan mengetik; kertas berpindah antar meja mengikuti alur kerja.
- **Berjalan:** agen menghindari dinding dan perabot (pencari jalan A*), bangkit dari kursi, menyusuri pintu antar ruangan.
- **Mengobrol:** saat dokumen diproses, agen saling menyerahkan pekerjaan dengan ucapan yang memuat data nyata ("Ini invoice …, nilainya Rp …"). Agen yang menganggur menghampiri meja rekan untuk bicara. Riwayat ada di kartu "Obrolan kantor". Ada juga percakapan beberapa giliran dengan angka nyata, mis. Penyusun Laporan menanyakan kas ke Bendahara lalu progres tugas ke Manajer Proyek; Manajer Proyek menitipkan tugas terlambat ke Asisten Harian; Penjaga Sistem memberi tahu Pembaca Dokumen soal dokumen gagal. Instruksi baru, tugas selesai, dan backup juga memicu serah-terima lisan antar agen.
- **Berpikir sendiri:** tiap ±25 detik (selama ada yang membuka halaman; atur dengan `AGENT_CHAT_SECONDS`) satu agen berinisiatif bicara berdasarkan kondisi nyata kantor: tagihan terlambat, dokumen belum diverifikasi, dokumen gagal dibaca, dan seterusnya. Isinya dibuat dari data, **tanpa token**.
- - Gerak ini murni tampilan di browser. Pengguna yang memilih "kurangi gerakan" di sistem operasinya tidak melihat agen berjalan (hanya balon ucapan).

### Panggil rapat

Tombol **Panggil rapat** di Beranda (staf/admin), perintah Telegram `/rapat [agenda]`, atau kalimat biasa seperti "panggil rapat" memanggil semua agen ke **Ruang Rapat**. Mereka berjalan ke meja panjang, lalu tiap agen melapor **dari datanya sendiri** (dokumen, kas, tugas, kesehatan sistem, dan seterusnya) dengan Manajer membuka dan menutup. Naskah disusun AI (butuh mode AI; tanpa AI dipakai naskah standar dari data), dirapikan dan **diperiksa angkanya**: ucapan yang memuat angka yang tidak ada di data diganti laporan berbasis data, dan jumlah yang diganti dicatat. Hasilnya disimpan sebagai **notulen** (`data\rapat.json`, 20 terakhir) dengan ringkasan, keputusan, dan **tindak lanjut** yang bisa dijadikan tugas di Papan Tugas dengan satu klik (tidak otomatis). Setelah semua ucapan selesai, agen kembali ke mejanya.

### Pemeriksa angka

`lib/angka.js` menandai angka penting (≥ 1000 bukan tahun, dan persentase) dalam jawaban agen yang **tidak ada** di sumbernya (data kantor, hasil alat, atau perintahmu sendiri). Jawaban Tanya Agen dan Perintah diberi catatan "⚠ Periksa sendiri: angka …" bila ada yang janggal. Ini pengaman tambahan, bukan jaminan: tetap cek angka penting ke dokumen aslinya.

Opsional (`start.bat` menanyakannya jika kunci AI sudah diisi): `AGENT_AI=1` memoles kalimat agen dengan AI agar lebih bergaya (fakta tetap sama), dibatasi `AGENT_AI_PER_HOUR` (default 10) dan ikut batas token bulanan. `AGENT_CHAT_SECONDS` mengatur jeda inisiatif (default 25, minimum 10).

Halaman: **Beranda** (kantor pixel + ringkasan), **Dokumen**, **Keuangan** (tagihan & buku kas), **Proyek** (progres dan biaya per bulan, grafik, peringatan), **Laporan** (bulanan, bisa dicetak/PDF dan diunduh CSV untuk Excel), **Tanya & Perintah** (tanya cepat, atau perintah bebas ke AI), **Tanya Kantor**, **Pengaturan**.

## Proyek: memantau laporan progres

Laporan progres proyek yang diunggah dibaca AI (nama proyek, bulan, progres fisik, rencana, anggaran, biaya terserap). Setelah **diverifikasi orang**, datanya masuk ke halaman **Proyek** sebagai deret waktu per bulan (bisa juga diisi manual). Halaman itu menampilkan grafik rencana vs progres fisik vs biaya terserap, dan memberi peringatan otomatis:

| Kondisi | Tingkat |
|---|---|
| Progres terlambat ≥ 5 poin dari rencana | Waspada |
| Progres terlambat ≥ 10 poin | Bahaya |
| Biaya terserap ≥ 5 poin lebih cepat dari progres fisik | Waspada |
| Keterlambatan bertambah ≥ 2 poin dibanding bulan sebelumnya | Waspada |

Proyek berisiko muncul di Beranda, di ringkasan Telegram, dan dibicarakan agen. Nama proyek yang sama (huruf besar/kecil diabaikan) digabung. Mode demo tidak membaca PDF, jadi di sana data proyek diisi manual.

## Tanya & Perintah: perintah bebas ke AI

Mode **Perintah dengan dokumen** di tab **Tanya & Perintah** memungkinkan kamu menulis perintah sendiri (maks 2000 karakter), melampirkan hingga 3 dokumen (AI membaca **file aslinya**, bukan hanya ringkasan), dan opsional menyertakan data kantor (tagihan, kas, proyek, daftar dokumen). Ada contoh perintah: analisis risiko, draf surat teguran, draf perpanjangan izin, ringkasan untuk pemilik, bandingkan dokumen, cek kejanggalan, pesan WhatsApp. Hasil disimpan (bisa disalin, diunduh .txt, dihapus admin).

Batasan sengaja: AI **hanya menulis** jawaban atau draf. Ia tidak membayar, tidak mengirim, dan tidak mengubah data. Isi dokumen diperlakukan sebagai data tidak tepercaya. Satu perintah diproses pada satu waktu, memakai token sesuai ukuran dokumen terlampir, dan ikut batas token bulanan. Staf dan admin boleh menjalankan; pengamat hanya melihat hasil.

## Tagihan ganda dan arah pembayaran

- Jadwal bayar yang sama (tanggal dan jumlah) dari dokumen berbeda (mis. termin yang disebut di kontrak dan di laporan) **hanya dicatat sekali**; yang kedua dilewati dan diberitahukan.
- Tiap baris jadwal punya arah sendiri (kita bayar / kita tagih), jadi laporan yang memuat keduanya tetap benar.
- AI diminta mengisi jumlah hanya untuk pembayaran yang **pasti** jatuh tempo; usulan, anggaran, atau denda yang mungkin terjadi tidak boleh jadi tagihan. Tetap periksa saat verifikasi.

Aturan penting:
- Dokumen yang diverifikasi → catatan kas dari dokumen itu ikut terverifikasi. Transaksi **draft tidak dihitung di laporan**.
- Melunasi tagihan otomatis membuat catatan kas terverifikasi. Menghapus catatan itu mengembalikan tagihan ke "belum lunas".
- Sistem hanya **mencatat**. Tidak ada yang membayar atau memindahkan uang.

## Menjalankan (Windows)

Klik dua kali **`start.bat`**. Skrip akan menanyakan: port (jika terpakai), penyedia AI + kunci API, akun login, dan Telegram (opsional). Kunci tidak pernah ditulis polos ke file. Di akhir, `start.bat` menanyakan **menyimpan pengaturan terenkripsi** (cukup Enter = simpan, `n` = jangan) (`data\config.dpapi`, Windows DPAPI) supaya lain kali cukup satu Enter. Pilihan saat ada pengaturan tersimpan: Enter = pakai, `n` = isi ulang (file tetap), `h` = hapus lalu isi ulang. Jangan tutup jendelanya selama dipakai.

Manual (PowerShell):
```
cd D:\KantorAI
npm install
$env:OFFICE_USERS="bryan:SandiKuat1|admin,keluarga:SandiKuat2|pengamat"
node server.js
```
Buka http://127.0.0.1:3333.

## Mode

- **Demo** (default, gratis): tanpa AI, ekstraksi sederhana (regex). PDF/foto tidak dibaca isinya.
- **AI**: API resmi **Anthropic** atau **OpenAI** (bayar per pemakaian, terpisah dari langganan ChatGPT/Claude).

```
$env:ANTHROPIC_API_KEY="sk-ant-..."     # Anthropic
$env:CLAUDE_MODEL="claude-haiku-4-5"

$env:OPENAI_API_KEY="sk-..."            # atau OpenAI
$env:OPENAI_MODEL="gpt-6-luna"          # bawaan; isi persis dengan ID model di dashboard OpenAI
$env:OPENAI_PDF_MODEL="gpt-4o-mini"     # opsional: model lain khusus PDF, jika model utama menolak PDF
$env:OPENAI_REASONING_EFFORT="none"     # otomatis "none" untuk gpt-6*; kosongkan ("") bagi model yang menolaknya

$env:AI_PROVIDER="openai"               # hanya jika dua kunci di-set (default: anthropic)
$env:MONTHLY_TOKEN_LIMIT="2000000"      # batas token per bulan
```
Pasang juga batas pengeluaran bulanan di dashboard penyedia. `AI_PROVIDER` salah ketik atau kunci kosong → server tetap jalan di mode demo dan menulis peringatan di log.
Jalur OpenAI diuji dengan server tiruan, belum dengan akun OpenAI asli.

## Akun & peran

`OFFICE_USERS="nama:sandi|peran,nama2:sandi2|peran"`

| Peran | Boleh |
|---|---|
| `admin` | Semua, termasuk hapus, pengaturan, kirim ringkasan Telegram |
| `staf` | Unggah, edit, verifikasi, catat kas/tagihan, lunasi |
| `pengamat` | Hanya melihat dan bertanya |

Tanpa peran: akun pertama = admin, sisanya = staf. Bila kamu mengosongkan pertanyaan akun di `start.bat` (atau pengaturan tersimpan belum punya akun) padahal kunci AI/Telegram sudah diisi, `start.bat` membuat akun **admin** dengan sandi acak, menampilkannya sekali, dan menyimpannya terenkripsi, jadi sandinya tidak berganti tiap dijalankan. Tanpa kunci apa pun (mode demo), server memakai akun sementara yang sandinya berganti tiap mulai. Login dibatasi 10 percobaan/15 menit per IP.

## Notifikasi Telegram (opsional)

1. Di Telegram chat **@BotFather** → `/newbot` → simpan token.
2. Kirim satu pesan ke bot barumu, buka `https://api.telegram.org/bot<TOKEN>/getUpdates`, catat angka `chat.id`.
3. Jalankan dengan `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, dan (opsional) `DIGEST_HOUR=8` untuk standup otomatis tiap hari, `LAPORAN_HARI=1` untuk laporan mingguan tiap Senin (0 = Minggu … 6 = Sabtu).

Tombol "Pratinjau ringkasan", standup, laporan mingguan, dan "Kirim sekarang" ada di Pengaturan. `PENJAGA_MENIT` mengatur jarak pemeriksaan Penjaga; `BROWSER_PATH` menunjuk Edge/Chrome bila tidak ditemukan otomatis (untuk PDF). WhatsApp belum didukung (butuh akun bisnis & persetujuan Meta).

## Data (folder `data`)

`docs.json`, `uploads` (file asli), `kas.json`, `tagihan.json`, `proyek.json`, `tugas.json`, `persetujuan.json`, `rapat.json`, `berkas` (hasil buatan agen), `agen.json`, `instruksi.json`, `settings.json`, `audit.log`, `usage.json`, `secret.json`, `backup` (dibuat Penjaga).
Penjaga membuat backup otomatis ke `data\backup`, tetapi itu masih di komputer yang sama: **salin juga folder `data` ke tempat lain secara rutin.** Dokumen dari versi lama otomatis dimigrasi saat server mulai.

## Keamanan

- Server hanya mendengarkan `127.0.0.1`. Agar keluarga di pulau lain bisa akses: VPS di belakang HTTPS (Caddy/Nginx/Cloudflare Tunnel), `HOST=0.0.0.0` hanya di belakang proxy itu, dan `COOKIE_SECURE=1`. Jangan buka port langsung ke internet tanpa HTTPS.
- Pengaturan tersimpan (`data\config.dpapi`) dienkripsi dengan Windows DPAPI: **hanya bisa dibuka oleh akun Windows yang sama di komputer yang sama**. Menyalin file itu ke komputer lain tidak berguna (dan aman). Program lain yang berjalan sebagai akun Windows yang sama tetap bisa membukanya, seperti penyimpanan kunci pada umumnya. Hapus lewat `h` di `start.bat` atau hapus filenya.
- Isi file divalidasi (PDF, JPG/PNG/WEBP, teks). Isi dokumen diperlakukan sebagai data tidak tepercaya (tidak dijalankan sebagai instruksi).
- CSV menetralkan sel yang diawali `=`, `+`, `-`, `@` agar tidak jadi rumus Excel.
- Mode AI mengirim dokumen ke penyedia AI. Baca kebijakan datanya sebelum memasukkan KTP/kontrak sensitif.
- Hasil ekstraksi AI bisa salah: selalu verifikasi angka dan tanggal.

## Struktur kode

`server.js` (rute & pipeline) · `lib/ai.js` (Anthropic/OpenAI) · `lib/extract.js` (prompt, normalisasi, mode demo) · `lib/finance.js` (kas, tagihan, laporan, CSV) · `lib/persona.js` (kepribadian & pikiran agen) · `lib/projects.js` (deret waktu & peringatan proyek) · `lib/perintah.js` (Minta Agen) · `lib/agen.js` (daftar agen sebagai data) · `lib/tugas.js` (Papan Tugas + Kotak Persetujuan) · `lib/manajer.js` · `lib/pelaksana.js` · `lib/harian.js` (standup) · `lib/laporanfile.js` (laporan mingguan HTML/PDF) · `lib/penjaga.js` (kesehatan, backup, perbaikan aman) · `lib/alat.js` (alat agen + pengamannya) · `lib/berkas.js` (docx/xlsx/csv/pdf buatan agen) · `lib/bottelegram.js` (perintah lewat Telegram) · `lib/tanyaagen.js` (tanya satu agen, alat hanya-baca) · `lib/rapat.js` (naskah, pemeriksaan angka, notulen) · `lib/angka.js` (pemeriksa angka) · `lib/kunci.js` (satu server saja per folder data) · `public/rapat.js` (tombol & riwayat rapat) · `public/md.js` (Markdown bersama) · `lib/notify.js` (Telegram) · `lib/store.js` (penyimpanan JSON) · `public/` (antarmuka: `dashboard.js` kartu visual Beranda, `pathing.js` denah + A*, `avatars.js`, `scene.js`, `office.js` kantor pixel, `docs.js`, `finance.js`, `proyek.js`, `agen.js`, `tugas.js`, `sistem.js`, `app.js`).
Mengubah denah: edit `LAYOUT`/`SEATS`/`WALLS` di `public/pathing.js`. Perabot dan halangan memakai data yang sama; pastikan semua ruangan tetap bisa dilalui (jangan menutup pintu).

## Belum ada

WhatsApp, RAB per item pekerjaan (Proyek hanya melacak progres fisik dan biaya total), pencarian isi penuh dokumen untuk Tanya & Perintah (ia membaca ringkasan, jadwal, dan ketentuan penting yang diekstrak; untuk pertanyaan yang butuh isi penuh, pakai mode Perintah dengan dokumen terlampir), agen yang bertindak sendiri tanpa persetujuan (mengirim/membayar), karakter pixel untuk agen kustom buatan admin (mereka hanya muncul di daftar agen dan Papan Tugas), backup ke luar komputer, foto bukti pembayaran per tagihan.
