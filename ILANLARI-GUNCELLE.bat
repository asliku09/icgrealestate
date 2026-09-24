@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ICG Real Estate - Ilanlar guncelleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Ilan-Guncelle.ps1"
echo.
pause
