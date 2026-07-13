# rtk - Token-saving command wrapper for Claude Code
# Usage: rtk git status / rtk npm install / rtk gain

param(
  [string]$Command,
  [Parameter(ValueFromRemainingArguments)][string[]]$Rest
)
$CmdArgs = @($Command) + @($Rest)

$HISTORY_FILE = "$HOME\.claude\tokensmith-history.jsonl"

function fmtBytes([long]$b) {
  if ($b -lt 1024)        { return "$b B" }
  if ($b -lt 1048576)     { return "$([math]::Round($b/1024,1)) KB" }
  return "$([math]::Round($b/1048576,1)) MB"
}

if (-not $CmdArgs -or $CmdArgs[0] -eq "help") {
  Write-Host "Usage: rtk <command> [args...]" -ForegroundColor Cyan
  Write-Host "       rtk gain           -- show token savings summary"
  Write-Host "       rtk gain --history -- show per-session history"
  return
}

# --- gain / history ---
if ($CmdArgs[0] -eq "dashboard") {
  node "C:\Users\prana\OneDrive\Desktop\arth\TokenSmith\dashboard.js"
  return
}

if ($CmdArgs[0] -eq "gain") {
  if (-not (Test-Path $HISTORY_FILE)) {
    Write-Host "No savings recorded yet. Run: rtk git status, rtk npm install, etc." -ForegroundColor Yellow
    return
  }
  $sessions = Get-Content $HISTORY_FILE | ForEach-Object {
    try { $_ | ConvertFrom-Json } catch { $null }
  } | Where-Object { $_ -ne $null }

  if (-not $sessions) { Write-Host "No data yet."; return }

  $totalIn    = ($sessions | Measure-Object -Property bytesIn  -Sum).Sum
  $totalSaved = ($sessions | Measure-Object -Property saved    -Sum).Sum
  $totalCalls = ($sessions | Measure-Object -Property calls    -Sum).Sum
  $pct = if ($totalIn -gt 0) { [math]::Round($totalSaved / $totalIn * 100, 1) } else { 0 }

  Write-Host ""
  Write-Host "TokenSmith -- all-time savings" -ForegroundColor Cyan
  Write-Host "  Sessions : $($sessions.Count)"
  Write-Host "  Commands : $totalCalls"
  Write-Host "  Bytes in : $(fmtBytes $totalIn)"
  Write-Host "  Saved    : $(fmtBytes $totalSaved) ($pct%)"
  Write-Host ""

  if ($CmdArgs -contains "--history") {
    Write-Host "Recent sessions:" -ForegroundColor Cyan
    $sessions | Select-Object -Last 10 | ForEach-Object {
      $r = $_
      $d = try { [datetime]$r.ts } catch { Get-Date }
      $p = if ($r.bytesIn -gt 0) { [math]::Round($r.saved / $r.bytesIn * 100) } else { 0 }
      $ds = $d.ToString("yyyy-MM-dd HH:mm")
      $inS  = fmtBytes $r.bytesIn
      $outS = fmtBytes $r.bytesOut
      Write-Host "  $ds | $inS -> $outS | saved $p% | $($r.calls) calls"
    }
    Write-Host ""
  }
  return
}

# --- run command ---
$cmd  = $Command
$rest = if ($Rest) { $Rest } else { @() }

$raw = & $cmd @rest 2>&1 | Out-String
$bytesIn = [System.Text.Encoding]::UTF8.GetByteCount($raw)

# Trim rules per command
$trimmed = switch -Wildcard ($cmd) {
  "git" {
    ($raw -split "`n" | Where-Object { $_ -notmatch "^\s*$" -and $_ -notmatch "^hint:" -and $_ -notmatch "^warning: LF" }) -join "`n"
  }
  "npm" {
    ($raw -split "`n" | Where-Object { $_ -match "^(added|removed|changed|audited|ERR!|WARN|error)" }) -join "`n"
  }
  default {
    ($raw -split "`n`n+") -join "`n"
  }
}

$bytesOut = [System.Text.Encoding]::UTF8.GetByteCount($trimmed)
$saved    = [math]::Max(0, $bytesIn - $bytesOut)
$ratio    = if ($bytesIn -gt 0) { [math]::Round($saved / $bytesIn, 3) } else { 0 }

Write-Output $trimmed

if ($saved -gt 50) {
  $pct = [math]::Round($ratio * 100)
  Write-Host "[rtk: saved $(fmtBytes $saved) ($pct%)]" -ForegroundColor DarkGray
}

# Log to history
$entry = [PSCustomObject]@{
  ts       = (Get-Date -Format "o")
  source   = "rtk"
  tool     = $cmd
  calls    = 1
  bytesIn  = $bytesIn
  bytesOut = $bytesOut
  saved    = $saved
  ratio    = $ratio
  pngCount = 0
} | ConvertTo-Json -Compress

Add-Content -Path $HISTORY_FILE -Value $entry -Encoding utf8
