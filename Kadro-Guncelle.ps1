# ICG Real Estate - Kadro Otomatik Guncelleyici (ASCII-only, PS 5.1 uyumlu)
# Kullanim:
#   powershell -ExecutionPolicy Bypass -File Kadro-Guncelle.ps1        (tek seferlik guncelleme)
#   powersell -ExecutionPolicy Bypass -File Kadro-Guncelle.ps1 -Watch  (canli takip)
param([switch]$Watch)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$TeamDirInfo = Get-ChildItem -LiteralPath $Root -Directory | Where-Object { $_.Name -like 'dan*manlar' } | Select-Object -First 1
if (-not $TeamDirInfo) { Write-Output '[HATA] danisman klasoru bulunamadi.'; exit 1 }
$TeamDir = $TeamDirInfo.FullName
$TeamFolderName = $TeamDirInfo.Name
$JsonPath = Join-Path $Root 'team.json'
$FallbackPath = Join-Path $Root 'team-fallback.js'

# Varsayilan unvan (TR karakterler char koduyla kurulur)
$DefRole = 'Gayrimenkul Dan' + [char]0x131 + [char]0x15F + 'man' + [char]0x131

function Get-Team {
  $list = @()
  $txtFiles = Get-ChildItem -LiteralPath $TeamDir -Filter '*.txt' -File -ErrorAction SilentlyContinue
  foreach ($f in $txtFiles) {
    $lines = @(Get-Content -LiteralPath $f.FullName -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    if ($lines.Count -eq 0) { continue }
    $name = $lines[0]
    $rest = @($lines | Select-Object -Skip 1)
    $phones = @($rest | Where-Object { ($_ -replace '\D', '').Length -ge 7 })
    $textLines = @($rest | Where-Object { ($_ -replace '\D', '').Length -lt 7 })
    $role = $DefRole
    foreach ($ln in $textLines) {
      if ($ln -match 'broker|gayrimenkul|emlak|asistan|portf|satis|sat') { $role = $ln; break }
    }
    if ($role -eq $DefRole -and $textLines.Count -gt 0) { $role = $textLines[0] }
    $office = ''; $mobile = ''
    if ($phones.Count -ge 1) { $office = $phones[0] }
    if ($phones.Count -ge 2) { $mobile = $phones[1] }
    $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)
    $photo = ''
    foreach ($ext in @('.jpg', '.jpeg', '.png')) {
      $hit = Get-ChildItem -LiteralPath $TeamDir -File -ErrorAction SilentlyContinue | Where-Object {
        ([IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $base) -and ($_.Extension.ToLower() -eq $ext)
      } | Select-Object -First 1
      if ($hit) { $photo = $TeamFolderName + '/' + $hit.Name; break }
    }
    $list += [ordered]@{
      name = $name; role = $role
      phoneOffice = $office; phoneMobile = $mobile
      office = $office; mobile = $mobile
      photo = $photo
    }
  }
  return @($list | Sort-Object { if ($_['role'] -match 'broker') { '0' + $_['name'] } else { '1' + $_['name'] } })
}

function Write-Team {
  $team = Get-Team
  $payload = [ordered]@{ generatedAt = (Get-Date -Format 'dd.MM.yyyy HH:mm'); team = $team }
  $json = ConvertTo-Json $payload -Depth 5 -Compress
  $utf8 = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($JsonPath, $json, $utf8)
  $js = '/* OTOMATIK URETILDI (Kadro-Guncelle.ps1) - elle degistirmeyin. */' + "`r`n" + 'window.__TEAM_FALLBACK__ = ' + $json + ';'
  [IO.File]::WriteAllText($FallbackPath, $js, $utf8)
  Write-Output ("[OK] Kadro guncellendi: {0} kisi ({1})" -f $team.Count, $payload.generatedAt)
  foreach ($p in $team) { Write-Output ("  - {0} / {1}" -f $p['name'], $p['role']) }
}

Write-Team

if ($Watch) {
  Write-Output ''
  Write-Output '[CANLI] danisman klasoru izleniyor. Yeni kisi eklemeniz yeterli; site 30 sn icinde kendini gunceller.'
  Write-Output '[CANLI] Durdurmak icin bu pencereyi kapatin (Ctrl+C).'
  $watcher = New-Object IO.FileSystemWatcher($TeamDir, '*.*')
  $watcher.IncludeSubdirectories = $false
  $watcher.EnableRaisingEvents = $true
  $last = Get-Date
  while ($true) {
    $r = $watcher.WaitForChanged([IO.WatcherChangeTypes]::All, 2000)
    if (-not $r.TimedOut -and ((Get-Date) - $last).TotalSeconds -gt 3) {
      $last = Get-Date
      Start-Sleep -Milliseconds 800
      try { Write-Team } catch { Write-Output ('[HATA] ' + $_.Exception.Message) }
    }
  }
}
