# Restarts the Iris host when port 7842 is closed. The phone cannot restart a dead host.
$ErrorActionPreference = "Continue"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $env:USERPROFILE ".iris\pair-code.json"
while ($true) {
  $listen = Get-NetTCPConnection -LocalPort 7842 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listen) {
    if (Test-Path $envFile) {
      try {
        $doc = Get-Content $envFile -Raw | ConvertFrom-Json
        $hit = @($doc.rungs) | Where-Object { $_.ws -like "wss://*" } | Select-Object -First 1 -ExpandProperty ws
        if ($hit) { $env:IRIS_TUNNEL_WS = $hit }
      } catch { }
    }
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) { $node = "node" }
    Start-Process -FilePath $node -ArgumentList @((Join-Path $root "packages\host\dist\cli.js")) -WorkingDirectory $root -WindowStyle Hidden
    Start-Sleep -Seconds 8
  }
  $desk = Get-Process iris-desktop -ErrorAction SilentlyContinue
  $exe = Join-Path $env:LOCALAPPDATA "Iris\iris-desktop.exe"
  if (-not $desk -and (Test-Path $exe)) {
    Start-Process $exe
  }
  Start-Sleep -Seconds 5
}
