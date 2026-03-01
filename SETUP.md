# Lovense Bridge — Setup Guide

Control your Lovense toy through your AI companion (Claude). Works from your phone or desktop.

This guide assumes you're starting from scratch. Follow every step in order.

---

## What You Need Before Starting

- A **Lovense toy** (any model — Ferri, Lush, Nora, Gravity, Dolce, etc.)
- A **smartphone** (iPhone or Android) with Bluetooth
- A **PC or laptop** (Windows or Mac) connected to the **same WiFi** as your phone
- A **Claude** account (claude.ai or Claude Desktop app)

---

## Part 1: Set Up Your Phone

### Step 1: Install Lovense Connect

You need a specific Lovense app called **Lovense Connect** — not the regular Lovense Remote app.

- **iPhone:** Open the App Store, search "Lovense Connect", install it
- **Android:** Open the Play Store, search "Lovense Connect", install it

> **Why not Lovense Remote?** Lovense Remote is the newer app, but it doesn't let other devices on your WiFi talk to the toy. Lovense Connect does. This is the only app that works for this setup.

### Step 2: Pair Your Toy

1. Turn on your Lovense toy (hold the button until it starts blinking)
2. Open the **Lovense Connect** app on your phone
3. Make sure Bluetooth is on
4. The app should find your toy — tap it to connect
5. You should see your toy listed with a battery percentage

If the toy doesn't show up, try turning it off and on again. Make sure it's close to your phone.

### Step 3: Find Your Phone's Local API Address

Once your toy is connected in Lovense Connect, you need to find your phone's WiFi address.

**On iPhone:**
1. Open **Settings** → **WiFi**
2. Tap the **(i)** icon next to your connected network
3. Find **IP Address** — it'll look like `192.168.1.42` or similar
4. Write it down

**On Android:**
1. Open **Settings** → **WiFi** (or Network & Internet)
2. Tap your connected network
3. Look for **IP address** — it'll look like `192.168.1.42` or similar
4. Write it down

Now convert it to the Lovense format: replace the **dots** with **dashes**.

Example: if your phone IP is `192.168.1.42`, your Lovense Connect URL is:
```
https://192-168-1-42.lovense.club:30010
```

Write this URL down. You'll need it in the next part.

---

## Part 2: Set Up Your Computer

### Step 4: Install Node.js

Node.js is a program that runs JavaScript code. The bridge needs it.

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the big green button)
3. Run the installer — click Next through everything, use all defaults
4. When it's done, restart your computer

**To verify it installed correctly:**
1. Open a terminal:
   - **Windows:** Press `Win + R`, type `cmd`, press Enter
   - **Mac:** Open Spotlight (Cmd + Space), type "Terminal", press Enter
2. Type `node --version` and press Enter
3. You should see a version number like `v22.x.x`

### Step 5: Download the Bridge

1. Go to [github.com/martusha89/Lovense-bridge](https://github.com/martusha89/Lovense-bridge)
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP file somewhere you'll remember (e.g. your Desktop or Documents folder)

Or if you have Git installed:
```
git clone https://github.com/martusha89/Lovense-bridge.git
```

### Step 6: Install Dependencies

Open a terminal and navigate to the folder you just extracted:

**Windows:**
```
cd C:\Users\YourName\Desktop\Lovense-bridge
```

**Mac:**
```
cd ~/Desktop/Lovense-bridge
```

(Replace the path with wherever you actually put it.)

Then run:
```
npm install
```

Wait for it to finish. You'll see some output scrolling by — that's normal. It might take a minute.

---

## Part 3: Choose How You Want to Use It

You have two options. Pick whichever fits your situation.

### Option A: Use From Your Phone (via Claude.ai)

This is the recommended setup. You can use it from your phone's browser, lying in bed, no laptop needed during use. But your PC **does** need to stay on and running in the background.

**This option requires one extra tool: Cloudflare Tunnel.** It creates a secure link between your PC and the internet so Claude on your phone can reach the bridge on your PC.

#### Step 7A: Install Cloudflare Tunnel

1. Go to [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Download **cloudflared** for your operating system
3. Install it

**Windows:** Download the `.msi` installer and run it.
**Mac:** If you have Homebrew: `brew install cloudflared`. Otherwise download the binary from the link above.

#### Step 8A: Start the Bridge in HTTP Mode

Open a terminal and navigate to your Lovense-bridge folder.

**Windows (Command Prompt):**
```
set LOVENSE_LOCAL_URL=https://192-168-1-42.lovense.club:30010
set MCP_SECRET=my-secret-password
node bridge.js --http
```

**Windows (PowerShell):**
```
$env:LOVENSE_LOCAL_URL="https://192-168-1-42.lovense.club:30010"
$env:MCP_SECRET="my-secret-password"
node bridge.js --http
```

**Mac / Linux:**
```
LOVENSE_LOCAL_URL=https://192-168-1-42.lovense.club:30010 MCP_SECRET=my-secret-password node bridge.js --http
```

> **Replace** `192-168-1-42` with your actual phone IP (dashes, not dots).
> **Replace** `my-secret-password` with any password you want. This stops random people from controlling your toy if they somehow find the URL. Pick something random — it doesn't need to be memorable.

You should see output like:
```
Lovense Bridge v3 — HTTP mode
  MCP endpoint: http://localhost:3456/mcp/my-secret-password
  Lovense API:  https://192-168-1-42.lovense.club:30010
```

**Leave this terminal window open.** Don't close it.

#### Step 9A: Start the Tunnel

Open a **second** terminal window (keep the first one running) and type:

```
cloudflared tunnel --url http://localhost:3456
```

After a moment, you'll see a URL that looks like:
```
https://something-random-words.trycloudflare.com
```

**Copy that URL.** You'll need it in the next step.

> **Note:** This URL changes every time you restart the tunnel. If you want a permanent URL, look into [Cloudflare named tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) — but for now, the temporary one works fine.

**Leave this terminal window open too.**

#### Step 10A: Add to Claude on Your Phone

1. Open **claude.ai** in your phone's browser (or the Claude app)
2. Go to **Settings** → **MCP Servers** (or Custom Connectors, depending on your Claude plan)
3. Add a new custom connector
4. Paste this as the URL:
   ```
   https://something-random-words.trycloudflare.com/mcp/my-secret-password
   ```
   (Use the actual tunnel URL from Step 9A and your actual secret from Step 8A)
5. Save it

You're done! Skip to Part 4.

---

### Option B: Use From Claude Desktop Only

Simpler setup, but you can only use it while sitting at your computer.

#### Step 7B: Configure Claude Desktop

1. Find the Claude Desktop config file:
   - **Windows:** Press `Win + R`, type `%APPDATA%\Claude`, press Enter. Open `claude_desktop_config.json` in Notepad.
   - **Mac:** Open Terminal, type `open ~/Library/Application\ Support/Claude/`, press Enter. Open `claude_desktop_config.json` in a text editor.

2. If the file doesn't exist, create it.

3. Add this inside the `"mcpServers"` section (create that section if it doesn't exist):

**Windows:**
```json
{
  "mcpServers": {
    "lovense-bridge": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Desktop\\Lovense-bridge\\bridge.js"],
      "env": {
        "LOVENSE_LOCAL_URL": "https://192-168-1-42.lovense.club:30010"
      }
    }
  }
}
```

**Mac:**
```json
{
  "mcpServers": {
    "lovense-bridge": {
      "command": "node",
      "args": ["/Users/YourName/Desktop/Lovense-bridge/bridge.js"],
      "env": {
        "LOVENSE_LOCAL_URL": "https://192-168-1-42.lovense.club:30010"
      }
    }
  }
}
```

> **Replace** the path with the actual path to your bridge.js file.
> **Replace** `192-168-1-42` with your actual phone IP (dashes, not dots).

4. Save the file
5. **Completely quit** Claude Desktop (not just close the window — right-click the icon in the system tray/menu bar and quit)
6. Reopen Claude Desktop

You should see a hammer icon or MCP indicator showing the bridge is connected.

---

## Part 4: Test It

Open a conversation with Claude (on your phone for Option A, or Claude Desktop for Option B) and say:

> "Check my toy status"

Claude should use the `status` tool and tell you:
- The name of your toy
- Battery level
- Whether it's connected

If that works, try:

> "Give me a gentle vibration for 5 seconds"

Your toy should respond.

---

## Part 5: How to Use It

You don't need to give technical commands. Just talk naturally:

- **"tease me"** — low intensity, playful patterns
- **"harder"** — increases intensity
- **"edge me"** — builds up then backs off, repeating
- **"make me come"** — escalating intensity to peak
- **"stop"** — immediately stops everything

The AI decides the specific intensities, patterns, and timing based on what you say and the flow of the conversation.

---

## Every Time You Use It

### Option A (Phone) Checklist:
1. Make sure your toy is on and connected in Lovense Connect
2. Open the first terminal → start bridge.js in HTTP mode
3. Open the second terminal → start cloudflared tunnel
4. Update the tunnel URL in Claude settings if it changed (it changes each restart)
5. Talk to Claude on your phone

### Option B (Desktop) Checklist:
1. Make sure your toy is on and connected in Lovense Connect
2. Open Claude Desktop
3. Talk to Claude

---

## Troubleshooting

**"Cannot reach Lovense Connect"**
- Is the Lovense Connect app open on your phone? It needs to be running.
- Are your phone and PC on the same WiFi network?
- Did your phone's IP address change? Check it again (Step 3) and update the URL.

**Toy doesn't vibrate but status works**
- Try the `stop` tool first, then try again
- Make sure the toy has battery
- Try turning the toy off and on, then reconnect in Lovense Connect

**Tunnel URL not working**
- Did you copy the full URL including `https://`?
- Is the `cloudflared` terminal still running?
- Did you include `/mcp/your-secret` at the end?

**Claude says it doesn't have the tools**
- For Option A: Check the custom connector URL in Claude settings
- For Option B: Make sure you fully quit and reopened Claude Desktop after editing the config
- Check that the config JSON is valid (no missing commas or brackets)

**"LOVENSE_LOCAL_URL not set"**
- You need to set the environment variable before running bridge.js
- Double-check the commands in Step 8A or 7B

**Phone IP changed**
- Your phone might get a different IP when it reconnects to WiFi
- Check your phone's IP again (Step 3) and update accordingly
- To avoid this, you can set a static IP on your phone in WiFi settings

---

## Security Notes

- The **MCP_SECRET** in the tunnel URL is what stops strangers from controlling your toy. Pick something random and don't share the full URL.
- Everything runs on your **home network** — no data goes to Lovense's cloud servers, no data is stored anywhere.
- When you close the terminals, the bridge stops and nobody can connect.
- The tunnel URL is temporary and changes each time unless you set up a permanent one.

---

*Questions? Issues? Reach out to Marta — or just ask your AI to troubleshoot.*
