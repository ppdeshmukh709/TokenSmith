<<<<<<< HEAD
# TokenSmith

MCP server for Claude Code that cuts token usage by 45–80% using a two-stage pipeline:

```
Large content → text compression → if still large → PNG encode → Claude
```

## What it does

- **JSON**: removes nulls, collapses whitespace (~55% savings)
- **Code**: strips comments and blank lines (~40% savings)
- **Logs**: deduplicates repeated lines with counters (~60% savings)
- **Prose**: removes filler words, collapses spacing (~30% savings)
- **PNG fallback**: renders remaining large content via pxpipe → vision tokens (~75% savings)

## Install

**Requirements:** Node.js 18+, Claude Code

```bash
git clone https://github.com/YOUR_USERNAME/token-saver
cd token-saver
npm install
```

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "token-saver": {
      "command": "node",
      "args": ["/absolute/path/to/token-saver/index.js"]
    }
  }
}
```

Restart Claude Code. You'll have 3 new tools: `compress`, `compress_batch`, `stats`.

## PNG stage (optional)

Install [pxpipe](https://pxpipe.dev) for the PNG encoding stage. Without it, only text compression runs (still ~40–60% savings).

## Usage

In any Claude Code session, when you get a large tool output:

```
compress(content: "<large bash output / file / JSON>")
```

Or batch multiple at once:

```
compress_batch(items: [{id: "file1", content: "..."}, {id: "logs", content: "..."}])
```

Check session savings:

```
stats()
```

## Token savings

| Content type | Text compression | + PNG stage |
|---|---|---|
| JSON | ~55% | ~75% |
| Code | ~40% | ~70% |
| Logs | ~60% | ~78% |
| Prose | ~30% | ~65% |

## Built with

- [Headroom](https://github.com/headroomlabs-ai/headroom) — compression heuristics inspiration
- [pxpipe](https://github.com/teamchong/pxpipe) — PNG rendering stage
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server
=======
# TokenSmith
>>>>>>> a8854724b55d32655ca6cc872a43ef0b9bbba02e
