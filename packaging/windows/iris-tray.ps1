# Iris host tray. Shows the pairing code from ~/.iris/pair-code.json.
# Start the host separately (`pnpm --filter @iris/host start`) so this icon does not bind port 7842 twice.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$pairFile = Join-Path $env:USERPROFILE ".iris\pair-code.json"
$code = "------"
if (Test-Path $pairFile) {
  try { $code = (Get-Content $pairFile -Raw | ConvertFrom-Json).code } catch { }
}

$iconPath = Join-Path $PSScriptRoot "..\..\branding\assets\app-icon-512.png"
$baseBmp = $null
if (Test-Path $iconPath) {
  $src = [System.Drawing.Image]::FromFile($iconPath)
  $baseBmp = New-Object System.Drawing.Bitmap 32, 32
  $g0 = [System.Drawing.Graphics]::FromImage($baseBmp)
  $g0.DrawImage($src, 0, 0, 32, 32)
  $g0.Dispose(); $src.Dispose()
}
function Set-TrayIcon([bool]$dot) {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  if ($baseBmp) { $g.DrawImage($baseBmp, 0, 0, 32, 32) } else { $g.Clear([System.Drawing.Color]::FromArgb(255,30,30,30)) }
  if ($dot) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,255,42,42))
    $g.FillEllipse($brush, 18, 2, 12, 12)
    $brush.Dispose()
  }
  $g.Dispose()
  $made = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
  $icon.Icon = $made.Clone()
  $made.Dispose()
}
$icon = New-Object System.Windows.Forms.NotifyIcon
Set-TrayIcon $false
$icon.Visible = $true
$icon.Text = "Iris $code"
$script:seenNotice = 0
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.add_Tick({
  $note = Join-Path $env:USERPROFILE ".iris\notify.json"
  if (-not (Test-Path $note)) { return }
  try { $n = Get-Content $note -Raw | ConvertFrom-Json } catch { return }
  if ($n.at -le $script:seenNotice) { return }
  $script:seenNotice = $n.at
  Set-TrayIcon $true
  $icon.ShowBalloonTip(8000, [string]$n.title, [string]$n.body, [System.Windows.Forms.ToolTipIcon]::None)
})
$timer.Start()
$icon.add_Click({ Set-TrayIcon $false })

function Start-Ide([string]$script, [string]$label) {
  $path = Join-Path $PSScriptRoot $script
  if (-not (Test-Path $path)) {
    [System.Windows.Forms.MessageBox]::Show("$script is missing.", "Iris")
    return
  }
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$path)
  $icon.ShowBalloonTip(4000, "Iris", $label, [System.Windows.Forms.ToolTipIcon]::Info)
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$show = $menu.Items.Add("Pairing code: $code")
$show.add_Click({ [System.Windows.Forms.MessageBox]::Show("Pairing code: $code", "Iris") })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$cursorItem = $menu.Items.Add("Launch Cursor (port 9222)")
$cursorItem.add_Click({ Start-Ide "start-cursor.ps1" "Restarting Cursor on port 9222" })
$antiItem = $menu.Items.Add("Launch Antigravity (port 9000)")
$antiItem.add_Click({ Start-Ide "start-antigravity.ps1" "Restarting Antigravity on port 9000" })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$exit = $menu.Items.Add("Exit")
$exit.add_Click({ $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu
$icon.ShowBalloonTip(4000, "Iris", "Pairing code $code", [System.Windows.Forms.ToolTipIcon]::Info)
[System.Windows.Forms.Application]::Run()
