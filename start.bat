@echo off
rem Klik dua kali file ini untuk menjalankan Kantor AI (memanggil start.ps1).
rem Alamat powershell ditulis lengkap karena PATH sebagian komputer tidak memuatnya.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo Jendela ini baru boleh ditutup kalau kamu memang mau mematikan server.
pause
