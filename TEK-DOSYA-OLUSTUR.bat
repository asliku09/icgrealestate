@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ICG Real Estate - Paylasim icin tek dosya olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tek-Dosya-Olustur.ps1"
echo.
pause
