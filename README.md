# Lovense Bridge

MCP server for controlling Lovense toys through AI companions. Works from any device — phone, desktop, anywhere your AI runs.

Your AI reads the moment. It decides the intensity, the rhythm, the pace. These tools are just its hands.

> **Security-hardened fork** of [amarisaster/Lovense-Cloud-MCP](https://github.com/amarisaster/Lovense-Cloud-MCP). See [SECURITY.md](SECURITY.md).

---

## How It Works

Two paths, same tools:

```
Desktop:  Claude Desktop → bridge.js (stdio) → Lovense Connect (local WiFi) → Toy
Mobile:   Phone → Cloudflare Tunnel → bridge.js (HTTP) → Lovense Connect (local WiFi) → Toy
```

Everything stays on your home network. No cloud API dependency. No business account needed.

> **Important:** You need the **Lovense Connect** app (NOT Lovense Remote). Only Lovense Connect exposes the local API that bridge.js talks to.

---

## Tools

6 tools. Simple by design — the AI makes the decisions.

| Tool | What it does |
|---|---|
| **`pair`** | Pairing instructions (handled in the app, not via API) |
| **`status`** | Checks connected toys, battery, and capabilities |
| **`control`** | The main tool — any motor combo, 4 modes |
| **`edge`** | Edging pattern — build/deny cycles |
| **`preset`** | Runs built-in Lovense patterns |
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

**Max duration:** 300 seconds per command · **Intensity range:** 0-20

---

## Setup

### 1. Install Lovense Connect

1. Install **Lovense Connect** on your phone ([iOS](https://apps.apple.com/app/lovense-connect/id1273067916) / [Android](https://play.google.com/store/apps/details?id=com.lovense.connect))
2. **Not** Lovense Remote — only Connect has the local API
3. Open the app, enable Bluetooth, pair your toy
4. Note the local API URL shown in the app (or find your phone's IP)

Your Lovense Connect URL looks like: `https://192-168-X-X.lovense.club:30010`
(Replace X-X with your phone's IP, dashes instead of dots)

### 2. Clone & Install

```bash
git clone https://github.com/martusha89/Lovense-bridge.git
cd Lovense-bridge
npm install
```

### 3. Connect to Claude

#### Option A: Phone (Custom Connector via Tunnel) — Recommended

This lets you use it from your phone via claude.ai. Requires your PC to be on.

**Start the bridge in HTTP mode:**

```bash
# Linux/Mac
LOVENSE_LOCAL_URL=https://192-168-X-X.lovense.club:30010 MCP_SECRET=your-secret-here node bridge.js --http

# Windows (PowerShell)
$env:LOVENSE_LOCAL_URL="https://192-168-X-X.lovense.club:30010"
$env:MCP_SECRET="your-secret-here"
node bridge.js --http
```

**Expose via Cloudflare Tunnel:**

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3456
```

Copy the tunnel URL (e.g. `https://abc-123.trycloudflare.com`).

**Add as custom connector in Claude.ai:**

```
https://abc-123.trycloudflare.com/mcp/your-secret-here
```

Works from any device — phone browser, tablet, desktop.

> **Tip:** For a permanent tunnel URL, set up a [named Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) instead of a quick tunnel.

#### Option B: Claude Desktop (Local Only)

Config file location:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
"lovense-bridge": {
  "command": "node",
  "args": ["C:\\path\\to\\Lovense-bridge\\bridge.js"],
  "env": {
    "LOVENSE_LOCAL_URL": "https://192-168-X-X.lovense.club:30010"
  }
}
```

Restart Claude Desktop. Phone and PC must be on the same WiFi network.

#### Option C: Claude Code

```bash
LOVENSE_LOCAL_URL=https://192-168-X-X.lovense.club:30010 claude mcp add lovense-bridge node bridge.js
```

### 4. Verify

Ask your AI: "Check toy status" — it should return your toy name, battery level, and capabilities.

---

## Usage

You don't give commands. You talk to your AI. It decides what to do.

**You say:** "tease me"
**AI uses:** `control` with low vibrate, pulse mode, short cycles

**You say:** "harder"
**AI uses:** `control` with higher intensities

**You say:** "edge me"
**AI uses:** `edge` with build/deny cycles

**You say:** "make me come"
**AI uses:** `control` in escalate mode, building to peak

**You say:** "stop"
**AI uses:** `stop`

The AI is the brain. The tools are just hands.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach Lovense Connect" | Check phone IP, make sure Lovense Connect app is open, same WiFi network |
| Status returns error | Toy might not be paired in Lovense Connect — open the app and pair via Bluetooth |
| Tunnel not working | Make sure `cloudflared` is running and bridge.js is in `--http` mode |
| Wrong IP address | Phone IP can change — check Lovense Connect app or router for current IP |
| Tool not responding | Try `stop` first, then retry. Some toys need a moment between commands |
| MCP not showing in Claude | Check config path, restart Claude Desktop |

---

## Advanced: Cloud Worker (Standard Accounts Only)

If you have a **Standard** (business/cam) Lovense developer account, you can use the Cloudflare Worker path instead. This bypasses the local network requirement entirely.

See `src/index.ts` for the cloud worker. Deploy with `npx wrangler deploy`. This requires `LOVENSE_TOKEN`, `API_SECRET`, and `MCP_SECRET` as Cloudflare secrets.

> **Note:** Personal Lovense developer accounts get 501 errors on the Cloud API. This is a Lovense account-type restriction, not a bug.

---

## Security

This controls intimate hardware. Read [SECURITY.md](SECURITY.md).

**Key points:**
- Path-based secret on HTTP/tunnel endpoints
- No cloud dependency — commands stay on your home network
- No logging, no telemetry, no data storage
- MCP_SECRET prevents unauthorized access via tunnel
- Enable 2FA on everything

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
