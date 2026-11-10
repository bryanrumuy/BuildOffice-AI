# Mengganti akun login Kantor AI tanpa mengisi ulang kunci AI atau Telegram.
# Cara pakai: tutup server (jendela start.bat) dulu, lalu klik dua kali ganti-akun.bat.
# Hanya bagian akun (OFFICE_USERS) di data\config.dpapi yang diubah; kunci AI dan pengaturan lain dibiarkan.
# Sandi diketik di jendela ini (tersembunyi), tidak ditampilkan dan tidak disimpan polos di file mana pun.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$cfgFile = Join-Path $PSScriptRoot 'data\config.dpapi'
if (-not (Test-Path $cfgFile)) { Write-Host 'Belum ada pengaturan tersimpan. Jalankan start.bat dulu dan isi pengaturannya.' -ForegroundColor Yellow; exit 1 }
$lock = Join-Path $PSScriptRoot 'data\server.lock'
if (Test-Path $lock) {
  try { $pid0 = (Get-Content $lock -Raw | ConvertFrom-Json).pid; if ($pid0 -and (Get-Process -Id $pid0 -ErrorAction SilentlyContinue)) { Write-Host "Server masih berjalan (PID $pid0). Tutup jendela start.bat dulu, lalu jalankan ini lagi." -ForegroundColor Yellow; exit 1 } } catch { }
}
try {
  $sec = (Get-Content $cfgFile -Raw).Trim() | ConvertTo-SecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $cfg = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) | ConvertFrom-Json } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
} catch { Write-Host 'Pengaturan tersimpan tidak bisa dibuka (dibuat oleh akun Windows atau komputer lain).' -ForegroundColor Red; exit 1 }

function Baca-Rahasia($prompt) {
  $s = Read-Host $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
$nama = (Read-Host 'Nama pengguna baru (huruf/angka, tanpa spasi)').Trim()
if ($nama -notmatch '^[A-Za-z0-9._-]{2,30}$') { Write-Host 'Nama pengguna tidak valid.' -ForegroundColor Red; exit 1 }
$sandi = Baca-Rahasia 'Sandi baru (minimal 8 karakter; tanda : , | tidak boleh dipakai)'
$ulang = Baca-Rahasia 'Ulangi sandi'
if ($sandi -ne $ulang) { Write-Host 'Kedua sandi tidak sama. Tidak ada yang diubah.' -ForegroundColor Red; exit 1 }
if ($sandi.Length -lt 8 -or $sandi -match '[:,|]') { Write-Host 'Sandi harus minimal 8 karakter dan tidak boleh memuat : , |. Tidak ada yang diubah.' -ForegroundColor Red; exit 1 }

$salinan = "$cfgFile.sebelum-ganti-akun"
Copy-Item $cfgFile $salinan -Force
$obj = [ordered]@{}
foreach ($p in $cfg.PSObject.Properties) { if ($p.Name -ne 'OFFICE_USERS') { $obj[$p.Name] = $p.Value } }
$obj['OFFICE_USERS'] = "${nama}:${sandi}|admin"
$baru = ConvertTo-SecureString ($obj | ConvertTo-Json -Compress) -AsPlainText -Force
($baru | ConvertFrom-SecureString) | Set-Content $cfgFile -Encoding ascii
Write-Host "`nSelesai. Akun admin sekarang: $nama (sandi sesuai yang Anda ketik)." -ForegroundColor Green
Write-Host 'Jalankan start.bat seperti biasa, pilih Enter untuk memakai pengaturan tersimpan, lalu masuk dengan akun ini.' -ForegroundColor Green
Write-Host "Cadangan pengaturan lama ada di $salinan (terenkripsi, hanya terbaca akun Windows ini); hapus bila tidak perlu." -ForegroundColor DarkGray
