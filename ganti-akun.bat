@echo off
rem Klik dua kali untuk mengganti akun login (nama dan sandi) tanpa mengisi ulang kunci AI.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0ganti-akun.ps1"
echo.
pause
