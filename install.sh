#!/bin/bash
# TokenSmith installer for Mac/Linux
# Run: curl -sSL https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.sh | bash

set -e

REPO="https://github.com/ppdeshmukh709/TokenSmith"
INSTALL_DIR="$HOME/.claude/TokenSmith"
SETTINGS="$HOME/.claude/settings.json"

echo ""
echo "TokenSmith installer"
echo "--------------------"

# 1. Check Node
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "Node $(node --version) found"

# 2. Check git
if ! command -v git &>/dev/null; then
  echo "ERROR: git not found."
  exit 1
fi

# 3. Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install..."
  git -C "$INSTALL_DIR" pull origin main -q
else
  echo "Cloning TokenSmith..."
  git clone "$REPO" "$INSTALL_DIR" -q
fi

# 4. npm install
echo "Installing dependencies..."
(cd "$INSTALL_DIR" && npm install --silent)

# 5. Patch ~/.claude/settings.json
INDEX_PATH="$INSTALL_DIR/index.js"
mkdir -p "$(dirname "$SETTINGS")"

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

# Use node to safely patch the JSON
node -e "
const fs = require('fs');
const path = '$SETTINGS';
const indexPath = '$INDEX_PATH';
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers['token-saver'] = { command: 'node', args: [indexPath], env: {} };
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
"

echo ""
echo "Done! TokenSmith installed to $INSTALL_DIR"
echo ""
echo "NEXT: Restart Claude Code"
echo "Then use: compress(), compress_batch(), stats(), history()"
echo ""
