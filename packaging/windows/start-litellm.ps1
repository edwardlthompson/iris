<#
.SYNOPSIS
Start, stop, or check the local LiteLLM proxy (127.0.0.1:4000 only) for Iris pool mode.
#>
param(
  [switch]$Worker,
  [switch]$Status,
  [switch]$Stop,
  [switch]$Restart
)
$ErrorActionPreference = "Stop"

$IrisDir = Join-Path $env:USERPROFILE ".iris"
$ConfigPath = Join-Path $IrisDir "litellm-config.yaml"
$EnvPath = Join-Path $IrisDir "litellm.env"
$LogPath = Join-Path $IrisDir "litellm.log"
$ErrLogPath = Join-Path $IrisDir "litellm.err.log"
$Port = 4000

function Import-IrisEnv {
  if (Test-Path $EnvPath) {
    foreach ($line in Get-Content $EnvPath -Encoding UTF8) {
      $t = $line.Trim()
      if (-not $t -or $t.StartsWith("#")) { continue }
      $idx = $t.IndexOf("=")
      if ($idx -lt 1) { continue }
      $k = $t.Substring(0, $idx).Trim()
      $v = $t.Substring($idx + 1).Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
  }
  $env:PYTHONUTF8 = "1"
  $env:PYTHONIOENCODING = "utf-8"
  $env:PYTHONUNBUFFERED = "1"
  $env:LITELLM_LOCAL_MODEL_COST_MAP = "True"
  $env:DO_NOT_TRACK = "True"
}

function Find-LiteLlm {
  $cmd = Get-Command litellm -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  foreach ($p in @(
    "C:\Python315\Scripts\litellm.exe",
    "C:\Python314\Scripts\litellm.exe",
    "C:\Python313\Scripts\litellm.exe",
    "C:\Python312\Scripts\litellm.exe",
    (Join-Path $env:USERPROFILE ".local\bin\litellm.exe")
  )) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Test-Proxy {
  try {
    $headers = @{}
    if ($env:LITELLM_MASTER_KEY) { $headers["Authorization"] = "Bearer $($env:LITELLM_MASTER_KEY)" }
    Invoke-RestMethod "http://127.0.0.1:$Port/health/liveliness" -Headers $headers -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Stop-Proxy {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match "litellm|python" -and $_.CommandLine -match "litellm-config\.yaml"
  }
  foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  for ($i = 0; $i -lt 10; $i++) {
    $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $still) { break }
    Start-Sleep -Milliseconds 200
  }
}

Import-IrisEnv

if ($Status) {
  $up = Test-Proxy
  Write-Host ("LiteLLM 127.0.0.1:${Port}: " + ($(if ($up) { "RUNNING" } else { "OFFLINE" })))
  exit ($(if ($up) { 0 } else { 1 }))
}

if ($Stop) {
  Stop-Proxy
  Write-Host "Stopped LiteLLM on 127.0.0.1:$Port"
  exit 0
}

if ($Restart) {
  Stop-Proxy
  Start-Sleep -Milliseconds 600
}

$exe = Find-LiteLlm
if (-not $exe) {
  Write-Error "litellm.exe not found. Install via: pip install 'litellm[proxy]'"
  exit 1
}
if (-not (Test-Path $ConfigPath)) {
  Write-Error "Missing $ConfigPath. Run packaging\windows\setup-litellm-pool.ps1 first."
  exit 1
}

if ($Worker) {
  New-Item -ItemType Directory -Force -Path $IrisDir | Out-Null
  $ErrorActionPreference = "Continue"
  & $exe --config $ConfigPath --host 127.0.0.1 --port $Port
  exit $LASTEXITCODE
}

if (Test-Proxy) {
  Write-Host "LiteLLM already running on 127.0.0.1:$Port"
  exit 0
}

New-Item -ItemType Directory -Force -Path $IrisDir | Out-Null
Set-Content -Path $LogPath -Value "" -Encoding UTF8
Set-Content -Path $ErrLogPath -Value "" -Encoding UTF8
$proc = Start-Process -FilePath $exe -ArgumentList @(
  "--config", $ConfigPath, "--host", "127.0.0.1", "--port", "$Port"
) -RedirectStandardOutput $LogPath -RedirectStandardError $ErrLogPath -WindowStyle Hidden -PassThru

for ($i = 0; $i -lt 35; $i++) {
  if (Test-Proxy) {
    Write-Host "LiteLLM ready on http://127.0.0.1:$Port (PID $($proc.Id))"
    exit 0
  }
  if ($proc.HasExited) {
    Write-Warning "LiteLLM exited early with code $($proc.ExitCode)."
    if (Test-Path $ErrLogPath) {
      Get-Content $ErrLogPath -Tail 15 -Encoding UTF8 | ForEach-Object {
        Write-Host ($_ -replace 'sk-[A-Za-z0-9_\-]+', 'sk-***')
      }
    }
    exit 1
  }
  Start-Sleep -Seconds 1
}

Write-Warning "LiteLLM started but did not answer /health/liveliness within 35s. Check $LogPath and $ErrLogPath"
exit 1
