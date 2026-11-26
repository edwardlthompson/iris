# Quit Antigravity and reopen it with --remote-debugging-port=9000.
param([switch]$Worker)
$ErrorActionPreference = "Stop"
$Port = 9000
$Log = Join-Path $env:USERPROFILE ".iris\start-antigravity.log"

function Test-Cdp {
  try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 1 | Out-Null; $true } catch { $false }
}
function Find-Antigravity {
  $running = Get-Process -Name Antigravity -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -First 1
  if ($running) { return $running.Path }
  foreach ($p in @(
    "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe",
    "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe",
    "$env:ProgramFiles\Antigravity\Antigravity.exe"
  )) { if (Test-Path $p) { return $p } }
  $null
}

if (-not $Worker) {
  if (Test-Cdp) { Write-Host "Antigravity CDP already live on $Port"; exit 0 }
  if (-not (Find-Antigravity)) { Write-Error "Antigravity.exe not found"; exit 1 }
  New-Item -ItemType Directory -Force -Path (Split-Path $Log) | Out-Null
  Set-Content $Log ""
  Start-Process powershell -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$PSCommandPath,"-Worker")
  exit 0
}

function Say($m) { Add-Content $Log "$(Get-Date -Format s) $m" }
$exe = Find-Antigravity
if (-not $exe) { Say "Antigravity.exe not found"; exit 1 }
$procs = Get-Process -Name Antigravity -ErrorAction SilentlyContinue
if ($procs) {
  $procs | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  for ($i = 0; $i -lt 20 -and (Get-Process -Name Antigravity -EA SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
  if (Get-Process -Name Antigravity -EA SilentlyContinue) { Stop-Process -Name Antigravity -Force -EA SilentlyContinue; Start-Sleep -Seconds 1 }
}
Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port"
for ($i = 0; $i -lt 30; $i++) { if (Test-Cdp) { Say "Antigravity up on $Port"; exit 0 }; Start-Sleep -Seconds 1 }
Say "Antigravity started but port $Port is silent"
