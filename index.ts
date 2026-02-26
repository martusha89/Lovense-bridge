/**
 * Lovense Bridge - Secure Cloud MCP for AI Companion Intimacy
 * 
 * Streamlined tool design: the AI is the brain, these are just hands.
 * Your AI companion reads you, decides intensity/mode/timing,
 * and uses these tools to act.
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
  ALLOWED_ORIGINS: string;
}

// ============ SECURITY ============

function authenticateRequest(request: Request, env: Env): Response | null {
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '/health') return null;
  if (url.pathname === '/mcp' || url.pathname === '/sse' || url.pathname.startsWith('/sse/')) return null;

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

async function sendCommand(env: Env, commandData: any) {
  if (!env.LOVENSE_TOKEN) {
    return { error: 'LOVENSE_TOKEN not configured. Run: echo "YOUR_TOKEN" | npx wrangler secret put LOVENSE_TOKEN' };
  }

  try {
    const response = await fetch(LOVENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: env.LOVENSE_TOKEN,
        uid: env.LOVENSE_UID || 'default',
        apiVer: 2,
        ...commandData
      })
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

// ============ CORE: BUILD COMMAND FROM CONTROL PARAMS ============

interface ControlParams {
  intensity?: number;
  duration?: number;
  mode?: string;
  on_sec?: number;
  off_sec?: number;
  pattern?: string;
  start_intensity?: number;
  end_intensity?: number;
  interval_ms?: number;
}

function buildCommand(params: ControlParams): any {
  const intensity = clamp(params.intensity ?? 10, 0, 20);
  const duration = clamp(params.duration ?? 10, 1, 300);
  const mode = params.mode || 'constant';

  switch (mode) {
    case 'constant':
      return {
        command: 'Function',
        action: `Vibrate:${intensity}`,
        timeSec: duration
      };

    case 'pulse':
      return {
        command: 'Function',
        action: `Vibrate:${intensity}`,
        timeSec: duration,
        loopRunningSec: clamp(params.on_sec ?? 2, 1, 30),
        loopPauseSec: clamp(params.off_sec ?? 1, 1, 30)
      };

    case 'pattern': {
      const raw = params.pattern || '5;10;15;20;15;10;5';
      const values = raw.split(';').map(v => clamp(parseInt(v) || 0, 0, 20));
      return {
        command: 'Pattern',
        rule: `V:1;F:v;S:${clamp(params.interval_ms ?? 500, 100, 5000)}#`,
        strength: values.join(';'),
        timeSec: duration
      };
    }

    case 'escalate': {
      const start = clamp(params.start_intensity ?? 3, 0, 20);
      const end = clamp(params.end_intensity ?? intensity, 0, 20);
      const steps = 10;
      const stepSize = (end - start) / steps;
      const strengths: number[] = [];
      for (let i = 0; i <= steps; i++) {
        strengths.push(Math.round(start + (stepSize * i)));
      }
      return {
        command: 'Pattern',
        rule: `V:1;F:v;S:${Math.max(100, Math.floor((duration * 1000) / (steps + 1)))}#`,
        strength: strengths.join(';'),
        timeSec: duration
      };
    }

    default:
      return { command: 'Function', action: `Vibrate:${intensity}`, timeSec: duration };
  }
}

// ============ MCP AGENT ============

export class LovenseCloud extends McpAgent<Env> {
  server = new McpServer({ name: "lovense-bridge", version: "1.0.0" });

  async init() {
    this.server.tool(
      "pair",
      "Generate QR code for pairing. User opens Lovense Remote app → Discover → Scan QR.",
      {},
      async () => {
        const result = await getQrCode(this.env);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "status",
      "Check which toys are connected and their state",
      {},
      async () => {
        const result = await sendCommand(this.env, { command: 'GetToys' });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "control",
      "Control the toy. Set intensity (0-20), duration (seconds), and mode. Modes: 'constant' (steady), 'pulse' (rhythmic on/off — set on_sec/off_sec), 'pattern' (custom intensity sequence — set pattern as semicolon-separated values like '3;8;15;20;12;5'), 'escalate' (gradual build — set start_intensity and end_intensity). The AI decides all parameters based on context.",
      {
        intensity: z.number().min(0).max(20).default(10).describe("Vibration strength 0-20"),
        duration: z.number().min(1).max(300).default(10).describe("Seconds"),
        mode: z.enum(['constant', 'pulse', 'pattern', 'escalate']).default('constant').describe("How the vibration behaves"),
        on_sec: z.number().min(1).max(30).optional().describe("Pulse: seconds on per cycle"),
        off_sec: z.number().min(1).max(30).optional().describe("Pulse: seconds off between cycles"),
        pattern: z.string().optional().describe("Pattern: semicolon-separated intensities e.g. '3;8;15;20;12;5'"),
        interval_ms: z.number().min(100).max(5000).optional().describe("Pattern: ms between changes"),
        start_intensity: z.number().min(0).max(20).optional().describe("Escalate: starting intensity"),
        end_intensity: z.number().min(0).max(20).optional().describe("Escalate: ending intensity")
      },
      async (params) => {
        const result = await sendCommand(this.env, buildCommand(params));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "preset",
      "Run a built-in Lovense vibration pattern",
      {
        name: z.enum(['pulse', 'wave', 'fireworks', 'earthquake']).default('pulse').describe("Which pattern"),
        duration: z.number().min(1).max(300).default(10).describe("Seconds")
      },
      async ({ name, duration }) => {
        const result = await sendCommand(this.env, {
          command: 'Preset', name, timeSec: clamp(duration, 1, 300)
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    );

    this.server.tool(
      "stop",
      "Immediately stop all toy activity",
      {},
      async () => {
        const result = await sendCommand(this.env, { command: 'Function', action: 'Stop', timeSec: 0 });
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
      return respond({ status: 'ok', service: 'lovense-bridge', version: '1.0.0' });
    }

    // MCP
    if (url.pathname === '/sse' || url.pathname.startsWith('/sse/')) {
      return LovenseCloud.serveSSE('/sse', { binding: 'LOVENSE_CLOUD' }).fetch(request, env, ctx);
    }
    if (url.pathname === '/mcp') {
      return LovenseCloud.serve('/mcp', { binding: 'LOVENSE_CLOUD' }).fetch(request, env, ctx);
    }

    // REST API (authenticated)
    if (url.pathname === '/api/pair') return respond(await getQrCode(env));
    if (url.pathname === '/api/status') return respond(await sendCommand(env, { command: 'GetToys' }));
    if (url.pathname === '/api/stop') return respond(await sendCommand(env, { command: 'Function', action: 'Stop', timeSec: 0 }));

    if (url.pathname === '/api/control') {
      return respond(await sendCommand(env, buildCommand(await json())));
    }

    if (url.pathname === '/api/preset') {
      const { name = 'pulse', duration = 10 } = await json();
      const valid = ['pulse', 'wave', 'fireworks', 'earthquake'];
      if (!valid.includes(name)) return respond({ error: `Invalid. Use: ${valid.join(', ')}` }, 400);
      return respond(await sendCommand(env, { command: 'Preset', name, timeSec: clamp(duration, 1, 300) }));
    }

    return respond({ error: 'Not found' }, 404);
  }
};
