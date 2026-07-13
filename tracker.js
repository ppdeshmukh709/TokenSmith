// Persistent token savings tracker — appends to ~/.claude/tokensmith-history.jsonl
import { appendFileSync, readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HISTORY_FILE = join(homedir(), '.claude', 'tokensmith-history.jsonl');

export function saveSession(stats) {
  if (stats.calls === 0) return;
  const entry = {
    ts: new Date().toISOString(),
    source: 'mcp',
    tool: 'compress',
    calls: stats.calls,
    bytesIn: stats.bytesIn,
    bytesOut: stats.bytesOut,
    saved: stats.bytesIn - stats.bytesOut,
    ratio: stats.bytesIn > 0 ? ((stats.bytesIn - stats.bytesOut) / stats.bytesIn) : 0,
    pngCount: stats.pngCount
  };
  appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

export function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  return readFileSync(HISTORY_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

export function summarizeHistory(sessions) {
  if (!sessions.length) return null;
  return {
    totalSessions: sessions.length,
    totalCalls: sessions.reduce((s, r) => s + r.calls, 0),
    totalBytesIn: sessions.reduce((s, r) => s + r.bytesIn, 0),
    totalBytesSaved: sessions.reduce((s, r) => s + r.saved, 0),
    totalPNGs: sessions.reduce((s, r) => s + r.pngCount, 0),
    avgRatio: sessions.reduce((s, r) => s + r.ratio, 0) / sessions.length,
    firstSession: sessions[0].ts,
    lastSession: sessions[sessions.length - 1].ts
  };
}
