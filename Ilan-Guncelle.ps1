# ICG Real Estate - Ilan Otomatik Guncelleyici (ASCII-only, PS 5.1 uyumlu)
# Kullanim:
#   powershell -ExecutionPolicy Bypass -File Ilan-Guncelle.ps1        (tek seferlik)
#   powershell -ExecutionPolicy Bypass -File Ilan-Guncelle.ps1 -Watch (canli takip)
#
# Klasor duzeni (ornek):
#   ilanlar/ilan1.txt            -> fiyat(1.satir), konum(2.satir), ozellikler(gerisi)
#   ilanlar/ilan1 kapak.png      -> kapak fotografi (ilan adiyla ayni isim + " kapak")
#   ilanlar/ilan1 (2).png ...    -> diger fotograflar (ayni isim + numara)
param([switch]$Watch)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$IlanDirInfo = Get-ChildItem -LiteralPath $Root -Directory | Where-Object { $_.Name -like 'ilan*' } | Select-Object -First 1
if (-not $IlanDirInfo) { Write-Output '[HATA] ilan klasoru bulunamadi.'; exit 1 }
$IlanDir = $IlanDirInfo.FullName
$IlanFolderName = $IlanDirInfo.Name
$JsonPath = Join-Path $Root 'ilanlar.json'
$FallbackPath = Join-Path $Root 'ilanlar-fallback.js'
$ImgExts = @('.jpg', '.jpeg', '.png', '.webp')

function Get-BaseName($fileName) {
  $b = [IO.Path]::GetFileNameWithoutExtension($fileName)
  if ($b -like '* kapak') { return $b.Substring(0, $b.Length - 6).Trim() }
  $m = [regex]::Match($b, '^(.*)\s*\(\d+\)\s*$')
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return $b.Trim()
}

function Get-Listings {
  $files = @(Get-ChildItem -LiteralPath $IlanDir -File -ErrorAction SilentlyContinue)
  $txts = @($files | Where-Object { $_.Extension.ToLower() -eq '.txt' })
  $imgs = @($files | Where-Object { $ImgExts -contains $_.Extension.ToLower() })
  $list = @()
  foreach ($t in $txts) {
    $id = [IO.Path]::GetFileNameWithoutExtension($t.Name).Trim()
    $lines = @(Get-Content -LiteralPath $t.FullName -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    $allLines = @($lines)
    $mine = @($imgs | Where-Object { (Get-BaseName $_.Name) -eq $id })
    $cover = ''
    $hit = @($mine | Where-Object { ([IO.Path]::GetFileNameWithoutExtension($_.Name)) -like '* kapak' } | Select-Object -First 1)
    if ($hit.Count -gt 0) { $cover = $IlanFolderName + '/' + $hit[0].Name }
    else {
      $bare = @($mine | Where-Object {
        $bn = [IO.Path]::GetFileNameWithoutExtension($_.Name).Trim()
        ($bn -eq $id) -and -not ([regex]::IsMatch($bn, '\(\d+\)\s*$'))
      } | Select-Object -First 1)
      if ($bare.Count -gt 0) { $cover = $IlanFolderName + '/' + $bare[0].Name }
    }
    $gal = @($mine | Where-Object { [regex]::IsMatch([IO.Path]::GetFileNameWithoutExtension($_.Name), '\(\d+\)\s*$') } |
      Sort-Object { $m2 = [regex]::Match([IO.Path]::GetFileNameWithoutExtension($_.Name), '\((\d+)\)\s*$'); [int]$m2.Groups[1].Value } |
      ForEach-Object { $IlanFolderName + '/' + $_.Name })
    $list += [ordered]@{
      id = $id; lines = $allLines
      cover = $cover; gallery = $gal
    }
  }
  return @($list | Sort-Object { $_['id'] })
}

function Write-Listings {
  $items = Get-Listings
  $payload = [ordered]@{ generatedAt = (Get-Date -Format 'dd.MM.yyyy HH:mm'); listings = $items }
  $json = ConvertTo-Json $payload -Depth 6 -Compress
  $utf8 = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($JsonPath, $json, $utf8)
  $js = '/* OTOMATIK URETILDI (Ilan-Guncelle.ps1) - elle degistirmeyin. */' + "`r`n" + 'window.__LISTINGS_FALLBACK__ = ' + $json + ';'
  [IO.File]::WriteAllText($FallbackPath, $js, $utf8)
  Write-Output ("[OK] Ilanlar guncellendi: {0} ilan ({1})" -f $items.Count, $payload.generatedAt)
  foreach ($p in $items) { $first = ''; if ($p['lines'].Count -gt 0) { $first = $p['lines'][0] }; Write-Output ("  - {0} | {1}" -f $p['id'], $first) }
}

Write-Listings

if ($Watch) {
  Write-Output ''
  Write-Output '[CANLI] ilan klasoru izleniyor. Yeni ilan ekleyip cikarmak yeterli; site 30 sn icinde kendini gunceller.'
  Write-Output '[CANLI] Durdurmak icin bu pencereyi kapatin (Ctrl+C).'
  $watcher = New-Object IO.FileSystemWatcher($IlanDir, '*.*')
  $watcher.IncludeSubdirectories = $false
  $watcher.EnableRaisingEvents = $true
  $last = Get-Date
  while ($true) {
    $r = $watcher.WaitForChanged([IO.WatcherChangeTypes]::All, 2000)
    if (-not $r.TimedOut -and ((Get-Date) - $last).TotalSeconds -gt 3) {
      $last = Get-Date
      Start-Sleep -Milliseconds 800
      try { Write-Listings } catch { Write-Output ('[HATA] ' + $_.Exception.Message) }
    }
  }
}
