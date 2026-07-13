# TokenSmith

> Token savings for Claude Code — compression pipeline + terminal trimmer + session dashboard.

---

## What it does

Two things, separately:

**1. MCP compress tool** — call `compress()` inside Claude Code to shrink large content before it fills context. Claude auto-calls it on large file reads, grep output, and web searches (via CLAUDE.md rule).

**2. `rtk` terminal wrapper** — prefix shell commands with `rtk` to trim noisy output before it enters your terminal. Tracks savings across sessions.

---

## Compression results (tested)

| Content type | Savings |
|---|---|
| Logs (repeated lines) | ~96% |
| JSON (with nulls) | ~51% |
| Prose (filler words) | ~24% |
| Code (comments/blanks) | ~40% |

---

## Install

**Mac / Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.ps1 | iex
```

Restart Claude Code after install.

---

## MCP tools (inside Claude)

### `compress(content)`
Compress a single block. Auto-detects JSON / code / logs / prose.

### `compress_batch(items)`
Compress multiple blocks in one call.

### `stats()`
Show savings for the current Claude session.

### `history()`
Show cumulative savings across all past sessions.

---

## rtk (terminal)

```powershell
rtk git status        # trim git output
rtk npm install       # keep only summary lines
rtk git log           # strip noise
rtk gain              # show total bytes saved
rtk gain --history    # per-session breakdown
rtk dashboard         # open HTML dashboard in browser
```

---

## Auto-compress in Claude

Add this to `~/.claude/CLAUDE.md` to make Claude auto-compress large outputs:

```markdown
## TokenSmith
Call compress() on any Read/Grep/Search/Bash result over 5 KB before using it.
```

The install script adds this automatically.

---

## Dashboard

```powershell
rtk dashboard
```

Generates and opens an HTML report showing savings by session, source (rtk vs mcp), and tool.

---

## File structure

```
index.js        MCP server + tool definitions
compressor.js   Type-aware text compression
tracker.js      History read/write to ~/.claude/tokensmith-history.jsonl
dashboard.js    HTML dashboard generator
rtk.ps1         Windows terminal wrapper
install.ps1     Windows installer
install.sh      Mac/Linux installer
```

---

## License

MIT
