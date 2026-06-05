# Installing FocusBoard

Four ways to run FocusBoard. Pick the one that fits your setup.

## Platform support summary

| Platform | Supported now | How |
|---|---|---|
| **Windows** | ✅ Full support | Native (Option 1) or Docker (Option 2) |
| **Mac** | ⚠️ Docker only | Option 2 — with limitations (see below) |
| **Linux** | ⚠️ Docker only | Option 2 |

### Mac limitations (Docker)

Mac users can run FocusBoard today via Docker, but with these limitations:

| Feature | Mac + Docker | Reason |
|---|---|---|
| Jira, Gmail, Calendar, GitHub, Claude AI | ✅ | API-based, works everywhere |
| **Slack toast notifications** | ❌ | Uses Windows-only desktop APIs — macOS does not allow third-party apps to read other apps' notifications (Apple sandbox model) |
| **Watchdog auto-restart** | ❌ | Uses PowerShell — `restart: unless-stopped` in Docker replaces this |

**Slack on Mac:** Without the Slack bot token, there is no Slack integration on Mac. The Windows notification capture is not possible on macOS. Once a Slack bot token is configured in Settings, API-based Slack fetching works on all platforms including Mac.

A native Mac app (`.dmg`) is planned for v1.4 but the Slack limitation remains until bot token access is available.

---

## Option 1 — Windows (native) ✅

**Best for:** Windows users who are comfortable with PowerShell. Everything runs natively — no Docker, no terminal after setup.

### Requirements
- Windows 10 or 11
- Git
- PowerShell (built into Windows)

### Steps

```powershell
# 1. Clone
git clone https://github.com/Briancoughlin/FocusBoard.git
cd FocusBoard

# 2. Run the setup script as Administrator
#    (right-click PowerShell → Run as Administrator)
.\setup.ps1
```

The script installs Node.js if needed, builds the app, and registers four Windows Scheduled Tasks that start automatically at login:

| Task | What it does |
|---|---|
| `FocusBoard` | Main server on port 3001 |
| `FocusBoardNotifications` | Captures Slack Windows toast notifications |
| `FocusBoardBackup` | Nightly data backup |
| `FocusBoardWatchdog` | Restarts FocusBoard if it crashes |

Open **http://localhost:3001** in your browser. Install as a desktop app via Chrome's ⊕ install button.

### Managing the service
```powershell
# Stop
Stop-ScheduledTask -TaskName "FocusBoard"

# Start
Start-ScheduledTask -TaskName "FocusBoard"

# Update to latest version
cd C:\path\to\FocusBoard
.\build.ps1
```

---

## Option 2 — Docker ✅

**Best for:** Anyone already using Docker. Works on Windows, Mac, and Linux. Zero Node.js setup required.

Runs as two containers wired together:
- **frontend** — nginx serves the React app and proxies `/api/` calls to the backend
- **backend** — Node.js API, only reachable from the nginx container (not exposed to the host)

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine (Linux)

### Steps

```bash
# 1. Download the compose file and env template
curl -O https://raw.githubusercontent.com/Briancoughlin/FocusBoard/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/Briancoughlin/FocusBoard/main/.env.example

# 2. Create your .env with a secure encryption key
cp .env.example .env

# Generate a random key and paste it into .env:
openssl rand -hex 32
# Windows (PowerShell):
# -join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })

# Edit .env — replace the placeholder with your generated key
```

Your `.env` should look like:
```
FOCUSBOARD_KEY=a1b2c3d4e5f6...your64hexcharshere...
```

```bash
# 3. Build and start both containers
docker compose up -d --build

# 4. Open in your browser
open http://localhost:3001
```

### Managing the containers
```bash
# View logs (both containers)
docker compose logs -f

# View logs for one container
docker compose logs -f backend
docker compose logs -f frontend

# Stop
docker compose down

# Update to latest version
docker compose pull
docker compose up -d

# View your data
ls ./focusboard-data/
```

### Architecture
```
Browser → http://localhost:3001
            ↓
        [nginx container]
        serves React SPA
            ↓ /api/* proxy
        [Node.js container]  ← NOT accessible from outside Docker
        handles API calls
            ↓
        ./focusboard-data/   ← your data on the host
```

### Notes
- Your credentials and data live in `./focusboard-data/` on your machine — back this up
- `FOCUSBOARD_KEY` encrypts your stored API tokens — never change it once set
- `restart: unless-stopped` on both containers replaces the Windows watchdog

### Slack limitations in Docker
Slack toast notification capture **does not work** in Docker on any platform:
- **Windows + Docker:** The Windows notification watcher runs natively but cannot communicate with the Docker backend's in-process queue
- **Mac + Docker:** macOS does not expose other apps' notifications to third-party processes — Apple's sandbox model prevents this entirely
- **Linux + Docker:** No desktop notification system available

**The only Slack solution in Docker is a bot token.** Add it in Settings → Integrations → Slack → Bot Token. This works on all platforms and gives you DMs and mentions via the Slack API.

---

## Option 3 — Windows .exe 🔜 Coming in v1.4

**Best for:** Non-technical Windows users. Download, double-click, done. No Git, no Node.js, no terminals.

> **Status:** In development. Will be available as a download on the [Releases](https://github.com/Briancoughlin/FocusBoard/releases) page when v1.4 ships.

What to expect:
- Single `.exe` file — no installation required
- Double-click to start, system tray icon to manage
- Settings UI for all credentials
- Auto-update when new versions are available

---

## Option 4 — Mac native 🔜 Coming in v1.4

**Best for:** Mac users who want a native experience without Docker.

> **Status:** In development alongside the Windows .exe. Will be available as a `.dmg` download with v1.4.
>
> **Mac users today:** Use Option 2 (Docker) — see [Mac limitations](#mac-limitations-docker) above.

What to expect:
- Universal binary (Apple Silicon + Intel)
- Launches as a background service via launchd
- Menu bar icon
- All integrations work — **except** Slack toast notifications (macOS does not allow third-party apps to read other apps' notifications — a Slack bot token is required for Slack on Mac)

---

## Choosing an option

| | Windows (native) | Docker | Windows .exe | Mac native |
|---|---|---|---|---|
| **Requires Node.js** | Auto-installed | ❌ No | ❌ No | ❌ No |
| **Requires Git** | Yes | ❌ No | ❌ No | ❌ No |
| **Auto-starts at login** | ✅ | Depends on Docker | ✅ | ✅ (launchd) |
| **Slack toast notifications** | ✅ | ❌ Not possible | ✅ | ❌ macOS limitation |
| **Slack via bot token** | ✅ | ✅ | ✅ | ✅ |
| **Watchdog auto-restart** | ✅ | Via Docker restart | ✅ | ✅ |
| **Works on Mac** | ❌ | ✅ (with limitations) | ❌ | ✅ |
| **Works on Linux** | ❌ | ✅ | ❌ | ❌ |
| **Available now** | ✅ | ✅ | 🔜 v1.4 | 🔜 v1.4 |

---

## After installing

Whichever method you chose, open **http://localhost:3001** and go to **Settings → Integrations** to connect your services.

See [README.md](README.md) for the full setup guide including Jira, Gmail, GitHub, and Slack configuration.
