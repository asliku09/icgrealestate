@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ICG Real Estate - Canli takip baslatildi (kadro + ilanlar).
echo Bu pencere acik kaldigi surece klasorlere eklenen her kisi ve ilan
echo siteye 30 saniye icinde kendiliginden yansir.
echo Kapatmak icin pencereleri kapatin.
start "ICG Kadro Takip" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kadro-Guncelle.ps1" -Watch
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Ilan-Guncelle.ps1" -Watch
pause
