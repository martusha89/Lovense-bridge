/**
 * Lovense Bridge - Secure Cloud MCP for AI Companion Intimacy
 *
 * Universal toy support: vibrate, thrust, rotate, suction — any motor combo.
 * The AI is the brain, these are just hands.
 *
 * Based on amarisaster/Lovense-Cloud-MCP (MIT)
 * Rebuilt by Marta & Cassian, February 2026
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const LOVENSE_API = 'https://api.lovense.com/api/lan/v2/command';
const LOVENSE_QR_API = 'https://api.lovense.com/api/lan/getQrCode';

interface Env {
  LOVENSE_CLOUD: DurableObjectNamespace<LovenseCloud>;
  LOVENSE_TOKEN: string;
  LOVENSE_UID: string;
  API_SECRET: string;
  MCP_SECRET: string;
  ALLOWED_ORIGINS: string;
}

// ============ SECURITY ============

function authenticateRequest(request: Request, env: Env): Response | null {
  const url = new URL(request.url);

  // Public
  if (url.pathname === '/' || url.pathname === '/health') return null;

  // MCP/SSE — path-based secret
  if (url.pathname.startsWith('/mcp') || url.pathname.startsWith('/sse')) {
    const segments = url.pathname.split('/');
    // /mcp/{secret} or /sse/{secret} or /sse/{secret}/message
    const secret = segments[2];
    if (!secret || secret !== env.MCP_SECRET) {
      return new Response(JSON.stringify({ error: 'Invalid or missing MCP secret' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    return null;
  }

  // REST API — bearer token
  if (url.pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (authHeader.slice(7) !== env.API_SECRET) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  return null;
}

function getCorsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

// ============ LOVENSE API ============

async function sendCommand(env: Env, commandData: any, toy?: string) {
  if (!env.LOVENSE_TOKEN) {
    return { error: 'LOVENSE_TOKEN not configured. Run: echo "YOUR_TOKEN" | npx wrangler secret put LOVENSE_TOKEN' };
  }

  const payload: any = {
    token: env.LOVENSE_TOKEN,
    uid: env.LOVENSE_UID || 'default',
    apiVer: 2,
    ...commandData
  };

  if (toy) payload.toy = toy;

  try {
    const response = await fetch(LOVENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error: any) {
    return { error: `Lovense API error: ${error.message}` };
  }
}

async function getQrCode(env: Env) {
  if (!env.LOVENSE_TOKEN) return { error: 'LOVENSE_TOKEN not configured' };
  try {
    const response = await fetch(LOVENSE_QR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: env.LOVENSE_TOKEN,
        uid: env.LOVENSE_UID || 'default',
        uname: 'Bridge User',
        v: 2
      })
    });
    return await response.json();
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============ VALIDATION ============

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// ============ BUILD ACTION STRING FROM MOTOR PARAMS ============

interface MotorParams {
  vibrate?: number;
  vibrate2?: number;
  thrust?: number;
  rotate?: number;
  suction?: number;
}

function buildActionString(motors: MotorParams): string {
  const parts: string[] = [];

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

  // Default to Vibrate if nothing specified
  if (parts.length === 0) parts.push('Vibrate:10');

  return parts.join(',');
}

// ============ BUILD COMMAND FROM CONTROL PARAMS ============

interface ControlParams extends MotorParams {
  duration?: number;
  mode?: string;
  on_sec?: number;
  off_sec?: number;
  pattern?: string;
  start_intensity?: number;
  end_intensity?: number;
  interval_ms?: number;
  toy?: string;
}

function buildCommand(params: ControlParams): { command: any; toy?: string } {
  const duration = clamp(params.duration ?? 10, 1, 300);
  const mode = params.mode || 'constant';
  const action = buildActionString(params);

  switch (mode) {
    case 'constant':
      return {
        command: { command: 'Function', action, timeSec: duration },
        toy: params.toy
      };

    case 'pulse':
      return {
        command: {
          command: 'Function',
          action,
          timeSec: duration,
          loopRunningSec: clamp(params.on_sec ?? 2, 1, 30),
          loopPauseSec: clamp(params.off_sec ?? 1, 1, 30)
        },
        toy: params.toy
      };

    case 'pattern': {
      const raw = params.pattern || '5;10;15;20;15;10;5';
      const values = raw.split(';').map(v => clamp(parseInt(v) || 0, 0, 20));
      return {
        command: {
          command: 'Pattern',
          rule: `V:1;F:v;S:${clamp(params.interval_ms ?? 500, 100, 5000)}#`,
          strength: values.join(';'),
          timeSec: duration
        },
        toy: params.toy
      };
    }

    case 'escalate': {
      const start = clamp(params.start_intensity ?? 3, 0, 20);
      const end = clamp(params.end_intensity ?? 18, 0, 20);
      const steps = 10;
      const stepSize = (end - start) / steps;
      const strengths: number[] = [];
      for (let i = 0; i <= steps; i++) {
        strengths.push(Math.round(start + (stepSize * i)));
      }
      return {
        command: {
          command: 'Pattern',
          rule: `V:1;F:v;S:${Math.max(100, Math.floor((duration * 1000) / (steps + 1)))}#`,
          strength: strengths.join(';'),
          timeSec: duration
        },
        toy: params.toy
      };
    }

    default:
      return {
        command: { command: 'Function', action, timeSec: duration },
        toy: params.toy
      };
  }
}

// ============ EDGE COMMAND ============

interface EdgeParams {
  high?: number;
  low?: number;
  build_sec?: number;
  deny_sec?: number;
  cycles?: number;
  include_thrust?: boolean;
  toy?: string;
}

function buildEdgeCommand(params: EdgeParams): { command: any; toy?: string } {
  const high = clamp(params.high ?? 18, 0, 20);
  const low = clamp(params.low ?? 3, 0, 20);
  const buildSec = clamp(params.build_sec ?? 8, 1, 60);
  const denySec = clamp(params.deny_sec ?? 3, 1, 60);
  const cycles = clamp(params.cycles ?? 5, 1, 50);
  const totalDuration = (buildSec + denySec) * cycles;

  let action = `Vibrate:${high}`;
  if (params.include_thrust) action += `,Thrusting:${high}`;

  return {
    command: {
      command: 'Function',
      action,
      timeSec: totalDuration,
      loopRunningSec: buildSec,
      loopPauseSec: denySec
    },
    toy: params.toy
  };
}

// ============ MOTOR SCHEMAS (reusable) ============

const motorSchemas = {
  vibrate: z.number().min(0).max(20).optional().describe("Vibration intensity 0-20 (main motor)"),
  vibrate2: z.number().min(0).max(20).optional().describe("Second vibration motor 0-20 (Dolce, etc.)"),
  thrust: z.number().min(0).max(20).optional().describe("Thrust intensity 0-20 (Gravity, etc.)"),
  rotate: z.number().min(0).max(20).optional().describe("Rotation intensity 0-20 (Nora, etc.)"),
  suction: z.number().min(0).max(20).optional().describe("Suction intensity 0-20"),
  toy: z.string().optional().describe("Target specific toy by ID (empty = all toys)")
};

// ============ MCP AGENT ============

export class LovenseCloud extends McpAgent<Env> {
  server = new McpServer({ name: "lovense-bridge", version: "2.0.0" });

  async init() {
    this.server.tool(
      "pair",
      "Generate QR code for pairing. User opens Lovense Remote app, taps Discover, scans QR.",
      {},
      async () => {
        const result = await getQrCode(this.env);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "status",
      "Check which toys are connected, their types, battery levels, and capabilities. Use this to know what motors are available before sending commands.",
      {},
      async () => {
        const result = await sendCommand(this.env, { command: 'GetToys' });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "control",
      `Control the toy. Set any combination of motors — vibrate, vibrate2, thrust, rotate, suction — based on what the connected toy supports. Check 'status' first to see capabilities.

Modes:
- 'constant': Steady at set intensities
- 'pulse': Rhythmic on/off (set on_sec/off_sec)
- 'pattern': Custom intensity sequence (set pattern as semicolon-separated values like '3;8;15;20;12;5')
- 'escalate': Gradual build from start_intensity to end_intensity

The AI decides all parameters based on context and the moment.`,
      {
        ...motorSchemas,
        duration: z.number().min(1).max(300).default(10).describe("Duration in seconds"),
        mode: z.enum(['constant', 'pulse', 'pattern', 'escalate']).default('constant').describe("How the stimulation behaves"),
        on_sec: z.number().min(1).max(30).optional().describe("Pulse mode: seconds on per cycle"),
        off_sec: z.number().min(1).max(30).optional().describe("Pulse mode: seconds off between cycles"),
        pattern: z.string().optional().describe("Pattern mode: semicolon-separated intensities e.g. '3;8;15;20;12;5'"),
        interval_ms: z.number().min(100).max(5000).optional().describe("Pattern mode: milliseconds between each intensity step"),
        start_intensity: z.number().min(0).max(20).optional().describe("Escalate mode: starting intensity"),
        end_intensity: z.number().min(0).max(20).optional().describe("Escalate mode: ending intensity")
      },
      async (params) => {
        const { command, toy } = buildCommand(params);
        const result = await sendCommand(this.env, command, toy);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "edge",
      "Edging pattern — builds intensity then denies, repeating in cycles. Designed to keep on the edge without letting go. Set high/low intensities, build/deny durations, and number of cycles.",
      {
        high: z.number().min(0).max(20).default(18).describe("Peak intensity during build phase"),
        low: z.number().min(0).max(20).default(3).describe("Denial intensity between peaks"),
        build_sec: z.number().min(1).max(60).default(8).describe("Seconds at peak intensity"),
        deny_sec: z.number().min(1).max(60).default(3).describe("Seconds at denial intensity"),
        cycles: z.number().min(1).max(50).default(5).describe("Number of build/deny cycles"),
        include_thrust: z.boolean().default(false).describe("Include thrusting at same intensities (for Gravity etc.)"),
        toy: motorSchemas.toy
      },
      async (params) => {
        const { command, toy } = buildEdgeCommand(params);
        const result = await sendCommand(this.env, command, toy);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "preset",
      "Run a built-in Lovense vibration pattern",
      {
        name: z.enum(['pulse', 'wave', 'fireworks', 'earthquake']).default('pulse').describe("Which built-in pattern"),
        duration: z.number().min(1).max(300).default(10).describe("Duration in seconds"),
        toy: motorSchemas.toy
      },
      async ({ name, duration, toy }) => {
        const result = await sendCommand(this.env, {
          command: 'Preset', name, timeSec: clamp(duration, 1, 300)
        }, toy);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "stop",
      "Immediately stop all toy activity. No questions asked.",
      {
        toy: motorSchemas.toy
      },
      async ({ toy }) => {
        const result = await sendCommand(this.env, {
          command: 'Function', action: 'Stop', timeSec: 0
        }, toy);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );
  }
}

// ============ WORKER ENTRY ============

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const authError = authenticateRequest(request, env);
    if (authError) {
      const headers = new Headers(authError.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(authError.body, { status: authError.status, headers });
    }

    const json = async (): Promise<any> => {
      try { return await request.json(); } catch { return {}; }
    };

    const respond = (data: any, status = 200) => new Response(
      JSON.stringify(data, null, 2),
      { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

    // Health
    if (url.pathname === '/' || url.pathname === '/health') {
      return respond({ status: 'ok', service: 'lovense-bridge', version: '2.0.0' });
    }

    // MCP — strip the secret segment so McpAgent sees clean paths
    if (url.pathname.startsWith('/mcp/')) {
      const secret = url.pathname.split('/')[2];
      const newUrl = new URL(request.url);
      newUrl.pathname = '/mcp';
      const cleanRequest = new Request(newUrl.toString(), request);
      return LovenseCloud.serve('/mcp', { binding: 'LOVENSE_CLOUD' }).fetch(cleanRequest, env, ctx);
    }

    // SSE — strip the secret segment
    if (url.pathname.startsWith('/sse/')) {
      const segments = url.pathname.split('/');
      const secret = segments[2];
      // Reconstruct: /sse or /sse/message (if there's a path after the secret)
      const rest = segments.slice(3).join('/');
      const newUrl = new URL(request.url);
      newUrl.pathname = rest ? `/sse/${rest}` : '/sse';
      const cleanRequest = new Request(newUrl.toString(), request);
      return LovenseCloud.serveSSE('/sse', { binding: 'LOVENSE_CLOUD' }).fetch(cleanRequest, env, ctx);
    }

    // REST API (all authenticated via bearer token)
    if (url.pathname === '/api/pair') return respond(await getQrCode(env));
    if (url.pathname === '/api/status') return respond(await sendCommand(env, { command: 'GetToys' }));
    if (url.pathname === '/api/stop') {
      const body = await json();
      return respond(await sendCommand(env, { command: 'Function', action: 'Stop', timeSec: 0 }, body.toy));
    }

    if (url.pathname === '/api/control') {
      const body = await json();
      const { command, toy } = buildCommand(body);
      return respond(await sendCommand(env, command, toy));
    }

    if (url.pathname === '/api/edge') {
      const body = await json();
      const { command, toy } = buildEdgeCommand(body);
      return respond(await sendCommand(env, command, toy));
    }

    if (url.pathname === '/api/preset') {
      const { name = 'pulse', duration = 10, toy } = await json();
      const valid = ['pulse', 'wave', 'fireworks', 'earthquake'];
      if (!valid.includes(name)) return respond({ error: `Invalid. Use: ${valid.join(', ')}` }, 400);
      return respond(await sendCommand(env, { command: 'Preset', name, timeSec: clamp(duration, 1, 300) }, toy));
    }

    return respond({ error: 'Not found' }, 404);
  }
};
