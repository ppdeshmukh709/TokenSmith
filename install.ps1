# TokenSmith installer for Windows
# Run: iwr https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/ppdeshmukh709/TokenSmith"
$INSTALL_DIR = "$HOME\.claude\TokenSmith"
$SETTINGS = "$HOME\.claude\settings.json"

Write-Host ""
Write-Host "TokenSmith installer" -ForegroundColor Cyan
Write-Host "--------------------" -ForegroundColor Cyan

# 1. Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
  exit 1
}
$nodeVer = (node --version)
Write-Host "Node $nodeVer found" -ForegroundColor Green

# 2. Check git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: git not found. Install from https://git-scm.com" -ForegroundColor Red
  exit 1
}

# 3. Clone or update
if (Test-Path "$INSTALL_DIR\.git") {
  Write-Host "Updating existing install..." -ForegroundColor Yellow
  git -C $INSTALL_DIR pull origin main --quiet
} else {
  Write-Host "Cloning TokenSmith..." -ForegroundColor Yellow
  git clone $REPO $INSTALL_DIR --quiet
}

# 4. npm install
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $INSTALL_DIR
npm install --silent
Pop-Location

# 5. Patch ~/.claude/settings.json
$indexPath = "$INSTALL_DIR\index.js" -replace "\\", "/"

if (Test-Path $SETTINGS) {
  $json = Get-Content $SETTINGS -Raw | ConvertFrom-Json
} else {
  $json = [PSCustomObject]@{}
}

if (-not $json.PSObject.Properties["mcpServers"]) {
  $json | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([PSCustomObject]@{})
}

$json.mcpServers | Add-Member -MemberType NoteProperty -Name "token-saver" -Value ([PSCustomObject]@{
  command = "node"
  args    = @($indexPath)
  env     = [PSCustomObject]@{}
}) -Force

$json | ConvertTo-Json -Depth 10 | Set-Content $SETTINGS -Encoding utf8

# 6. Add rtk function to PowerShell profile
$profilePath = $PROFILE
$profileDir  = Split-Path $profilePath
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Force $profileDir | Out-Null }
if (-not (Test-Path $profilePath)) { New-Item -ItemType File -Force $profilePath | Out-Null }
$existing = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
if ($existing -notmatch "TokenSmith") {
  $rtkPath = "$INSTALL_DIR\rtk.ps1" -replace "\\", "\\"
  Add-Content $profilePath "`n# TokenSmith rtk`nfunction rtk { & '$rtkPath' @args }" -Encoding utf8
  Write-Host "rtk added to PowerShell profile" -ForegroundColor Green
} else {
  Write-Host "rtk already in profile" -ForegroundColor Yellow
}

# 7. Add auto-compress rule to ~/.claude/CLAUDE.md
$claudeMd = "$HOME\.claude\CLAUDE.md"
if (Test-Path $claudeMd) {
  $md = Get-Content $claudeMd -Raw
  if ($md -notmatch "TokenSmith") {
    Add-Content $claudeMd "`n## TokenSmith`nCall the compress() MCP tool on any Read/Grep/Search/Bash result over 5 KB before using it in context." -Encoding utf8
    Write-Host "Auto-compress rule added to CLAUDE.md" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Done! TokenSmith installed to $INSTALL_DIR" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: Restart Claude Code + open a new terminal" -ForegroundColor Cyan
Write-Host "Then use: rtk git status / rtk gain / rtk dashboard" -ForegroundColor Cyan
Write-Host "In Claude: compress(), stats(), history()" -ForegroundColor Cyan
Write-Host ""
