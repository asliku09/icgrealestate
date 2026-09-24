@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ICG Real Estate - Kadro guncelleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kadro-Guncelle.ps1"
echo.
pause
