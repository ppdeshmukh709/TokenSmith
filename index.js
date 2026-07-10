#!/usr/bin/env node
// token-saver MCP server
// Pipeline: text → compress → if still large → PNG → return to Claude

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { compress } from './compressor.js';
import { renderToPNG, shouldUsePNG } from './png-render.js';

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
      description: 'Show token savings statistics for this session.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

// Session stats
const sessionStats = { calls: 0, bytesIn: 0, bytesOut: 0, pngCount: 0 };

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'compress') {
    const { content, force_png = false } = args;
    return await handleCompress(content, force_png);
  }

  if (name === 'compress_batch') {
    const results = await Promise.all(
      args.items.map(item => handleCompress(item.content, false, item.id))
    );
    return {
      content: [{
        type: 'text',
        text: results.map(r => r.content[0].text).join('\n\n---\n\n')
      }]
    };
  }

  if (name === 'stats') {
    const saved = sessionStats.bytesIn - sessionStats.bytesOut;
    const ratio = sessionStats.bytesIn > 0
      ? ((saved / sessionStats.bytesIn) * 100).toFixed(1)
      : '0';
    return {
      content: [{
        type: 'text',
        text: [
          `Token-saver session stats:`,
          `  Compressions: ${sessionStats.calls}`,
          `  Input size:   ${fmt(sessionStats.bytesIn)}`,
          `  Output size:  ${fmt(sessionStats.bytesOut)}`,
          `  Saved:        ${fmt(saved)} (${ratio}%)`,
          `  PNG renders:  ${sessionStats.pngCount}`
        ].join('\n')
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function handleCompress(content, forcePNG = false, id = null) {
  sessionStats.calls++;
  sessionStats.bytesIn += content.length;

  const prefix = id ? `[${id}] ` : '';

  // Stage 1: text compression
  const { compressed, ratio, type } = compress(content);
  const label = `${prefix}[compressed:${type} ${(ratio * 100).toFixed(0)}%→]`;

  // Stage 2: PNG if still large
  if (forcePNG || shouldUsePNG(compressed)) {
    try {
      const pngBuf = await renderToPNG(compressed);
      sessionStats.bytesOut += pngBuf.length;
      sessionStats.pngCount++;

      const b64 = pngBuf.toString('base64');
      const estTokens = Math.ceil(pngBuf.length / 750); // ~750 bytes per vision token

      return {
        content: [
          { type: 'text', text: `${label}[→PNG ~${estTokens} vision tokens | original: ${fmt(content.length)}]` },
          { type: 'image', data: b64, mimeType: 'image/png' }
        ]
      };
    } catch (err) {
      // PNG failed, return text compression result
      sessionStats.bytesOut += compressed.length;
      return {
        content: [{ type: 'text', text: `${label}[PNG failed: ${err.message}]\n${compressed}` }]
      };
    }
  }

  sessionStats.bytesOut += compressed.length;
  return {
    content: [{ type: 'text', text: `${label}\n${compressed}` }]
  };
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const transport = new StdioServerTransport();
await server.connect(transport);
