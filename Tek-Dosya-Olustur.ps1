# ICG Real Estate - Tek Dosya Olusturucu (paylasim surumu)
# 3 bagimsiz dosya uretir (fotograflar + veriler gomulu):
#   ICG-Real-Estate-Tanitim.html  (anasayfa)
#   ICG-Ilanlar.html              (tum ilanlar)
#   ICG-Ilan-Detay.html           (ilan detayi, ?id= ile acilir)
# Once Kadro-Guncelle.ps1 ve Ilan-Guncelle.ps1 calistirilmis olmalidir.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing

function Get-DataUri($path, $maxW, $quality) {
  $img = [Drawing.Image]::FromFile($path)
  try {
    $w = $img.Width; $h = $img.Height
    if ($w -gt $maxW) { $h = [int]($h * $maxW / $w); $w = $maxW }
    $bmp = New-Object Drawing.Bitmap($w, $h)
    $g = [Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($img, 0, 0, $w, $h)
    } finally { $g.Dispose() }
    $ms = New-Object IO.MemoryStream
    try {
      $codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
      $enc = New-Object Drawing.Imaging.EncoderParameters(1)
      $enc.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, [long]$quality)
      $bmp.Save($ms, $codec, $enc)
      return 'data:image/jpeg;base64,' + [Convert]::ToBase64String($ms.ToArray())
    } finally { $ms.Dispose(); $bmp.Dispose() }
  } finally { $img.Dispose() }
}

function Get-EmbedUri($relPath, $maxW, $quality) {
  if (-not $relPath -or $relPath -like 'data:*') { return $relPath }
  $fp = Join-Path $Root ($relPath -replace '/', '\')
  if (-not (Test-Path -LiteralPath $fp)) { return $relPath }
  try { return Get-DataUri $fp $maxW $quality }
  catch { Write-Output ('[UYARI] Gomule edilemedi, dosya yolu korunuyor: {0}' -f $relPath); return $relPath }
}

function Read-Utf8($name) { return [IO.File]::ReadAllText((Join-Path $Root $name), [Text.Encoding]::UTF8) }

# --- Ortak kaynaklar ---
$css = Read-Utf8 'styles.css'
$app = Read-Utf8 'app.js'
$listJs = Read-Utf8 'listings.js'
$logoFile = Get-ChildItem -LiteralPath (Join-Path $Root 'logo') -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension.ToLower() -in @('.jpg', '.jpeg', '.png') } | Select-Object -First 1
$logoUri = ''
if ($logoFile) { $logoUri = Get-DataUri $logoFile.FullName 400 78 }

# --- Kadro verisi (fotograflar gomulu) ---
$team = Read-Utf8 'team.json' | ConvertFrom-Json
foreach ($p in $team.team) { $p.photo = Get-EmbedUri $p.photo 560 70 }
$teamJson = ($team | ConvertTo-Json -Depth 5 -Compress)

# --- Ilan verisi (kapak + galeri gomulu) ---
$listings = Read-Utf8 'ilanlar.json' | ConvertFrom-Json
foreach ($l in $listings.listings) {
  $l.cover = Get-EmbedUri $l.cover 700 68
  $gal = @()
  foreach ($g in $l.gallery) { $gal += @(Get-EmbedUri $g 800 66) }
  $l.gallery = $gal
}
$listJson = ($listings | ConvertTo-Json -Depth 6 -Compress)
Write-Output ('[OK] Veriler hazir: {0} kisi, {1} ilan' -f $team.team.Count, $listings.listings.Count)

$SinglePages = "window.ICG_PAGES={detail:'ICG-Ilan-Detay.html',list:'ICG-Ilanlar.html',home:'ICG-Real-Estate-Tanitim.html'};"
$appNoFetch = $app.Replace("s.src = 'team-fallback.js?t=' + Date.now();", 'return;')

function Build-Page($srcName, $outName, $withTeam) {
  $html = Read-Utf8 $srcName
  if ($logoUri -ne '') { $html = $html.Replace('logo/logo icg.jpg?v=2', $logoUri).Replace('logo/logo icg.jpg', $logoUri) }
  $html = $html.Replace('<link rel="stylesheet" href="styles.css">', '<style>' + $css + '</style>')
  if ($withTeam) {
    $inlineApp = 'window.__TEAM_FALLBACK__ = ' + $teamJson + ';' + "`r`n" + $appNoFetch
  } else {
    $inlineApp = 'window.ICG_NO_TEAM=true;' + "`r`n" + $app
  }
  $html = $html.Replace('<script src="team-fallback.js"></script>', '<script>' + $inlineApp)
  $html = $html.Replace('<script src="app.js"></script>', '</script>')
  $inlineList = $SinglePages + "`r`n" + 'window.__LISTINGS_FALLBACK__ = ' + $listJson + ';' + "`r`n" + $listJs
  $html = $html.Replace('<script src="ilanlar-fallback.js"></script>', '<script>' + $inlineList)
  $html = $html.Replace('<script src="listings.js"></script>', '</script>')
  $html = $html.Replace('ListingsApp.init({});', 'ListingsApp.init({fetchUrl:null,fallbackUrl:null});')
  $html = $html.Replace('ilan-detay.html', 'ICG-Ilan-Detay.html')
  $html = $html.Replace('ilanlar.html', 'ICG-Ilanlar.html')
  if ($srcName -ne 'index.html') {
    $html = $html.Replace('index.html', 'ICG-Real-Estate-Tanitim.html')
  }
  $Out = Join-Path $Root $outName
  [IO.File]::WriteAllText($Out, $html, (New-Object Text.UTF8Encoding($false)))
  $kb = [int]((Get-Item -LiteralPath $Out).Length / 1024)
  Write-Output ('[OK] Hazir: {0} ({1} KB)' -f $outName, $kb)
}

Build-Page 'index.html' 'ICG-Real-Estate-Tanitim.html' $true
Build-Page 'ilanlar.html' 'ICG-Ilanlar.html' $false
Build-Page 'ilan-detay.html' 'ICG-Ilan-Detay.html' $false
Write-Output 'Paylasim: 3 dosyayi birlikte gonderin ya da klasore hepsini surukleyip (https://app.netlify.com/drop) link alin.'
