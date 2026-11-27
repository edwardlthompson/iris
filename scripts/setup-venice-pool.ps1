# Point Iris at Venice's OpenAI-compatible API. No LiteLLM process required.
# Usage: $env:VENICE_API_KEY = "your key"; powershell -File scripts/setup-venice-pool.ps1
$ErrorActionPreference = "Stop"
$key = [Environment]::GetEnvironmentVariable("VENICE_API_KEY")
if (-not $key) { $key = $env:VENICE_API_KEY }
if (-not $key) {
  Write-Error "Set VENICE_API_KEY in the environment, then run this again. The key is not stored in the repo."
}
$dir = Join-Path $env:USERPROFILE ".iris"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Set-Content -Path (Join-Path $dir "litellm.env") -Encoding utf8 -Value "LITELLM_MASTER_KEY=$key"
$cfg = @{
  enabled = $true
  proxyUrl = "https://api.venice.ai/api/v1"
  defaultModel = "claude-sonnet-5-5"
  pools = @("venice")
  monthlyCapUsd = 25
} | ConvertTo-Json
Set-Content -Path (Join-Path $dir "pool.json") -Encoding utf8 -Value $cfg
try {
  $res = Invoke-WebRequest -Uri "https://api.venice.ai/api/v1/models" -Headers @{ Authorization = "Bearer $key" } -UseBasicParsing -TimeoutSec 20
  $ids = @((($res.Content | ConvertFrom-Json).data) | ForEach-Object { $_.id }) 
  "Venice is reachable. $($ids.Count) models. Iris pool.json is enabled."
  $ids | Select-Object -First 12
} catch {
  "Config written, but Venice did not answer: $($_.Exception.Message)"
}
