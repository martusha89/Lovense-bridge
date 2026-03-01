#!/usr/bin/env node

/**
 * Lovense Bridge - Local MCP Proxy
 *
 * Proxies to your cloud worker with authentication.
 * 6 tools: pair, status, control, edge, preset, stop.
 * Universal toy support — any motor combination.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const WORKER_URL = process.env.LOVENSE_WORKER_URL;
const API_SECRET = process.env.LOVENSE_API_SECRET;

if (!WORKER_URL) { console.error('ERROR: LOVENSE_WORKER_URL not set'); process.exit(1); }
if (!API_SECRET) { console.error('ERROR: LOVENSE_API_SECRET not set'); process.exit(1); }

const server = new McpServer({ name: 'lovense-bridge', version: '2.0.0' });

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

// ============ SHARED SCHEMAS ============

const toySchema = z.string().optional().describe('Target specific toy by ID (empty = all toys)');

// ============ TOOLS ============

server.tool('pair', 'Generate QR code for pairing. Scan with Lovense Remote app.', {},
  async () => wrap(await callAPI('/api/pair'))
);

server.tool('status', 'Check connected toys, their types, battery levels, and capabilities. Use this to know what motors are available.', {},
  async () => wrap(await callAPI('/api/status'))
);

server.tool('control',
  `Control the toy. Set any combination of motors — vibrate, vibrate2, thrust, rotate, suction — based on what the connected toy supports. Check 'status' first to see capabilities.

Modes:
- 'constant': Steady at set intensities
- 'pulse': Rhythmic on/off (set on_sec/off_sec)
- 'pattern': Custom intensity sequence (semicolon-separated values)
- 'escalate': Gradual build from start_intensity to end_intensity`,
  {
    vibrate: z.number().min(0).max(20).optional().describe('Vibration intensity 0-20 (main motor)'),
    vibrate2: z.number().min(0).max(20).optional().describe('Second vibration motor 0-20 (Dolce, etc.)'),
    thrust: z.number().min(0).max(20).optional().describe('Thrust intensity 0-20 (Gravity, etc.)'),
    rotate: z.number().min(0).max(20).optional().describe('Rotation intensity 0-20 (Nora, etc.)'),
    suction: z.number().min(0).max(20).optional().describe('Suction intensity 0-20'),
    duration: z.number().min(1).max(300).optional().default(10).describe('Duration in seconds'),
    mode: z.enum(['constant', 'pulse', 'pattern', 'escalate']).optional().default('constant').describe('How the stimulation behaves'),
    on_sec: z.number().min(1).max(30).optional().describe('Pulse: seconds on per cycle'),
    off_sec: z.number().min(1).max(30).optional().describe('Pulse: seconds off between cycles'),
    pattern: z.string().optional().describe("Pattern: semicolon-separated intensities e.g. '3;8;15;20;12;5'"),
    interval_ms: z.number().min(100).max(5000).optional().describe('Pattern: ms between intensity steps'),
    start_intensity: z.number().min(0).max(20).optional().describe('Escalate: starting intensity'),
    end_intensity: z.number().min(0).max(20).optional().describe('Escalate: ending intensity'),
    toy: toySchema
  },
  async (params) => wrap(await callAPI('/api/control', params))
);

server.tool('edge',
  'Edging pattern — builds intensity then denies, repeating in cycles. Designed to keep on the edge without release.',
  {
    high: z.number().min(0).max(20).optional().default(18).describe('Peak intensity during build'),
    low: z.number().min(0).max(20).optional().default(3).describe('Denial intensity between peaks'),
    build_sec: z.number().min(1).max(60).optional().default(8).describe('Seconds at peak'),
    deny_sec: z.number().min(1).max(60).optional().default(3).describe('Seconds at denial'),
    cycles: z.number().min(1).max(50).optional().default(5).describe('Number of build/deny cycles'),
    include_thrust: z.boolean().optional().default(false).describe('Include thrusting at same intensities (Gravity etc.)'),
    toy: toySchema
  },
  async (params) => wrap(await callAPI('/api/edge', params))
);

server.tool('preset', 'Run a built-in Lovense vibration pattern', {
  name: z.enum(['pulse', 'wave', 'fireworks', 'earthquake']).optional().default('pulse').describe('Which pattern'),
  duration: z.number().min(1).max(300).optional().default(10).describe('Duration in seconds'),
  toy: toySchema
}, async (params) => wrap(await callAPI('/api/preset', params)));

server.tool('stop', 'Emergency stop. No questions asked.', {
  toy: toySchema
}, async ({ toy }) => wrap(await callAPI('/api/stop', toy ? { toy } : {})));

// ============ START ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
