#!/usr/bin/env node

/**
 * Lovense Bridge - Local MCP Proxy
 * 
 * Proxies to your cloud worker with authentication.
 * 5 tools: pair, status, control, preset, stop.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const WORKER_URL = process.env.LOVENSE_WORKER_URL;
const API_SECRET = process.env.LOVENSE_API_SECRET;

if (!WORKER_URL) { console.error('ERROR: LOVENSE_WORKER_URL not set'); process.exit(1); }
if (!API_SECRET) { console.error('ERROR: LOVENSE_API_SECRET not set'); process.exit(1); }

const server = new McpServer({ name: 'lovense-bridge', version: '1.0.0' });

async function callAPI(endpoint, data = {}) {
  const response = await fetch(`${WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_SECRET}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

const wrap = (result) => ({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });

// ============ TOOLS ============

server.tool('pair', 'Generate QR code for pairing. Scan with Lovense Remote → Discover → Scan QR.', {},
  async () => wrap(await callAPI('/api/pair'))
);

server.tool('status', 'Check connected toys', {},
  async () => wrap(await callAPI('/api/status'))
);

server.tool('control',
  "Control the toy. Set intensity, duration, and mode. Modes: 'constant', 'pulse', 'pattern', 'escalate'. The AI decides all parameters.",
  {
    intensity: z.number().min(0).max(20).optional().default(10).describe('Strength 0-20'),
    duration: z.number().min(1).max(300).optional().default(10).describe('Seconds'),
    mode: z.enum(['constant', 'pulse', 'pattern', 'escalate']).optional().default('constant').describe('How vibration behaves'),
    on_sec: z.number().min(1).max(30).optional().describe('Pulse: seconds on'),
    off_sec: z.number().min(1).max(30).optional().describe('Pulse: seconds off'),
    pattern: z.string().optional().describe("Pattern: semicolon-separated intensities e.g. '3;8;15;20;12;5'"),
    interval_ms: z.number().min(100).max(5000).optional().describe('Pattern: ms between changes'),
    start_intensity: z.number().min(0).max(20).optional().describe('Escalate: start'),
    end_intensity: z.number().min(0).max(20).optional().describe('Escalate: end')
  },
  async (params) => wrap(await callAPI('/api/control', params))
);

server.tool('preset', 'Built-in Lovense pattern', {
  name: z.enum(['pulse', 'wave', 'fireworks', 'earthquake']).optional().default('pulse').describe('Which pattern'),
  duration: z.number().min(1).max(300).optional().default(10).describe('Seconds')
}, async ({ name, duration }) => wrap(await callAPI('/api/preset', { name, duration })));

server.tool('stop', 'Emergency stop', {},
  async () => wrap(await callAPI('/api/stop'))
);

// ============ START ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
