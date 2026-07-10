#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { compress } from './compressor.js';
import { renderToPNG, shouldUsePNG } from './png-render.js';
import { saveSession, loadHistory, summarizeHistory } from './tracker.js';

const server = new Server(
  { name: 'token-saver', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'compress',
      description: 'Compress large text content to save tokens. Pass any large tool output, file content, logs, or JSON. Returns compressed text or a PNG image if text compression is insufficient. Use this before storing large content in context.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The content to compress' },
          force_png: { type: 'boolean', description: 'Force PNG output regardless of size', default: false }
        },
        required: ['content']
      }
    },
    {
      name: 'compress_batch',
      description: 'Compress multiple content blocks at once. More efficient than calling compress repeatedly.',
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, content: { type: 'string' } }, required: ['content'] }
          }
        },
        required: ['items']
      }
    },
    {
      name: 'stats',
      description: 'Show token savings for this session.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'history',
      description: 'Show cumulative token savings across all past sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          last: { type: 'number', description: 'Show only the last N sessions (default: all)' }
        }
      }
    }
  ]
}));

const sessionStats = { calls: 0, bytesIn: 0, bytesOut: 0, pngCount: 0 };

// Save session on exit
process.on('exit', () => saveSession(sessionStats));
process.on('SIGINT', () => { saveSession(sessionStats); process.exit(); });
process.on('SIGTERM', () => { saveSession(sessionStats); process.exit(); });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'compress') return handleCompress(args.content, args.force_png ?? false);

  if (name === 'compress_batch') {
    const results = await Promise.all(args.items.map(i => handleCompress(i.content, false, i.id)));
    return { content: [{ type: 'text', text: results.map(r => r.content[0].text).join('\n\n---\n\n') }] };
  }

  if (name === 'stats') {
    const saved = sessionStats.bytesIn - sessionStats.bytesOut;
    const pct = sessionStats.bytesIn > 0 ? ((saved / sessionStats.bytesIn) * 100).toFixed(1) : '0';
    return {
      content: [{
        type: 'text',
        text: [
          'TokenSmith — this session:',
          `  Compressions : ${sessionStats.calls}`,
          `  Input        : ${fmt(sessionStats.bytesIn)}`,
          `  Output       : ${fmt(sessionStats.bytesOut)}`,
          `  Saved        : ${fmt(saved)} (${pct}%)`,
          `  PNG renders  : ${sessionStats.pngCount}`
        ].join('\n')
      }]
    };
  }

  if (name === 'history') {
    const all = loadHistory();
    const sessions = args?.last ? all.slice(-args.last) : all;
    const s = summarizeHistory(sessions);

    if (!s) return { content: [{ type: 'text', text: 'No history yet. Run some compressions first.' }] };

    const lines = [
      `TokenSmith — all-time savings (${s.totalSessions} sessions):`,
      `  Total compressions : ${s.totalCalls}`,
      `  Total input        : ${fmt(s.totalBytesIn)}`,
      `  Total saved        : ${fmt(s.totalBytesSaved)} (${(s.avgRatio * 100).toFixed(1)}% avg)`,
      `  PNG renders        : ${s.totalPNGs}`,
      `  First session      : ${new Date(s.firstSession).toLocaleDateString()}`,
      `  Last session       : ${new Date(s.lastSession).toLocaleDateString()}`,
      '',
      'Recent sessions:'
    ];

    sessions.slice(-10).reverse().forEach(r => {
      lines.push(`  ${new Date(r.ts).toLocaleString().padEnd(20)} | ${fmt(r.bytesIn).padStart(8)} → ${fmt(r.bytesOut).padStart(8)} | saved ${(r.ratio * 100).toFixed(0).padStart(3)}% | ${r.calls} calls`);
    });

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function handleCompress(content, forcePNG = false, id = null) {
  sessionStats.calls++;
  sessionStats.bytesIn += content.length;

  const prefix = id ? `[${id}] ` : '';
  const { compressed, ratio, type } = compress(content);
  const label = `${prefix}[${type} ${(ratio * 100).toFixed(0)}%→]`;

  if (forcePNG || shouldUsePNG(compressed)) {
    try {
      const pngBuf = await renderToPNG(compressed);
      sessionStats.bytesOut += pngBuf.length;
      sessionStats.pngCount++;
      const b64 = pngBuf.toString('base64');
      const estTokens = Math.ceil(pngBuf.length / 750);
      return {
        content: [
          { type: 'text', text: `${label}[→PNG ~${estTokens} vision tokens | original: ${fmt(content.length)}]` },
          { type: 'image', data: b64, mimeType: 'image/png' }
        ]
      };
    } catch (err) {
      sessionStats.bytesOut += compressed.length;
      return { content: [{ type: 'text', text: `${label}[PNG failed: ${err.message}]\n${compressed}` }] };
    }
  }

  sessionStats.bytesOut += compressed.length;
  return { content: [{ type: 'text', text: `${label}\n${compressed}` }] };
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const transport = new StdioServerTransport();
await server.connect(transport);
