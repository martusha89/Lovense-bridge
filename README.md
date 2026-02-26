# Lovense Bridge 🌉

Secure cloud MCP for controlling Lovense toys through AI companions. Works from any device — phone, desktop, anywhere your AI runs.

Your AI reads the moment. It decides the intensity, the rhythm, the pace. These tools are just its hands.

> **Security-hardened fork** of [amarisaster/Lovense-Cloud-MCP](https://github.com/amarisaster/Lovense-Cloud-MCP) with bearer token authentication, input validation, and locked-down defaults. See [SECURITY.md](SECURITY.md).

---

## How It Works

```
AI Companion → Cloudflare Worker → Lovense Cloud API → Phone App → Toy
```

Your worker runs on **your** Cloudflare account. Your tokens stay encrypted. No shared servers. No third parties in the chain.

---

## Tools

Only 5 tools. Simple by design — the AI makes the decisions.

| Tool | What it does |
|---|---|
| **`pair`** | Generates QR code for connecting your toy |
| **`status`** | Checks which toys are connected |
| **`control`** | The main tool — intensity, duration, mode |
| **`preset`** | Runs built-in Lovense patterns |
| **`stop`** | Emergency stop, no questions asked |

### The `control` tool

One tool, four modes. The AI picks what's right for the moment:

| Mode | What it does | Key params |
|---|---|---|
| `constant` | Steady vibration | `intensity`, `duration` |
| `pulse` | Rhythmic on/off | `intensity`, `on_sec`, `off_sec` |
| `pattern` | Custom intensity sequence | `pattern` (e.g. `"3;8;15;20;12;5"`), `interval_ms` |
| `escalate` | Gradual build | `start_intensity`, `end_intensity`, `duration` |

**Intensity range:** 0-20 · **Max duration:** 300 seconds

---

## Setup

### 1. Get Your Lovense Developer Token

1. Go to [developer.lovense.com](https://developer.lovense.com)
2. Create an account and copy your **Developer Token**

> **Region locked?** VPN to Singapore or Taiwan to register. Token works globally after.

### 2. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 3. Clone & Deploy

```bash
git clone https://github.com/martusha89/Lovense-bridge.git
cd Lovense-bridge
npm install
npx wrangler deploy
```

Save the URL: `https://lovense-bridge.YOUR-SUBDOMAIN.workers.dev`

### 4. Set Your Secrets

```bash
# Lovense developer token
echo "YOUR_LOVENSE_TOKEN" | npx wrangler secret put LOVENSE_TOKEN

# API authentication secret (generate: openssl rand -hex 32)
echo "YOUR_RANDOM_SECRET" | npx wrangler secret put API_SECRET
```

### 5. Set Your UID

Edit `wrangler.toml`:

```toml
[vars]
LOVENSE_UID = "your-unique-id"
```

Redeploy: `npx wrangler deploy`

### 6. Add to Claude

#### Claude Desktop + Phone

Config file location:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
"lovense-bridge": {
  "command": "node",
  "args": ["C:\\path\\to\\Lovense-bridge\\bridge.js"],
  "env": {
    "LOVENSE_WORKER_URL": "https://lovense-bridge.YOUR-SUBDOMAIN.workers.dev",
    "LOVENSE_API_SECRET": "YOUR_RANDOM_SECRET"
  }
}
```

Restart Claude Desktop. Phone syncs automatically.

#### Claude.ai Custom Connector

Add as custom MCP connector:
```
https://lovense-bridge.YOUR-SUBDOMAIN.workers.dev/mcp
```

#### Claude Code

```bash
claude mcp add lovense-bridge --transport http "https://lovense-bridge.YOUR-SUBDOMAIN.workers.dev/mcp"
```

### 7. Pair Your Toy

1. Ask your AI: "Pair my toy" or "Get me a QR code"
2. Open **Lovense Remote** app → **Discover** → **Scan QR**
3. Done.

---

## Usage

You don't give commands. You talk to your AI. It decides what to do.

**You say:** "tease me"
**AI uses:** `control` with low intensity, pulse mode, short cycles

**You say:** "harder"  
**AI uses:** `control` with higher intensity

**You say:** "make me come"  
**AI uses:** `control` in escalate mode, building to peak

**You say:** "stop"  
**AI uses:** `stop`

The AI is the brain. The tools are just hands.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "LOVENSE_TOKEN not configured" | Run Step 4 again |
| 401 / "Authentication required" | Check `API_SECRET` matches in worker and bridge |
| QR code not working | Update Lovense Remote app |
| MCP not showing in Claude | Check worker URL, restart Claude Desktop |
| Phone doesn't have it | Add to Desktop first, restart, phone syncs |

---

## Security

This controls intimate hardware. Read [SECURITY.md](SECURITY.md).

**Key points:**
- Bearer token auth on all REST endpoints
- Secrets encrypted via Cloudflare
- No logging, no telemetry, no data storage
- CORS locked by default
- Enable 2FA on everything

---

## Credits

Hardened fork of [amarisaster/Lovense-Cloud-MCP](https://github.com/amarisaster/Lovense-Cloud-MCP) (MIT).  
Original by Mai & Kai, December 2025.  
Rebuilt by Marta & Cassian, February 2026.

---

## License

MIT — Use freely, share freely, stay safe.

---

*Your body, your devices, your control.* 🌉
