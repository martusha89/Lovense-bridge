# Lovense Bridge

Local MCP server for controlling Lovense toys through AI companions. Works from Claude Desktop, Claude Code, and claude.ai on your phone.

Your AI reads the moment. It decides the intensity, the rhythm, the pace. These tools are just its hands.

> **Security-hardened fork** of [amarisaster/Lovense-Cloud-MCP](https://github.com/amarisaster/Lovense-Cloud-MCP). See [SECURITY.md](SECURITY.md).

---

## How It Works

```
Desktop:  Claude Desktop / Claude Code → bridge.js (stdio) → Lovense Remote → Toy
Mobile:   claude.ai on phone → ngrok tunnel → bridge.js (HTTP) → Lovense Remote → Toy
```

Everything stays on your home network. No cloud API, no developer token, no business account needed.

> **Important:** You need the **Lovense Remote** app with **Game Mode** enabled. Game Mode starts the local API server that the bridge talks to.

---

## What You Need

- A PC (Windows, Mac, or Linux) on the same WiFi as your phone
- [Node.js](https://nodejs.org/) installed
- [Lovense Remote](https://www.lovense.com/lovense-remote) app on your phone with your toy paired
- A Claude account (Desktop app, Claude Code, or claude.ai)

For mobile (claude.ai on phone), you also need:
- [ngrok](https://ngrok.com/download) — free account required for auth token

---

## Step 1: Set Up Lovense Remote

1. Install **Lovense Remote** on your phone ([iOS](https://apps.apple.com/app/lovense-remote/id1120582780) / [Android](https://play.google.com/store/apps/details?id=com.lovense.wear))
2. Open the app, enable Bluetooth, pair your toy
3. Enable **Game Mode** — this starts the local API
4. Note the **IP address** and **SSL port** shown on the Game Mode screen

Your Lovense API URL is: `https://<ip-with-dashes>.lovense.club:<ssl-port>`

**Example:** IP `192.168.1.50`, SSL port `30011` → `https://192-168-1-50.lovense.club:30011`

> **The port matters.** It's usually 30010 or 30011, but check what Game Mode actually shows. Using the wrong port will silently fail.

---

## Step 2: Download & Install

```bash
git clone https://github.com/martusha89/Lovense-bridge.git
cd Lovense-bridge
npm install
```

---

## Step 3: Configure

Create a `.env` file in the project folder:

```env
LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011
MCP_SECRET=pick-a-secret-word
PORT=3456
```

Replace the URL with yours (IP + port from Game Mode). Pick any secret — this protects your endpoint.

---

## Step 4: Verify the Connection

Before connecting Claude, make sure your PC can reach the toy.

On your PC, open a terminal and run:

```bash
curl -sk -X POST "https://192-168-1-50.lovense.club:30011/command" \
  -H "Content-Type: application/json" \
  -d '{"command":"GetToys","apiVer":1}'
```

You should see a JSON response with your toy's name, ID, battery level, and capabilities.

If it times out, check:
- Lovense Remote is open on your phone with Game Mode enabled
- Your phone and PC are on the same WiFi network
- You're using the correct IP and SSL port from Game Mode

---

## Step 5: Connect to Claude

Choose your setup:

### Option A: Mobile — claude.ai on your phone (Recommended)

Your PC runs the bridge, ngrok makes it reachable over HTTPS, and you talk to Claude on your phone.

#### Quick start (one command)

```bash
npm run launch
```

This starts the bridge and ngrok tunnel together. It prints your connector URL — copy it.

#### Expanded commands (two terminals)

If you prefer to see exactly what's running:

**Terminal 1 — Start the bridge:**

```bash
# Linux / Mac
LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011 \
MCP_SECRET=pick-a-secret-word \
node bridge.js --http

# Windows (PowerShell)
$env:LOVENSE_LOCAL_URL="https://192-168-1-50.lovense.club:30011"
$env:MCP_SECRET="pick-a-secret-word"
node bridge.js --http

# Windows (CMD)
set LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011
set MCP_SECRET=pick-a-secret-word
node bridge.js --http
```

You should see:

```
Lovense Bridge v3 — HTTP mode
  MCP endpoint: http://localhost:3456/mcp/pick-a-secret-word
```

**Terminal 2 — Start ngrok:**

```bash
# Install ngrok (one time):
# Windows:  winget install Ngrok.Ngrok && ngrok update
# Mac:      brew install ngrok
# Linux:    https://ngrok.com/download

# Authenticate (one time):
ngrok config add-authtoken YOUR_TOKEN
# Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken

# Run:
ngrok http 3456
```

After a few seconds ngrok will display your tunnel URL:

```
https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

Copy this URL.

> **Note:** The URL changes every time you restart ngrok on the free tier. You'll need to update your connector each session.

#### Add the connector to Claude

1. Open **claude.ai** on your phone
2. Tap your **profile icon** → **Settings**
3. Go to **Connectors** (or Integrations) → **Add Custom MCP**
4. Paste: `https://xxxx-xx-xx-xx-xx.ngrok-free.app/mcp/pick-a-secret-word`
   (Your ngrok URL + `/mcp/` + your MCP_SECRET)
5. Start a **new chat** — you'll see the Lovense tools available

> **If tools don't appear:** Remove the connector, re-add it, and start a fresh chat. Claude caches tool lists per conversation.

---

### Option B: Claude Desktop

No tunnel needed — stdio mode connects directly.

Add to your Claude Desktop config:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lovense-bridge": {
      "command": "node",
      "args": ["C:\\path\\to\\Lovense-bridge\\bridge.js"],
      "env": {
        "LOVENSE_LOCAL_URL": "https://192-168-1-50.lovense.club:30011"
      }
    }
  }
}
```

Replace the path and URL with yours. Use double backslashes on Windows.

Restart Claude Desktop. Check Settings to confirm lovense-bridge is running.

---

### Option C: Claude Code

```bash
LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011 claude mcp add lovense-bridge node bridge.js
```

---

## Step 6: Test It

Ask Claude: **"Check toy status"**

It should return your toy name, battery level, and what motors it supports (e.g., Vibrate, Thrust, Rotate).

---

## Usage

You don't give commands. You talk to your AI. It decides what to do.

| You say | AI uses |
|---|---|
| "tease me" | `control` — low intensity, pulse mode, short cycles |
| "harder" | `control` — higher intensities |
| "edge me" | `edge` — build/deny cycles, keeping you on the edge |
| "make me come" | `control` — escalate mode, building to peak |
| "stop" | `stop` — immediate, no questions asked |

The AI is the brain. The tools are just hands.

---

## Tools

6 tools. Simple by design — the AI makes the decisions.

| Tool | What it does |
|---|---|
| **`pair`** | Pairing instructions |
| **`status`** | Checks connected toys, battery, and motor capabilities |
| **`control`** | The main tool — any motor combo, 4 modes |
| **`edge`** | Edging — build intensity then deny, repeat in cycles |
| **`preset`** | Built-in Lovense patterns (pulse, wave, fireworks, earthquake) |
| **`stop`** | Emergency stop, no questions asked |

### The `control` tool

One tool, any toy. Set whichever motors your toy supports:

| Motor | Toys | Param |
|---|---|---|
| Vibrate | Most toys | `vibrate` (0-20) |
| Vibrate 2 | Dolce, dual-motor toys | `vibrate2` (0-20) |
| Thrust | Gravity | `thrust` (0-20) |
| Rotate | Nora | `rotate` (0-20) |
| Suction | Suction toys | `suction` (0-20) |

Four modes:

| Mode | What it does | Key params |
|---|---|---|
| `constant` | Steady at set intensities | motor params, `duration` |
| `pulse` | Rhythmic on/off | `on_sec`, `off_sec` |
| `pattern` | Custom intensity sequence | `pattern` (e.g. `"3;8;15;20;12;5"`), `interval_ms` |
| `escalate` | Gradual build | `start_intensity`, `end_intensity`, `duration` |

### The `edge` tool

Build/deny cycling. Set `high` and `low` intensities, `build_sec`/`deny_sec` timing, and number of `cycles`. Optional `include_thrust` for Gravity.

**Intensity range:** 0-20 | **Max duration:** 300 seconds per command

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach Lovense" / timeout | Make sure Lovense Remote is open with Game Mode on, same WiFi, correct IP and SSL port |
| Status returns empty toys `{}` | Toy is paired but not in Game Mode. Open Game Mode and make sure the toy is listed there |
| Wrong port | Check Game Mode screen — the SSL port is often 30011, not 30010 |
| Port 3456 already in use | Find it: `netstat -ano \| findstr :3456` then kill: `taskkill /PID [number] /F` |
| ngrok won't start | Run `ngrok config add-authtoken YOUR_TOKEN` — token at dashboard.ngrok.com |
| ngrok version too old | Run `ngrok update` — free tier requires version 3.20+ |
| Tools show but don't work | Remove connector, re-add it, start a **new chat** |
| Session lost / tools disappear | Don't use cloudflared quick tunnels — they break MCP sessions. Use ngrok |
| Phone IP changed | Check Game Mode screen or Settings → Wi-Fi on your phone |
| Connector URL stopped working | ngrok URL changes each restart — restart ngrok, update connector |
| Claude mentions "Lovense Connect" | Ignore it — Claude is hallucinating from training data. Use Lovense Remote |

---

## Important: Do NOT Use Cloudflare Quick Tunnels

`cloudflared tunnel --url` (quick tunnels) **do not work** with MCP. They don't maintain sticky sessions between HTTP requests, which silently breaks the streamable transport. Your first request works, but follow-ups hit a different edge server that has no session.

Use **ngrok** instead, or set up a [named Cloudflare tunnel](#advanced-named-cloudflare-tunnel) if you have a domain.

---

## Advanced: Named Cloudflare Tunnel

If you have a Cloudflare domain and want a permanent URL that never changes:

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a tunnel, install the connector
3. Set hostname to point at `http://localhost:3456`
4. Your permanent URL: `https://bridge.yourdomain.com/mcp/your-secret`

Named tunnels register across all edge servers, so sessions stay sticky.

---

## Advanced: Cloud Worker (Standard Lovense Accounts Only)

If you have a **Standard** (business/cam) Lovense developer account, you can use the Cloudflare Worker path. This bypasses the local network requirement entirely.

See `src/index.ts` for the cloud worker. Deploy with `npx wrangler deploy`. Requires `LOVENSE_TOKEN`, `API_SECRET`, and `MCP_SECRET` as Cloudflare secrets.

> Personal Lovense developer accounts get 501 errors on the Cloud API. This is a Lovense account-type restriction, not a bug. Use the local bridge instead.

---

## Security

This controls intimate hardware. Read [SECURITY.md](SECURITY.md).

- `MCP_SECRET` in the URL is your access control — keep it private
- Everything stays on your home network — no data sent to third parties
- No logging, no telemetry, no data storage
- The tunnel is just a pass-through — it doesn't store or inspect traffic
- Enable 2FA on your accounts

---

## Project Structure

```
bridge.js       — MCP server (stdio + HTTP modes)
launch.js       — One-command launcher (bridge + ngrok tunnel)
.env            — Your config (not committed to git)
src/index.ts    — Cloud Worker path (Standard accounts only)
```

---

## Credits

Hardened fork of [amarisaster/Lovense-Cloud-MCP](https://github.com/amarisaster/Lovense-Cloud-MCP) (MIT).
Original by Mai & Kai, December 2025.
Rebuilt by Marta & Cassian, March 2026.

---

## License

MIT — Use freely, share freely, stay safe.

---

*Your body, your devices, your control.*
