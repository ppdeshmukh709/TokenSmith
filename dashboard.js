#!/usr/bin/env node
// TokenSmith dashboard — generates an HTML report and opens it in the browser
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const HISTORY_FILE = join(homedir(), '.claude', 'tokensmith-history.jsonl');

if (!existsSync(HISTORY_FILE)) {
  console.log('No history yet. Use rtk <cmd> or compress() in Claude to start tracking.');
  process.exit(0);
}

const sessions = readFileSync(HISTORY_FILE, 'utf8')
  .split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

if (!sessions.length) { console.log('No data yet.'); process.exit(0); }

const totalIn    = sessions.reduce((s, r) => s + (r.bytesIn  || 0), 0);
const totalOut   = sessions.reduce((s, r) => s + (r.bytesOut || 0), 0);
const totalSaved = sessions.reduce((s, r) => s + (r.saved    || 0), 0);
const totalCalls = sessions.reduce((s, r) => s + (r.calls    || 0), 0);
const pct = totalIn > 0 ? (totalSaved / totalIn * 100).toFixed(1) : 0;

const rtkSessions = sessions.filter(r => r.source === 'rtk' || (!r.source && !r.auto));
const mcpSessions = sessions.filter(r => r.source === 'mcp');

function fmt(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

const rows = sessions.slice(-30).reverse().map(r => {
  const d = new Date(r.ts).toLocaleString();
  const p = r.bytesIn > 0 ? Math.round(r.saved / r.bytesIn * 100) : 0;
  const src = r.source || (r.auto ? 'hook' : 'rtk');
  const tool = r.tool || 'compress';
  return `<tr>
    <td>${d}</td>
    <td><span class="badge badge-${src}">${src}</span></td>
    <td>${tool}</td>
    <td>${fmt(r.bytesIn)}</td>
    <td>${fmt(r.bytesOut)}</td>
    <td class="${p > 30 ? 'good' : p > 0 ? 'ok' : 'zero'}">${p}%</td>
  </tr>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TokenSmith Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f13; color: #e0e0e0; padding: 32px; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; color: #fff; }
  .sub { color: #888; font-size: 14px; margin-bottom: 32px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .card { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 12px; padding: 20px; }
  .card-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 700; color: #fff; }
  .card-value.green { color: #4ade80; }
  .card-sub { font-size: 12px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 12px; overflow: hidden; }
  th { text-align: left; padding: 12px 16px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #2a2a3a; }
  td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #1e1e2a; }
  tr:last-child td { border-bottom: none; }
  .good { color: #4ade80; font-weight: 600; }
  .ok   { color: #facc15; }
  .zero { color: #666; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  .badge-rtk  { background: #1e3a5f; color: #60a5fa; }
  .badge-mcp  { background: #1e3a2a; color: #4ade80; }
  .badge-hook { background: #2a1a3a; color: #c084fc; }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #fff; }
</style>
</head>
<body>
<h1>TokenSmith</h1>
<div class="sub">Token savings dashboard — ${sessions.length} sessions tracked</div>

<div class="cards">
  <div class="card">
    <div class="card-label">Total Saved</div>
    <div class="card-value green">${fmt(totalSaved)}</div>
    <div class="card-sub">${pct}% reduction</div>
  </div>
  <div class="card">
    <div class="card-label">Total Input</div>
    <div class="card-value">${fmt(totalIn)}</div>
    <div class="card-sub">before compression</div>
  </div>
  <div class="card">
    <div class="card-label">Commands</div>
    <div class="card-value">${totalCalls}</div>
    <div class="card-sub">${rtkSessions.length} rtk · ${mcpSessions.length} mcp</div>
  </div>
  <div class="card">
    <div class="card-label">Sessions</div>
    <div class="card-value">${sessions.length}</div>
    <div class="card-sub">since ${new Date(sessions[0].ts).toLocaleDateString()}</div>
  </div>
</div>

<h2>Recent activity (last 30)</h2>
<table>
  <thead>
    <tr>
      <th>Time</th><th>Source</th><th>Tool</th><th>Input</th><th>Output</th><th>Saved</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

const outFile = join(homedir(), '.claude', 'tokensmith-dashboard.html');
writeFileSync(outFile, html, 'utf8');
console.log(`Dashboard written to ${outFile}`);

// Open in browser
try {
  const open = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  execSync(`${open} "${outFile}"`, { stdio: 'ignore', shell: true });
} catch {}
