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

Write-Host ""
Write-Host "Done! TokenSmith installed to $INSTALL_DIR" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: Restart Claude Code" -ForegroundColor Cyan
Write-Host "Then use: compress(), compress_batch(), stats(), history()" -ForegroundColor Cyan
Write-Host ""
