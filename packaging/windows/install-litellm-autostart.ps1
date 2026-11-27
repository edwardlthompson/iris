<#
.SYNOPSIS
Register or remove Windows logon Scheduled Task(s) for LiteLLM proxy (and optionally Iris host).
#>
param(
  [switch]$Uninstall,
  [switch]$IncludeIrisHost
)
$ErrorActionPreference = "Stop"

$TaskName = "Iris-LiteLLM-Proxy"
$HostTaskName = "Iris-Host-Daemon"
$StartLiteLlm = (Resolve-Path (Join-Path $PSScriptRoot "start-litellm.ps1")).Path
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ($Uninstall) {
  foreach ($n in @($TaskName, $HostTaskName)) {
    if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $n -Confirm:$false
      Write-Host "Removed Scheduled Task: $n"
    }
  }
  exit 0
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartLiteLlm`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Start local LiteLLM proxy (127.0.0.1:4000) for Iris pool mode." -Force | Out-Null
Write-Host "Installed Scheduled Task: $TaskName (AtLogOn for $env:USERNAME)"

if ($IncludeIrisHost) {
  $hostScript = "Set-Location '$RepoRoot'; pnpm --filter @iris/host start"
  $hAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$hostScript`""
  Register-ScheduledTask -TaskName $HostTaskName -Action $hAction -Trigger $trigger -Settings $settings -Description "Start Iris host daemon (:7842)." -Force | Out-Null
  Write-Host "Installed Scheduled Task: $HostTaskName (AtLogOn for $env:USERNAME)"
}
