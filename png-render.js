// PNG renderer for large content that survives text compression
// Uses sharp for lightweight PNG generation on Windows
// Falls back to pxpipe if available

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHAR_W = 6;     // pixels per char (monospace 5x8 Spleen-style)
const CHAR_H = 10;
const COLS = 200;
const PAD = 8;
const BG = '#0d1117';
const FG = '#c9d1d9';
const MAX_LINES = 600;

// Check if pxpipe is available
function hasPxpipe() {
  try { execSync('pxpipe --version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// Render text to PNG using node-canvas
export async function renderToPNG(text) {
  if (hasPxpipe()) return renderViaPxpipe(text);
  return renderViaCanvas(text);
}

async function renderViaPxpipe(text) {
  // Write to temp file, pipe through pxpipe
  const tmp = join(tmpdir(), `ts-${Date.now()}.txt`);
  writeFileSync(tmp, text, 'utf8');
  try {
    const buf = execSync(`pxpipe render --file "${tmp}" --format png`, { maxBuffer: 10 * 1024 * 1024 });
    return buf; // raw PNG buffer
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

async function renderViaCanvas(text) {
  // Try lazy-loading canvas (optional dep)
  let createCanvas;
  try {
    ({ createCanvas } = await import('canvas'));
  } catch {
    throw new Error('Neither pxpipe nor canvas is available. Install canvas: npm install canvas');
  }

  const lines = text
    .split('\n')
    .flatMap(line => {
      const chunks = [];
      for (let i = 0; i < line.length; i += COLS) chunks.push(line.slice(i, i + COLS));
      return chunks.length ? chunks : [''];
    })
    .slice(0, MAX_LINES);

  const W = COLS * CHAR_W + PAD * 2;
  const H = lines.length * CHAR_H + PAD * 2;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = FG;
  ctx.font = `${CHAR_H - 2}px monospace`;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], PAD, PAD + (i + 1) * CHAR_H - 2);
  }

  return canvas.toBuffer('image/png');
}

// Estimate if PNG encoding is worth it
// pxpipe rule: ~3.1 chars per vision-token vs 3.5 chars per text-token
// PNG wins when content > ~800 chars after text compression
export function shouldUsePNG(text) {
  return text.length > 800;
}
