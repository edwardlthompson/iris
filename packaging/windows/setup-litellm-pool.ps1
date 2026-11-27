<#
.SYNOPSIS
Configure LiteLLM + Venice + Iris-Pool for Iris, start 127.0.0.1:4000, smoke-test, and reload Iris host.
#>
param(
  [string]$VeniceKey = "",
  [string]$IrisPoolKey = "",
  [string]$OpenRouterKey = "",
  [double]$MonthlyCapUsd = 25,
  [string]$DefaultModel = "",
  [switch]$EnableAutostart,
  [switch]$SkipRestartHost,
  [switch]$ForcePrompt
)
$ErrorActionPreference = "Stop"

$IrisDir = Join-Path $env:USERPROFILE ".iris"
$EnvPath = Join-Path $IrisDir "litellm.env"
$CfgPath = Join-Path $IrisDir "litellm-config.yaml"
$PoolPath = Join-Path $IrisDir "pool.json"
$PairPath = Join-Path $IrisDir "pair-code.json"
$StartScript = Join-Path $PSScriptRoot "start-litellm.ps1"
$AutostartScript = Join-Path $PSScriptRoot "install-litellm-autostart.ps1"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Read-SecretPrompt([string]$Label) {
  $sec = Read-Host -Prompt $Label -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-EnvMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  foreach ($line in Get-Content $Path -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }
    $k = $t.Substring(0, $idx).Trim()
    $v = $t.Substring($idx + 1).Trim().Trim('"').Trim("'")
    if ($v) { $map[$k] = $v }
  }
  return $map
}

$MasterKey = ""
if (-not $ForcePrompt -and (Test-Path $EnvPath)) {
  $existing = Read-EnvMap $EnvPath
  if (-not $VeniceKey -and $existing.ContainsKey("VENICE_API_KEY")) { $VeniceKey = $existing["VENICE_API_KEY"] }
  if (-not $OpenRouterKey -and $existing.ContainsKey("OPENROUTER_API_KEY")) { $OpenRouterKey = $existing["OPENROUTER_API_KEY"] }
  if (-not $IrisPoolKey -and $existing.ContainsKey("LITELLM_MASTER_KEY")) { $MasterKey = $existing["LITELLM_MASTER_KEY"] }
  if ($VeniceKey -and $MasterKey) {
    Write-Host "Reusing saved keys from $EnvPath (pass -ForcePrompt to enter new keys)."
  }
}

if (-not $VeniceKey) { $VeniceKey = Read-SecretPrompt "Enter your Venice API key (from venice.ai/settings/api)" }
if (-not $VeniceKey) { throw "Venice API key is required." }

if (-not $MasterKey) {
  if (-not $IrisPoolKey) { $IrisPoolKey = Read-SecretPrompt "Enter your Iris-Pool key (LiteLLM virtual/master key or OpenRouter sk-or-... key)" }
  if (-not $IrisPoolKey) { throw "Iris-Pool key is required." }
  if ($IrisPoolKey.StartsWith("sk-or-", [StringComparison]::OrdinalIgnoreCase)) {
    if (-not $OpenRouterKey) { $OpenRouterKey = $IrisPoolKey }
    $rand = -join ((1..24) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
    $MasterKey = "sk-iris-$rand"
    Write-Host "Detected OpenRouter key (sk-or-...); generated local LITELLM_MASTER_KEY in $EnvPath."
  } else {
    $MasterKey = $IrisPoolKey
  }
}

New-Item -ItemType Directory -Force -Path $IrisDir | Out-Null
$envLines = @(
  "# Iris LiteLLM secrets — restricted to $env:USERNAME",
  "LITELLM_MASTER_KEY=$MasterKey",
  "VENICE_API_KEY=$VeniceKey"
)
if ($OpenRouterKey) { $envLines += "OPENROUTER_API_KEY=$OpenRouterKey" }
[IO.File]::WriteAllLines($EnvPath, $envLines, [Text.UTF8Encoding]::new($false))
& icacls $EnvPath /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null

# Discover all live Venice text/chat models (including Claude, GPT-6/5, Grok, DeepSeek, Qwen, Gemini)
$veniceModels = @()
try {
  $resp = Invoke-RestMethod "https://api.venice.ai/api/v1/models?type=text" -Headers @{ Authorization = "Bearer $VeniceKey" } -TimeoutSec 15
  if ($resp.data) {
    $veniceModels = @($resp.data | ForEach-Object { $_.id } | Where-Object { $_ } | Select-Object -Unique)
    Write-Host "Discovered $($veniceModels.Count) Venice text models."
  }
} catch {
  Write-Warning "Could not query https://api.venice.ai/api/v1/models?type=text ($($_.Exception.Message)); using wildcard venice/* route."
}

if (-not $DefaultModel) {
  $preferred = @("claude-sonnet-5-5", "claude-opus-5-5", "openai-gpt-62-sol", "qwen-4-max", "gemini-3-8-flash", "gemini-4-carbon", "deepseek-v4-pro", "llama-3.3-70b")
  $pick = $preferred | Where-Object { $veniceModels -contains $_ } | Select-Object -First 1
  if ($pick) { $DefaultModel = "venice/$pick" }
  elseif ($veniceModels.Count -gt 0) { $DefaultModel = "venice/$($veniceModels[0])" }
  else { $DefaultModel = "venice/llama-3.3-70b" }
}

$yaml = [System.Collections.Generic.List[string]]::new()
$yaml.Add("# Iris LiteLLM pool config — bound strictly to 127.0.0.1:4000")
$yaml.Add("general_settings:")
$yaml.Add("  master_key: os.environ/LITELLM_MASTER_KEY")
$yaml.Add("litellm_settings:")
$yaml.Add("  drop_params: true")
$yaml.Add("model_list:")
$yaml.Add("  - model_name: venice/*")
$yaml.Add("    litellm_params:")
$yaml.Add("      model: openai/*")
$yaml.Add("      api_base: https://api.venice.ai/api/v1")
$yaml.Add("      api_key: os.environ/VENICE_API_KEY")
foreach ($m in $veniceModels) {
  $yaml.Add("  - model_name: venice/$m")
  $yaml.Add("    litellm_params:")
  $yaml.Add("      model: openai/$m")
  $yaml.Add("      api_base: https://api.venice.ai/api/v1")
  $yaml.Add("      api_key: os.environ/VENICE_API_KEY")
}
if ($OpenRouterKey) {
  $yaml.Add("  - model_name: openrouter/*")
  $yaml.Add("    litellm_params:")
  $yaml.Add("      model: openrouter/*")
  $yaml.Add("      api_key: os.environ/OPENROUTER_API_KEY")
}
[IO.File]::WriteAllLines($CfgPath, $yaml, [Text.UTF8Encoding]::new($false))

$pools = @("venice")
if ($OpenRouterKey) { $pools += "openrouter" }
$poolJson = @{
  enabled = $true
  proxyUrl = "http://127.0.0.1:4000"
  monthlyCapUsd = $MonthlyCapUsd
  defaultModel = $DefaultModel
  pools = $pools
} | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText($PoolPath, $poolJson + "`n", [Text.UTF8Encoding]::new($false))

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $StartScript -Restart
if ($LASTEXITCODE -ne 0) { throw "LiteLLM failed to start. Check $IrisDir\litellm.log" }

# Smoke-test /v1/models and 1-token chat completion
$hdr = @{ Authorization = "Bearer $MasterKey"; "Content-Type" = "application/json" }
$modelsResp = Invoke-RestMethod "http://127.0.0.1:4000/v1/models" -Headers $hdr -TimeoutSec 10
Write-Host "LiteLLM /v1/models count: $($modelsResp.data.Count)"

$candidates = [System.Collections.Generic.List[string]]::new()
$candidates.Add($DefaultModel)
foreach ($fb in @("claude-sonnet-5-5", "claude-opus-5-5", "openai-gpt-62-sol", "deepseek-v4-1-flash", "gemini-3-8-flash", "gemini-4-carbon")) {
  if (($veniceModels.Count -eq 0 -or $veniceModels -contains $fb) -and "venice/$fb" -ne $DefaultModel) {
    $candidates.Add("venice/$fb")
  }
}
foreach ($m in $veniceModels) {
  if ($candidates.Count -ge 5) { break }
  $full = "venice/$m"
  if (-not ($candidates -contains $full)) { $candidates.Add($full) }
}

$verifiedModel = $null
foreach ($cand in ($candidates | Select-Object -First 5)) {
  try {
    $body = @{ model = $cand; max_tokens = 8; messages = @(@{ role = "user"; content = "Reply with OK" }) } | ConvertTo-Json -Depth 4
    $chatResp = Invoke-RestMethod "http://127.0.0.1:4000/v1/chat/completions" -Method Post -Headers $hdr -Body $body -TimeoutSec 25
    Write-Host "LiteLLM smoke completion ($cand): $($chatResp.choices[0].message.content)"
    $verifiedModel = $cand
    break
  } catch {
    Write-Warning "Smoke completion for $cand returned: $($_.Exception.Message)"
  }
}

if ($verifiedModel -and $verifiedModel -ne $DefaultModel) {
  $DefaultModel = $verifiedModel
  $poolJson = @{
    enabled = $true
    proxyUrl = "http://127.0.0.1:4000"
    monthlyCapUsd = $MonthlyCapUsd
    defaultModel = $DefaultModel
    pools = $pools
  } | ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText($PoolPath, $poolJson + "`n", [Text.UTF8Encoding]::new($false))
  Write-Host "Updated defaultModel in $PoolPath to $DefaultModel"
}

if ($EnableAutostart) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $AutostartScript
}

if (-not $SkipRestartHost) {
  $tunnel = ""
  if (Test-Path $PairPath) {
    try {
      $p = Get-Content $PairPath -Raw | ConvertFrom-Json
      $tunnel = ($p.rungs | Where-Object { $_.rung -eq "tunnel" } | Select-Object -First 1).ws
    } catch {}
  }
  $listen = Get-NetTCPConnection -LocalPort 7842 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listen) { Stop-Process -Id $listen.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 1500
  $respawned = Get-NetTCPConnection -LocalPort 7842 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($respawned) {
    Write-Host "Supervisor respawned @iris/host on :7842 (PID $($respawned.OwningProcess))"
  } else {
    $cmd = if ($tunnel) { "`$env:IRIS_TUNNEL_WS='$tunnel'; Set-Location '$RepoRoot'; pnpm --filter @iris/host start" } else { "Set-Location '$RepoRoot'; pnpm --filter @iris/host start" }
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile", "-Command", $cmd) | Out-Null
    Write-Host "Restarted @iris/host on :7842 (tunnel preserved: $([bool]$tunnel))"
  }
}

Write-Host "Setup complete. Default pool model: $DefaultModel | Monthly cap: `$$MonthlyCapUsd"
