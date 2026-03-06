#!/usr/bin/env node

/**
 * Lovense Bridge Launcher
 *
 * One command to start the bridge + ngrok tunnel.
 * No domain needed. Free ngrok account required.
 *
 * Usage:
 *   node launch.js
 *
 * Reads config from .env file or environment variables:
 *   LOVENSE_LOCAL_URL  — Your Lovense Connect local API URL (required)
 *   MCP_SECRET         — Secret for the MCP endpoint (auto-generated if missing)
 *   PORT               — Bridge port (default: 3456)
 */

import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============ CONFIG ============

function loadEnvFile() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return {};
  const vars = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const envFile = loadEnvFile();
const env = (key) => process.env[key] || envFile[key];

const LOVENSE_URL = env('LOVENSE_LOCAL_URL');
const PORT = env('PORT') || '3456';
let MCP_SECRET = env('MCP_SECRET');

if (!MCP_SECRET) {
  MCP_SECRET = randomBytes(8).toString('hex');
  console.log(`Generated MCP secret: ${MCP_SECRET}`);
  console.log(`(Save this in your .env file to keep it stable)\n`);
}

if (!LOVENSE_URL) {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  LOVENSE_LOCAL_URL not set                                  ║
╚══════════════════════════════════════════════════════════════╝

Create a .env file in this directory:

  LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30010
  MCP_SECRET=pick-something-secret

To find your URL:
  1. Open Lovense Connect app on your phone
  2. Your phone and PC must be on the same WiFi
  3. The app shows your local IP — convert dots to dashes
  4. Format: https://<ip-with-dashes>.lovense.club:30010

Example: IP 192.168.1.50 → https://192-168-1-50.lovense.club:30010
`);
  process.exit(1);
}

// ============ NGROK CHECK ============

function hasNgrok() {
  try {
    execSync('ngrok --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasNgrok()) {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ngrok not found                                            ║
╚══════════════════════════════════════════════════════════════╝

Install ngrok (free account required):

  Windows:  winget install Ngrok.Ngrok
  Mac:      brew install ngrok
  Linux:    https://ngrok.com/download

Then authenticate:

  ngrok config add-authtoken YOUR_TOKEN

Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken

Why ngrok? Cloudflare quick tunnels don't maintain sticky sessions,
which breaks MCP's streamable transport. ngrok routes all requests
through a single endpoint, so sessions work correctly.
`);
  process.exit(1);
}

// ============ PROCESS MANAGEMENT ============

const children = [];

function cleanup() {
  console.log('\nShutting down...');
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  console.error('Fatal:', err.message);
  cleanup();
});

// ============ START BRIDGE ============

function startBridge() {
  return new Promise((resolve, reject) => {
    const bridge = spawn('node', ['bridge.js', '--http'], {
      cwd: __dirname,
      env: {
        ...process.env,
        LOVENSE_LOCAL_URL: LOVENSE_URL,
        MCP_SECRET,
        PORT,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    children.push(bridge);

    let started = false;

    bridge.stdout.on('data', (data) => {
      const text = data.toString();
      if (!started && text.includes('MCP endpoint')) {
        started = true;
        resolve();
      }
    });

    bridge.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.error(`[bridge] ${text}`);
    });

    bridge.on('exit', (code) => {
      if (!started) reject(new Error(`Bridge exited with code ${code}`));
      else {
        console.error('Bridge process died. Shutting down.');
        cleanup();
      }
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 3000);
  });
}

// ============ START NGROK ============

function startNgrok() {
  return new Promise((resolve, reject) => {
    const ngrok = spawn('ngrok', ['http', PORT, '--log', 'stdout', '--log-format', 'json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    children.push(ngrok);

    let resolved = false;

    ngrok.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (!line.trim()) continue;
        try {
          const log = JSON.parse(line);
          if (log.url && !resolved) {
            resolved = true;
            resolve(log.url);
          }
        } catch {}
      }
    });

    ngrok.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.error(`[ngrok] ${text}`);
    });

    ngrok.on('exit', (code) => {
      if (!resolved) reject(new Error(`ngrok exited with code ${code}. Is it installed and authenticated?`));
    });

    // Fallback: query ngrok's local API
    setTimeout(() => {
      if (!resolved) {
        fetch('http://127.0.0.1:4040/api/tunnels')
          .then(r => r.json())
          .then(data => {
            const tunnel = data.tunnels?.find(t => t.proto === 'https') || data.tunnels?.[0];
            if (tunnel?.public_url && !resolved) {
              resolved = true;
              resolve(tunnel.public_url);
            }
          })
          .catch(() => {});
      }
    }, 5000);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('ngrok took too long to start. Check your auth token with: ngrok config add-authtoken YOUR_TOKEN'));
      }
    }, 15000);
  });
}

// ============ MAIN ============

async function main() {
  console.log(`Lovense Bridge — launching...`);
  console.log(`  Lovense API:  ${LOVENSE_URL}`);
  console.log(`  Bridge port:  ${PORT}`);
  console.log(`  Tunnel:       ngrok\n`);

  // Start bridge
  await startBridge();
  console.log(`Bridge running on port ${PORT}`);

  // Start ngrok
  console.log(`Starting ngrok tunnel...`);
  let tunnelUrl;
  try {
    tunnelUrl = await startNgrok();
  } catch (err) {
    console.error(`\nTunnel failed: ${err.message}`);
    cleanup();
    return;
  }

  const connectorUrl = `${tunnelUrl}/mcp/${MCP_SECRET}`;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Ready!                                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Add this URL as a Custom Connector in Claude.ai:            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

${connectorUrl}

Steps:
  1. Open Claude.ai on your phone
  2. Go to Settings → Connectors → Add Custom MCP
  3. Paste the URL above
  4. Start a new chat — you'll see the Lovense tools

Keep this window open. Press Ctrl+C to stop.
`);

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err.message);
  cleanup();
});
