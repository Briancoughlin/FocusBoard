# Installing FocusBoard

Four ways to run FocusBoard. Pick the one that fits your setup.

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

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine (Linux)

### Steps

```bash
# 1. Download the compose file
curl -O https://raw.githubusercontent.com/Briancoughlin/FocusBoard/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/Briancoughlin/FocusBoard/main/.env.example

# 2. Create your .env file with a secure key
cp .env.example .env

# Generate a random key (run this and paste the output into .env)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# — or on Mac/Linux:
openssl rand -hex 32

# Edit .env and replace the placeholder with your generated key
```

Your `.env` file should look like:
```
FOCUSBOARD_KEY=a1b2c3d4e5f6...your64hexcharshere...
```

```bash
# 3. Start FocusBoard
docker compose up -d

# 4. Open in your browser
open http://localhost:3001
```

### Managing the container
```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Update to latest version
docker compose pull
docker compose up -d

# View data (tasks, config, backups)
ls ./focusboard-data/
```

### Notes
- Your credentials and data are stored in `./focusboard-data/` next to your compose file
- The `FOCUSBOARD_KEY` encrypts your stored API tokens — keep it safe and don't change it
- Windows toast notifications (Slack capture) are not available in Docker — use the Slack API token instead
- The watchdog restart feature is not available in Docker — Docker's `restart: unless-stopped` handles crashes instead

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

## Option 4 — Mac 🔜 Coming in v1.4

**Best for:** Mac users who want a native experience without Docker.

> **Status:** In development alongside the Windows .exe. Will be available as a `.dmg` download with v1.4.

What to expect:
- Universal binary (Apple Silicon + Intel)
- Launches as a background service via launchd
- Menu bar icon
- Note: Slack Windows notification capture is Windows-only — use the Slack API token on Mac

---

## Choosing an option

| | Windows (native) | Docker | Windows .exe | Mac |
|---|---|---|---|---|
| **Requires Node.js** | Auto-installed | ❌ No | ❌ No | ❌ No |
| **Requires Git** | Yes | ❌ No | ❌ No | ❌ No |
| **Auto-starts at login** | ✅ | Depends on Docker | ✅ | ✅ |
| **Slack toast notifications** | ✅ | ❌ | ✅ | ❌ |
| **Watchdog auto-restart** | ✅ | Via Docker | ✅ | ✅ |
| **Works on Mac** | ❌ | ✅ | ❌ | ✅ |
| **Works on Linux** | ❌ | ✅ | ❌ | ❌ |
| **Available now** | ✅ | ✅ | Soon | Soon |

---

## After installing

Whichever method you chose, open **http://localhost:3001** and go to **Settings → Integrations** to connect your services.

See [README.md](README.md) for the full setup guide including Jira, Gmail, GitHub, and Slack configuration.
