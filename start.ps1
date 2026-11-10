# Menjalankan Kantor AI. Kunci API tidak pernah ditulis polos ke file. Atas persetujuanmu, pengaturan disimpan
# TERENKRIPSI (Windows DPAPI) di data\config.dpapi: hanya bisa dibuka akun Windows ini di komputer ini.
# Cara pakai:  klik dua kali start.bat, atau  powershell -ExecutionPolicy Bypass -File .\start.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Find-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "$env:ProgramFiles\install\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if (Test-Path $p) { return $p }
  }
  throw 'Node.js tidak ditemukan. Pasang dari https://nodejs.org lalu jalankan lagi.'
}
function Get-PortOwner($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Find-FreePort($from) {
  for ($p = $from; $p -lt $from + 50; $p++) { if (-not (Get-PortOwner $p)) { return $p } }
  throw "Tidak menemukan port kosong mulai dari $from."
}
function Read-Secret($prompt) {
  $sec = Read-Host $prompt -AsSecureString
  if ($sec.Length -eq 0) { return '' }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# Pengaturan tersimpan: JSON dienkripsi dengan DPAPI (ConvertFrom-SecureString tanpa -Key = terikat akun Windows ini).
$cfgFile = Join-Path $PSScriptRoot 'data\config.dpapi'
$persistKeys = 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_PDF_MODEL', 'AGENT_AI', 'OFFICE_USERS', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DIGEST_HOUR'
function Load-Config {
  if (-not (Test-Path $cfgFile)) { return $null }
  try {
    $sec = (Get-Content $cfgFile -Raw).Trim() | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) | ConvertFrom-Json) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  } catch {
    Write-Host 'Pengaturan tersimpan tidak bisa dibuka (dibuat oleh akun Windows atau komputer lain). Silakan isi ulang.' -ForegroundColor Yellow
    return $null
  }
}
function Save-Config {
  $obj = [ordered]@{}
  foreach ($k in $persistKeys) { $v = [Environment]::GetEnvironmentVariable($k, 'Process'); if ($v) { $obj[$k] = $v } }
  if ($obj.Count -eq 0) { return $false }
  $sec = ConvertTo-SecureString ($obj | ConvertTo-Json -Compress) -AsPlainText -Force
  New-Item -ItemType Directory -Force (Split-Path $cfgFile) | Out-Null
  ($sec | ConvertFrom-SecureString) | Set-Content $cfgFile -Encoding ascii
  return $true
}

function New-AutoAccount {
  $b = New-Object byte[] 9; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($b)
  $sandi = ([Convert]::ToBase64String($b) -replace '[+/=]', 'x')
  $env:OFFICE_USERS = "admin:$sandi|admin"
  Write-Host "`nAkun login dibuat otomatis:  admin / $sandi" -ForegroundColor Cyan
  Write-Host 'Catat sekarang. Akun ini tersimpan terenkripsi dan tidak ditampilkan lagi. Untuk akun lain, jalankan start.bat lagi dan pilih n (isi ulang).' -ForegroundColor Cyan
}

$node = Find-Node

# 1) Pastikan port kosong sebelum menanyakan hal lain
$port = if ($env:PORT) { [int]$env:PORT } else { 3333 }
$owner = Get-PortOwner $port
if ($owner) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)"
  Write-Host "Port $port sedang dipakai proses lain: PID $($owner.OwningProcess)  $($proc.CommandLine)" -ForegroundColor Yellow
  if ($proc.CommandLine -match 'server\.js') {
    # Kantor AI yang lama masih jalan: menjalankan dua sekaligus merusak data dan membuat bot Telegram berebut pesan.
    $jawab = Read-Host 'Itu Kantor AI yang masih berjalan. Matikan dan ganti dengan yang baru? Enter = ya, n = pakai port lain (tidak disarankan)'
    if ($jawab -ne 'n') { Stop-Process -Id $owner.OwningProcess -Force; Start-Sleep -Seconds 1 }
    else { $port = Find-FreePort ($port + 1); Write-Host "Memakai port $port. Awas: server lama tetap berjalan." -ForegroundColor Yellow }
  } else {
    $jawab = Read-Host 'Matikan proses itu? y = matikan dan pakai port ini, Enter = pakai port lain'
    if ($jawab -eq 'y') { Stop-Process -Id $owner.OwningProcess -Force; Start-Sleep -Seconds 1 }
    else { $port = Find-FreePort ($port + 1); Write-Host "Memakai port $port." }
  }
}
$env:PORT = [string]$port

# 1b) Pakai pengaturan tersimpan (kunci terenkripsi) bila ada
$usedSaved = $false
$saved = Load-Config
if ($saved) {
  $pakai = Read-Host 'Ada pengaturan tersimpan (terenkripsi). Enter = pakai, n = isi ulang, h = hapus lalu isi ulang'
  if ($pakai -eq 'h') { Remove-Item $cfgFile -Force; Write-Host 'Pengaturan tersimpan dihapus.' }
  elseif ($pakai -ne 'n') {
    foreach ($p in $saved.PSObject.Properties) { if (-not [Environment]::GetEnvironmentVariable($p.Name, 'Process')) { [Environment]::SetEnvironmentVariable($p.Name, [string]$p.Value, 'Process') } }
    $usedSaved = $true
    Write-Host 'Memakai pengaturan tersimpan.' -ForegroundColor Green
    # Pengaturan lama tanpa akun: buat akun admin tetap (sandi acak, disimpan terenkripsi) agar sandi tidak berganti tiap dijalankan
    if (-not $env:OFFICE_USERS) { New-AutoAccount; [void](Save-Config) }
  }
}

# 2) Penyedia AI + kunci
$alreadySet = $env:ANTHROPIC_API_KEY -or $env:OPENAI_API_KEY
if (-not $alreadySet) {
  $pilih = Read-Host 'Penyedia AI: 1 = Anthropic, 2 = OpenAI, Enter = mode demo'
  if ($pilih -eq '1') { $env:ANTHROPIC_API_KEY = Read-Secret 'Tempel ANTHROPIC_API_KEY' }
  elseif ($pilih -eq '2') {
    $env:OPENAI_API_KEY = Read-Secret 'Tempel OPENAI_API_KEY'
    if (-not $env:OPENAI_MODEL) {
      $model = Read-Host 'Nama model OpenAI, persis seperti di dashboard OpenAI (Enter = gpt-6-luna)'
      if ($model.Trim()) { $env:OPENAI_MODEL = $model.Trim() }
    }
    if (-not $env:OPENAI_PDF_MODEL) {
      $pdfModel = Read-Host 'Model cadangan khusus PDF, isi hanya jika PDF ditolak model utama (Enter = tidak dipakai)'
      if ($pdfModel.Trim()) { $env:OPENAI_PDF_MODEL = $pdfModel.Trim() }
    }
  }
}

if (-not $usedSaved) {
  # 2b) Ucapan agen dipoles AI (opsional; hanya bila ada kunci AI karena memakai token)
  $hasKey = $env:ANTHROPIC_API_KEY -or $env:OPENAI_API_KEY
  if ($hasKey -and -not $env:AGENT_AI) {
    $poles = Read-Host 'Poles ucapan agen dengan AI? Memakai token (maks 10 kalimat per jam). y = ya, Enter = tidak'
    if ($poles -eq 'y') { $env:AGENT_AI = '1' }
  }

  # 3) Akun login (peran: admin = semua, staf = unggah/catat/verifikasi, pengamat = hanya lihat)
  if (-not $env:OFFICE_USERS) {
    $users = Read-Host 'Akun login, format nama:sandi|peran,nama2:sandi2|peran (Enter = buat akun admin otomatis)'
    if ($users) { $env:OFFICE_USERS = $users }
  }

  # 4) Notifikasi Telegram (opsional)
  if (-not $env:TELEGRAM_BOT_TOKEN) {
    $tg = Read-Host 'Aktifkan notifikasi Telegram? y = ya, Enter = lewati'
    if ($tg -eq 'y') {
      $env:TELEGRAM_BOT_TOKEN = Read-Secret 'Tempel token bot dari @BotFather'
      $chat = Read-Host 'Chat ID Telegram (angka)'
      if ($chat.Trim()) { $env:TELEGRAM_CHAT_ID = $chat.Trim() }
      $jam = Read-Host 'Kirim ringkasan otomatis tiap hari setelah jam berapa? 0-23 (Enter = tidak otomatis)'
      if ($jam.Trim()) { $env:DIGEST_HOUR = $jam.Trim() }
    }
  }

  # Ada yang layak disimpan (kunci AI atau token) tetapi belum ada akun: buat akun admin tetap, jangan akun sementara yang sandinya berganti
  if (-not $env:OFFICE_USERS -and ($env:ANTHROPIC_API_KEY -or $env:OPENAI_API_KEY -or $env:TELEGRAM_BOT_TOKEN)) { New-AutoAccount }

  # 5) Simpan agar tidak perlu mengisi lagi (hanya jika ada yang layak disimpan)
  $adaIsi = $persistKeys | Where-Object { [Environment]::GetEnvironmentVariable($_, 'Process') }
  if ($adaIsi) {
    $simpan = Read-Host 'Simpan pengaturan ini TERENKRIPSI agar tidak perlu diisi lagi? Hanya bisa dibuka akun Windows ini. Enter = simpan, n = jangan simpan'
    if ($simpan -ne 'n' -and (Save-Config)) { Write-Host "Tersimpan di $cfgFile (terenkripsi)." -ForegroundColor Green }
  }
}
if (-not $env:MONTHLY_TOKEN_LIMIT) { $env:MONTHLY_TOKEN_LIMIT = '2000000' }

Write-Host "`nBuka http://127.0.0.1:$port  (tutup jendela ini = server berhenti)`n" -ForegroundColor Green
# Pengawas: bila server mati tak terduga (kode bukan 0), jalankan ulang otomatis. Berhenti bila mati 5 kali dalam 5 menit
# agar tidak berputar tanpa akhir. Penjaga Sistem di dalam aplikasi menampilkan status ini.
$env:KANTOR_SUPERVISED = '1'
$mati = @()
while ($true) {
  & $node server.js
  $kode = $LASTEXITCODE
  if ($kode -eq 0) { break }
  $sekarang = Get-Date
  $mati = @($mati | Where-Object { ($sekarang - $_).TotalMinutes -le 5 }) + $sekarang
  if ($mati.Count -ge 5) {
    Write-Host "`nServer mati $($mati.Count) kali dalam 5 menit (kode terakhir $kode). Pengawas berhenti; baca pesan error di atas." -ForegroundColor Red
    break
  }
  Write-Host "`nServer berhenti tidak terduga (kode $kode). Memulai ulang dalam 3 detik... ($($mati.Count) kali dalam 5 menit terakhir)" -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}
Write-Host "`nServer berhenti. Baca pesan di atas bila tidak disengaja." -ForegroundColor Red
