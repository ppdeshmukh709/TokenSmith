# TokenSmith

> Cut Claude Code token usage by 45–80% with a two-stage compression pipeline — install in 2 minutes, works transparently as an MCP server.

---

## How it works

Every large tool output (bash results, file reads, grep output, JSON responses) burns tokens before Claude even starts reasoning. TokenSmith intercepts that content and compresses it in two stages:

```
Large content
     │
     ▼
Stage 1: Text compression (type-aware)
     │
     ├── JSON     → strip nulls, collapse whitespace       ~55% smaller
     ├── Code     → strip comments, blank lines            ~40% smaller
     ├── Logs     → deduplicate repeated lines             ~60% smaller
     └── Prose    → remove filler words, collapse spacing  ~30% smaller
     │
     ▼
Still large? (> 800 chars)
     │
     ▼
Stage 2: PNG encoding via pxpipe
     │    Dense 5×8 bitmap font, 200 cols, dark theme
     │    Claude reads it via vision tokens instead
     │    ~75–80% total savings vs original
     │
     ▼
Claude Code (smaller context, lower cost)
```

---

## Token savings

| Content type | Text only | Text + PNG |
|---|---|---|
| JSON | ~55% | ~75% |
| Code / AST | ~40% | ~70% |
| Logs | ~60% | ~78% |
| Prose | ~30% | ~65% |

Real example: a 3,000-char JSON payload compresses to 1,350 chars after Stage 1 (55% saved), before PNG even runs.

---

## Requirements

- Node.js 18+
- Claude Code (any version)
- [pxpipe](https://pxpipe.dev) *(optional — enables Stage 2 PNG encoding)*

---

## Install

One command — clones, installs deps, and patches `~/.claude/settings.json` automatically.

**Mac / Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr https://raw.githubusercontent.com/ppdeshmukh709/TokenSmith/main/install.ps1 | iex
```

Restart Claude Code. Done.

---

### Manual install (optional)

```bash
git clone https://github.com/ppdeshmukh709/TokenSmith ~/.claude/TokenSmith
cd ~/.claude/TokenSmith
npm install
```

Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "token-saver": {
      "command": "node",
      "args": ["/Users/yourname/.claude/TokenSmith/index.js"]
    }
  }
}
```

Restart Claude Code.

---

## Tools

### `compress`

Compress a single block of content. Auto-detects type (JSON / code / logs / prose).

```
compress(content: "...large string...")
```

Returns compressed text, or a PNG image block if the content is still large after text compression. Output includes a header showing the detected type and compression ratio.

### `compress_batch`

Compress multiple blocks in one call — more efficient than calling `compress` repeatedly.

```
compress_batch(items: [
  { id: "bash_output", content: "..." },
  { id: "file_read",   content: "..." }
])
```

### `stats`

Show cumulative savings for the current session.

```
stats()
```

Sample output:
```
Token-saver session stats:
  Compressions: 12
  Input size:   142.3KB
  Output size:  61.4KB
  Saved:        80.9KB (56.8%)
  PNG renders:  3
```

---

## Usage tips

- Call `compress()` on any large bash output before reasoning over it
- Use `compress_batch()` when reading multiple files in one go
- Check `stats()` at the end of a long session to see total savings
- PNG stage only activates for content > 800 chars after text compression — short outputs pass through instantly with no overhead

---

## File structure

```
index.js          MCP server, tool definitions, session stats
compressor.js     Type detection + content-aware text compression
png-render.js     PNG encoding via pxpipe (canvas fallback if pxpipe unavailable)
```

---

## Built on

- [Headroom](https://github.com/headroomlabs-ai/headroom) — compression heuristics and architecture inspiration
- [pxpipe](https://pxpipe.dev) — PNG rendering stage (5×8 Spleen bitmap font, Claude-optimized profiles)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server protocol

---

## License

MIT
