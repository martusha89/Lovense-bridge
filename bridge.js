#!/usr/bin/env node

/**
 * Lovense Bridge v3 — Local MCP Server
 *
 * Talks directly to Lovense Connect's local API on your home network.
 * No cloud dependency. No business account needed.
 *
 * Two modes:
 *   --stdio  (default) Claude Desktop, Claude Code
 *   --http   Mobile via Cloudflare Tunnel (custom connector)
 *
 * 6 tools: pair, status, control, edge, preset, stop.
 * Universal toy support — any motor combination.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

// ============ CONFIG ============

const LOCAL_URL = process.env.LOVENSE_LOCAL_URL;
const MCP_SECRET = process.env.MCP_SECRET;
const PORT = parseInt(process.env.PORT || '3456', 10);
const HTTP_MODE = process.argv.includes('--http');

if (!LOCAL_URL) {
  console.error('ERROR: LOVENSE_LOCAL_URL not set');
  console.error('Set it to your Lovense Connect local API, e.g.:');
  console.error('  export LOVENSE_LOCAL_URL=https://192-168-2-16.lovense.club:30010');
  process.exit(1);
}

// ============ LOVENSE LOCAL API ============

async function lovenseGet(endpoint) {
  try {
    const res = await fetch(`${LOCAL_URL}/${endpoint}`);
    return await res.json();
  } catch (err) {
    return { error: `Cannot reach Lovense Connect at ${LOCAL_URL}: ${err.message}` };
  }
}

async function lovenseCommand(body) {
  try {
    const res = await fetch(`${LOCAL_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, apiVer: 1 })
    });
    return await res.json();
  } catch (err) {
    return { error: `Cannot reach Lovense Connect at ${LOCAL_URL}: ${err.message}` };
  }
}

// ============ COMMAND BUILDERS ============

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildActionString(motors) {
  const parts = [];
  if (motors.vibrate !== undefined && motors.vibrate > 0)
    parts.push(`Vibrate:${clamp(motors.vibrate, 0, 20)}`);
  if (motors.vibrate2 !== undefined && motors.vibrate2 > 0)
    parts.push(`Vibrate2:${clamp(motors.vibrate2, 0, 20)}`);
  if (motors.thrust !== undefined && motors.thrust > 0)
    parts.push(`Thrusting:${clamp(motors.thrust, 0, 20)}`);
  if (motors.rotate !== undefined && motors.rotate > 0)
    parts.push(`Rotate:${clamp(motors.rotate, 0, 20)}`);
  if (motors.suction !== undefined && motors.suction > 0)
    parts.push(`Suction:${clamp(motors.suction, 0, 20)}`);
  if (parts.length === 0) parts.push('Vibrate:10');
  return parts.join(',');
}

function buildCommand(params) {
  const duration = clamp(params.duration ?? 10, 1, 300);
  const mode = params.mode || 'constant';
  const action = buildActionString(params);

  switch (mode) {
    case 'constant':
      return { command: 'Function', action, timeSec: duration, toy: params.toy };

    case 'pulse':
      return {
        command: 'Function', action, timeSec: duration,
        loopRunningSec: clamp(params.on_sec ?? 2, 1, 30),
        loopPauseSec: clamp(params.off_sec ?? 1, 1, 30),
        toy: params.toy
      };

    case 'pattern': {
      const raw = params.pattern || '5;10;15;20;15;10;5';
      const values = raw.split(';').map(v => clamp(parseInt(v) || 0, 0, 20));
      return {
        command: 'Pattern',
        rule: `V:1;F:v;S:${clamp(params.interval_ms ?? 500, 100, 5000)}#`,
        strength: values.join(';'),
        timeSec: duration,
        toy: params.toy
      };
    }

    case 'escalate': {
      const start = clamp(params.start_intensity ?? 3, 0, 20);
      const end = clamp(params.end_intensity ?? 18, 0, 20);
      const steps = 10;
      const stepSize = (end - start) / steps;
      const strengths = [];
      for (let i = 0; i <= steps; i++) {
        strengths.push(Math.round(start + (stepSize * i)));
      }
      return {
        command: 'Pattern',
        rule: `V:1;F:v;S:${Math.max(100, Math.floor((duration * 1000) / (steps + 1)))}#`,
        strength: strengths.join(';'),
        timeSec: duration,
        toy: params.toy
      };
    }

    default:
      return { command: 'Function', action, timeSec: duration, toy: params.toy };
  }
}

function buildEdgeCommand(params) {
  const high = clamp(params.high ?? 18, 0, 20);
  const buildSec = clamp(params.build_sec ?? 8, 1, 60);
  const denySec = clamp(params.deny_sec ?? 3, 1, 60);
  const cycles = clamp(params.cycles ?? 5, 1, 50);
  const totalDuration = (buildSec + denySec) * cycles;

  let action = `Vibrate:${high}`;
  if (params.include_thrust) action += `,Thrusting:${high}`;

  return {
    command: 'Function', action, timeSec: totalDuration,
    loopRunningSec: buildSec, loopPauseSec: denySec,
    toy: params.toy
  };
}

// ============ SERVER FACTORY ============

function createServer() {
  const server = new McpServer({ name: 'lovense-bridge', version: '3.0.0' });
  const wrap = (result) => ({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  const toySchema = z.string().optional().describe('Target specific toy by ID (empty = all toys)');

  server.tool(
    'pair',
    'Instructions for pairing a toy. Lovense Connect app handles pairing directly.',
    {},
    async () => wrap({
      instructions: [
        '1. Install the Lovense Connect app on your phone (NOT Lovense Remote)',
        '2. Open the app and enable Bluetooth',
        '3. Turn on your toy — it should appear in the app',
        '4. Tap the toy to pair it via Bluetooth',
        '5. Once paired, run the "status" tool to verify the connection'
      ],
      note: 'Make sure your phone and PC are on the same WiFi network.'
    })
  );

  server.tool(
    'status',
    'Check connected toys, their types, battery levels, and capabilities. Use this to know what motors are available.',
    {},
    async () => wrap(await lovenseGet('GetToys'))
  );

  server.tool(
    'control',
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
    async (params) => wrap(await lovenseCommand(buildCommand(params)))
  );

  server.tool(
    'edge',
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
    async (params) => wrap(await lovenseCommand(buildEdgeCommand(params)))
  );

  server.tool(
    'preset',
    'Run a built-in Lovense vibration pattern',
    {
      name: z.enum(['pulse', 'wave', 'fireworks', 'earthquake']).optional().default('pulse').describe('Which pattern'),
      duration: z.number().min(1).max(300).optional().default(10).describe('Duration in seconds'),
      toy: toySchema
    },
    async ({ name, duration, toy }) => wrap(await lovenseCommand({
      command: 'Preset', name, timeSec: clamp(duration, 1, 300), toy
    }))
  );

  server.tool(
    'stop',
    'Emergency stop. No questions asked.',
    { toy: toySchema },
    async ({ toy }) => wrap(await lovenseCommand({
      command: 'Function', action: 'Stop', timeSec: 0, toy
    }))
  );

  return server;
}

// ============ STDIO MODE ============

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ============ HTTP MODE ============

async function startHttp() {
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());

  const mcpPath = MCP_SECRET ? `/mcp/${MCP_SECRET}` : '/mcp';
  const transports = {};

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'lovense-bridge', version: '3.0.0', mode: 'http' });
  });

  app.post(mcpPath, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) delete transports[sid];
    };

    const server = createServer();
    await server.connect(transport);

    if (transport.sessionId) {
      transports[transport.sessionId] = transport;
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get(mcpPath, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: 'No active session. Send a POST first.' });
  });

  app.delete(mcpPath, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: 'No active session.' });
  });

  app.listen(PORT, () => {
    console.log(`Lovense Bridge v3 — HTTP mode`);
    console.log(`  MCP endpoint: http://localhost:${PORT}${mcpPath}`);
    console.log(`  Lovense API:  ${LOCAL_URL}`);
    if (!MCP_SECRET) {
      console.log(`  WARNING: No MCP_SECRET set. Anyone with the URL can control your toy.`);
    }
    console.log(`\nTo expose via tunnel:`);
    console.log(`  cloudflared tunnel --url http://localhost:${PORT}`);
    console.log(`Then add as custom connector: <tunnel-url>${mcpPath}`);
  });
}

// ============ START ============

if (HTTP_MODE) {
  startHttp().catch(console.error);
} else {
  startStdio().catch(console.error);
}
