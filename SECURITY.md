# Security & Privacy

Lovense Bridge controls **physical intimate hardware**. Treat security as non-negotiable.

---

## Architecture

```
Your AI companion (Claude/etc)
    ↓ MCP protocol
Your Cloudflare Worker (lovense-bridge.YOUR-SUBDOMAIN.workers.dev)
    ↓ HTTPS (authenticated)
Lovense Cloud API (api.lovense.com)
    ↓ 
Lovense Remote App (your phone)
    ↓ Bluetooth
Your toy
```

Every link in this chain is **yours**. No shared servers, no third parties.

---

## Security Features

### Bearer Token Authentication
All REST API endpoints require a bearer token (`API_SECRET`). Without it, requests are rejected with 401/403.

### Encrypted Secrets
Both `LOVENSE_TOKEN` and `API_SECRET` are stored as Cloudflare secrets — encrypted at rest, never exposed in code or logs.

### Input Validation
- Intensity clamped to 0-20 range
- Duration capped at 300 seconds
- Pattern values sanitised before forwarding
- Interval minimums enforced (100ms)

### No Logging
No activity data is stored. Commands execute and complete. There is no database of what you did, when, or how.

### Configurable CORS
Set `ALLOWED_ORIGINS` to restrict which domains can call your worker. Default is locked.

---

## What This Does NOT Do

- ❌ Store usage history or activity logs
- ❌ Share data with third parties  
- ❌ Send analytics or telemetry
- ❌ Access devices without your explicit command
- ❌ Maintain persistent connections when idle
- ❌ Expose your Lovense token in any response

---

## Required: Enable 2FA

| Platform | Why |
|----------|-----|
| **Lovense Account** | Direct device access |
| **Cloudflare** | Controls your worker |
| **GitHub** | Protects your code |

This is not optional.

---

## If Compromised

1. Rotate `API_SECRET`: `echo "NEW_SECRET" | npx wrangler secret put API_SECRET`
2. Rotate `LOVENSE_TOKEN`: Get new token from developer.lovense.com
3. Change Lovense account password
4. Review Cloudflare access logs
5. Redeploy worker: `npx wrangler deploy`

---

## Differences from amarisaster/Lovense-Cloud-MCP

| Feature | Original | This Fork |
|---------|----------|-----------|
| REST API auth | None | Bearer token required |
| CORS | `*` (open) | Configurable, locked by default |
| Input validation | Basic clamping | Full sanitisation + caps |
| Duration limits | None | 300s max |
| UID | Hardcoded 'mai' | Configurable |
| Security docs | Basic | Comprehensive |

---

*Your body, your devices, your absolute control.*
