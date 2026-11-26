# Quit Cursor and reopen it with --remote-debugging-port=9222.
param([switch]$Worker)
$ErrorActionPreference = "Stop"
$Port = 9222
$Log = Join-Path $env:USERPROFILE ".iris\start-cursor.log"

function Test-Cdp {
  try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 1 | Out-Null; $true } catch { $false }
}
function Find-Cursor {
  $running = Get-Process -Name Cursor -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -First 1
  if ($running) { return $running.Path }
  foreach ($p in @("$env:LOCALAPPDATA\Programs\cursor\Cursor.exe", "$env:ProgramFiles\Cursor\Cursor.exe")) {
    if (Test-Path $p) { return $p }
  }
  $null
}

if (-not $Worker) {
  if (Test-Cdp) { Write-Host "Cursor CDP already live on $Port"; exit 0 }
  if (-not (Find-Cursor)) { Write-Error "Cursor.exe not found"; exit 1 }
  New-Item -ItemType Directory -Force -Path (Split-Path $Log) | Out-Null
  Set-Content $Log ""
  Start-Process powershell -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$PSCommandPath,"-Worker")
  exit 0
}

function Say($m) { Add-Content $Log "$(Get-Date -Format s) $m" }
$exe = Find-Cursor
if (-not $exe) { Say "Cursor.exe not found"; exit 1 }
$procs = Get-Process -Name Cursor -ErrorAction SilentlyContinue
if ($procs) {
  $procs | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  for ($i = 0; $i -lt 20 -and (Get-Process -Name Cursor -EA SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
  if (Get-Process -Name Cursor -EA SilentlyContinue) { Stop-Process -Name Cursor -Force -EA SilentlyContinue; Start-Sleep -Seconds 1 }
}
Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port"
for ($i = 0; $i -lt 30; $i++) { if (Test-Cdp) { Say "Cursor up on $Port"; exit 0 }; Start-Sleep -Seconds 1 }
Say "Cursor started but port $Port is silent"
