# Lovense Bridge — The "I've Never Done This Before" Guide

**You don't need to be technical. You just need to follow the steps.**

This guide assumes you've never opened a terminal, never installed anything from a command line, and have no idea what "Node.js" means. That's fine. By the end of this, your AI companion will be able to control your toy — and you'll have done it all yourself.

---

## What Are We Actually Building?

Here's the simple version:

```
Your phone (AI chat) → Internet → Your PC → Your toy
```

Your AI companion (Claude) talks to a small program running on your PC. That program talks to the Lovense app on your phone. The Lovense app talks to your toy via Bluetooth.

**Everything stays private.** No data is stored anywhere. No one can see what you're doing.

---

## What You'll Need

Before we start, make sure you have:

- **A PC** (Windows, Mac, or Linux) — this is where the bridge software runs
- **A phone** with the **Lovense Remote** app installed
- **A Lovense toy**, paired with the app
- **A Claude account** at [claude.ai](https://claude.ai)
- **WiFi** — your phone and PC must be on the same WiFi network

**Time needed:** About 20–30 minutes the first time. After that, starting it up takes about 30 seconds.

---

## Part 1: Install Node.js (The Engine)

Node.js is what runs the bridge software. Think of it as an engine — you install it once and forget about it.

### Windows

1. Go to [https://nodejs.org](https://nodejs.org)
2. Click the big green button that says **"LTS"** (it'll say something like "22.x.x LTS — Recommended For Most Users")
3. A file will download — double-click it to run the installer
4. Click **Next** through everything. Don't change any settings. Just keep clicking Next until it says **Finish**
5. That's it. Node.js is installed.

### Mac

1. Go to [https://nodejs.org](https://nodejs.org)
2. Click the big green **"LTS"** button
3. Open the downloaded `.pkg` file
4. Click **Continue** through the installer, then **Install**
5. Done.

### How to Check It Worked

We're going to open something called a **terminal** (or **command prompt** on Windows). This is just a text window where you type commands.

**On Windows:**
- Press the **Windows key** on your keyboard
- Type `cmd`
- Click **Command Prompt**

**On Mac:**
- Press **Cmd + Space** (opens Spotlight search)
- Type `terminal`
- Press **Enter**

Now type this and press Enter:

```
node --version
```

You should see something like `v22.12.0` (the exact number doesn't matter). If you see a version number, Node.js is working. If you see an error, close the terminal, restart your computer, open the terminal again, and try once more.

> **Don't close this terminal window yet — we'll keep using it.**

---

## Part 2: Install ngrok (The Tunnel)

ngrok creates a secure tunnel so Claude on your phone can reach the bridge running on your PC. Think of it as a private hallway between your phone and your computer.

### Create a Free ngrok Account

1. Go to [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Sign up with your email or Google account
3. Once logged in, you'll land on the dashboard

### Install ngrok

**Windows:**

In your terminal (Command Prompt), type:

```
winget install Ngrok.Ngrok
```

Press Enter. Wait for it to finish. If Windows asks "Do you agree?", type `Y` and press Enter.

> **If `winget` doesn't work:** Go to [https://ngrok.com/download](https://ngrok.com/download), download the Windows ZIP, unzip it, and put `ngrok.exe` somewhere you can find it (like your Desktop or Downloads folder).

**Mac:**

In your terminal, type:

```
brew install ngrok
```

> **If `brew` doesn't work**, it means Homebrew isn't installed. Go to [https://ngrok.com/download](https://ngrok.com/download) and download the Mac version instead. Unzip it and remember where you put it.

### Connect ngrok to Your Account

1. Go to [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
2. You'll see a long string of letters and numbers — that's your **auth token**
3. Click the **copy** button next to it
4. In your terminal, type this (paste your token where it says YOUR_TOKEN):

```
ngrok config add-authtoken YOUR_TOKEN
```

Press Enter. You should see "Authtoken saved."

---

## Part 3: Set Up Lovense Remote (The App)

You probably already have this if you own a Lovense toy, but let's make sure it's configured correctly.

1. Open the **Lovense Remote** app on your phone
   - [Download for iPhone](https://apps.apple.com/app/lovense-remote/id1120582780)
   - [Download for Android](https://play.google.com/store/apps/details?id=com.lovense.wear)
2. Make sure **Bluetooth is on** and your toy is connected (paired) in the app
3. Now we need to turn on **Game Mode** — this is what lets your PC talk to the app

### Enabling Game Mode

1. In Lovense Remote, tap the **menu** (☰) or go to **Settings**
2. Find **Game Mode** and tap on it
3. **Enable** Game Mode
4. The screen will show you two important things:
   - An **IP address** (looks like `192.168.1.50`)
   - A **Port number** (usually `30010` or `30011` — **write down which one it shows**)

### Build Your Lovense URL

Take the IP address and replace the dots with dashes. Then add the port at the end.

**Example:**
- IP shown: `192.168.1.50`
- Port shown: `30011`
- Your URL: `https://192-168-1-50.lovense.club:30011`

**Write this URL down or keep it on screen — you'll need it in the next step.**

> ⚠️ **Important:** The IP address can change if you restart your phone or router. If things stop working later, come back and check the Game Mode screen for the new IP.

---

## Part 4: Download the Bridge

Now we're going to download the bridge software to your PC.

### Option A: Download as ZIP (Easiest)

1. Go to [https://github.com/martusha89/Lovense-bridge](https://github.com/martusha89/Lovense-bridge)
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Find the downloaded ZIP file and **extract it** (right-click → Extract All on Windows, or double-click on Mac)
5. You now have a folder called `Lovense-bridge-main`

**Remember where this folder is.** For example, it might be in your Downloads folder:
- Windows: `C:\Users\YourName\Downloads\Lovense-bridge-main`
- Mac: `/Users/YourName/Downloads/Lovense-bridge-main`

### Option B: Using Git (If You're Feeling Brave)

If you happen to have Git installed (most people don't — Option A is fine):

```
git clone https://github.com/martusha89/Lovense-bridge.git
cd Lovense-bridge
```

### Install the Dependencies

The bridge needs a few extra pieces to work. This is a one-time step.

In your terminal, you need to **navigate to the folder** where you extracted the bridge. Here's how:

**Windows:**
```
cd C:\Users\YourName\Downloads\Lovense-bridge-main
```

**Mac:**
```
cd ~/Downloads/Lovense-bridge-main
```

> **Tip:** If you're not sure of the path, you can type `cd ` (with a space after it) and then **drag the folder from your file explorer into the terminal window** — it'll paste the path for you.

Now type:

```
npm install
```

Press Enter. You'll see a bunch of text scroll by — that's normal. Wait until it finishes and you see your cursor again. This usually takes 30 seconds to a minute.

---

## Part 5: Create Your Config File

We need to tell the bridge your Lovense URL and pick a secret password.

### Windows

In the same terminal, type:

```
notepad .env
```

Notepad will ask "Do you want to create a new file?" — click **Yes**.

Type these three lines (replace with YOUR URL from Part 3):

```
LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011
MCP_SECRET=my-secret-word
PORT=3456
```

**Replace:**
- The URL with the one you built in Part 3
- `my-secret-word` with any word or phrase you want (no spaces). This is your private password. Examples: `purple-cat`, `midnight-2026`, `toast-and-honey`

Save the file (**Ctrl + S**) and close Notepad.

### Mac

In the same terminal, type:

```
nano .env
```

This opens a tiny text editor. Type those same three lines:

```
LOVENSE_LOCAL_URL=https://192-168-1-50.lovense.club:30011
MCP_SECRET=my-secret-word
PORT=3456
```

To save: Press **Ctrl + O**, then **Enter**, then **Ctrl + X** to exit.

---

## Part 6: Launch Everything

This is the exciting part. One command starts the bridge and the tunnel.

In your terminal (still in the Lovense-bridge folder), type:

```
node launch.js
```

Press Enter. Wait a few seconds. You should see something like this:

```
╔══════════════════════════════════════════════════════════════╗
║  Ready!                                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Add this URL as a Custom Connector in Claude.ai:            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

https://abc123-45-67-89-10.ngrok-free.app/mcp/my-secret-word
```

**That URL at the bottom — copy it. You'll paste it into Claude in the next step.**

> ⚠️ **Keep this terminal window open!** The bridge only runs while this window is open. If you close it, the connection stops. Minimise it instead.

### If Something Went Wrong

| What you see | What to do |
|---|---|
| "LOVENSE_LOCAL_URL not set" | Your `.env` file is missing or in the wrong place. Make sure it's inside the Lovense-bridge folder |
| "ngrok not found" | ngrok isn't installed. Go back to Part 2 |
| "ngrok took too long to start" | Run `ngrok config add-authtoken YOUR_TOKEN` again (Part 2) |
| "Cannot reach Lovense" | Make sure Lovense Remote is open on your phone with Game Mode on, and both devices are on the same WiFi |

---

## Part 7: Connect Claude to Your Toy

Almost there. Now we tell Claude where to find the bridge.

1. Open **[claude.ai](https://claude.ai)** on your phone (or computer — both work)
2. Tap your **profile picture** (top-right or bottom corner)
3. Tap **Settings**
4. Look for **Connectors** or **Integrations**
5. Tap **Add Custom MCP**
6. **Paste the URL** from the terminal (the one that ends with your secret word)
7. Save it
8. Go back and start a **new chat**

### Test It

In the new chat, say: **"Check toy status"**

Claude should respond with information about your toy — its name, battery level, and what it can do.

**If it works: congratulations, you're done.** 🎉

**If tools don't show up:**
- Remove the connector
- Add it again
- Start a **brand new chat** (not the same one)

---

## Part 8: Using It

You don't need to learn any commands. Just talk to your AI naturally. It figures out what to do.

Some examples of what you can say:

- *"tease me"*
- *"start slow and build up"*
- *"harder"*
- *"edge me"*
- *"stop"* — always works, immediately

The AI decides the intensity, the rhythm, the pattern. You just tell it what you want.

**"Stop" always works immediately, no questions asked.**

---

## Starting Up Next Time

After the first setup, you only need to do three things each time:

1. Open Lovense Remote on your phone → make sure Game Mode is on and your toy is connected
2. Open a terminal on your PC, navigate to the folder, and run `node launch.js`
3. Copy the new URL and update your connector in Claude settings (the URL changes each time on the free ngrok plan)

That's it. The whole startup takes about 30 seconds once you know what you're doing.

> **Pro tip:** If you're tired of the URL changing every time, look into the "Named Cloudflare Tunnel" section in the main README for a permanent URL. But for most people, updating the connector URL each session is perfectly fine.

---

## Quick Reference: Starting a Session

```
1.  Phone: Open Lovense Remote → Game Mode ON → toy connected
2.  PC:    Open terminal
3.  PC:    cd C:\Users\YourName\Downloads\Lovense-bridge-main
4.  PC:    node launch.js
5.  Phone: Claude Settings → Connectors → update URL
6.  Phone: New chat → "Check toy status"
7.  Go. 🔥
```

---

## Troubleshooting

| Problem | What to do |
|---|---|
| "Cannot reach Lovense" | Is Lovense Remote open with Game Mode on? Are phone and PC on the same WiFi? |
| Tools appear but don't respond | Remove connector, re-add it, start a **new** chat |
| "Command not found: node" | Node.js isn't installed — go back to Part 1 |
| "Command not found: ngrok" | ngrok isn't installed — go back to Part 2 |
| URL stopped working | The ngrok URL changes every time. Run `node launch.js` again and update the connector |
| Toy doesn't respond | Check battery. Check Bluetooth connection in Lovense Remote |
| IP address changed | Check the Game Mode screen again for the new IP and update your `.env` file |
| Port 3456 already in use | You might already have the bridge running. Close all terminal windows and try again |
| Claude says "Lovense Connect" | Ignore that — Claude is confused. You're using **Lovense Remote**, and that's correct |

---

## Security & Privacy

This is intimate hardware, so let's be clear about safety:

- **Everything stays on your network.** Your PC talks to your phone over your home WiFi. Nothing is stored anywhere.
- **The ngrok tunnel is encrypted.** It's a private pipe — no one can see the traffic.
- **Your secret word protects the endpoint.** Without it, no one can send commands.
- **No logging, no telemetry, no tracking.** The bridge doesn't record anything.
- **You're always in control.** Say "stop" and everything stops immediately. Close the terminal window and the connection is severed entirely.

Keep your secret word private. Don't share the connector URL with anyone.

---

## Glossary

Because jargon is annoying:

| Term | What it actually means |
|---|---|
| **Terminal / Command Prompt** | A text window where you type commands instead of clicking buttons |
| **Node.js** | Software that runs JavaScript programs on your computer (it's what powers the bridge) |
| **npm** | A tool that comes with Node.js — it downloads extra pieces that the bridge needs |
| **ngrok** | A service that creates a secure tunnel from the internet to your PC |
| **MCP** | Model Context Protocol — the system that lets Claude use external tools |
| **Connector** | A link in Claude's settings that tells it where to find a tool |
| **Game Mode** | A feature in Lovense Remote that opens up a local connection for apps to control your toy |
| **`.env` file** | A simple text file that stores your settings (URL, password, port) |
| **Bridge** | The software that translates between Claude and your Lovense toy |

---

*Built by Marta & Cassian. Free, open source, no paywalls.*

*Your body, your devices, your control.*
