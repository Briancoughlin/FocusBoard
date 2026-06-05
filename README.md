# FocusBoard

An ADHD-friendly task aggregator that pulls your work from Jira, Gmail, Google Calendar, Slack, GitHub and Zoom meeting notes into a single hub. Designed to reduce context switching and help you stay focused on what matters most.

Runs locally on your machine — your data never leaves your computer.

---

## Production Quality

FocusBoard is built to production standards despite being a personal tool. Here's what's under the hood:

### 🔒 Security
- **AES-256-GCM encrypted config** — all API tokens and credentials are encrypted at rest, tied to your machine. Useless if copied elsewhere.
- **Session cookie auth** — the local API requires a session cookie. Remote requests (e.g. port forwarding) are blocked.
- **No secrets in code** — gitignored config, masked tokens in the UI, secret scanning in CI.
- **Input validation** — all API endpoints validate types, lengths and allowlists before processing.
- **Dependency scanning** — Dependabot runs weekly, auto-merging patch/minor updates when CI passes.

### 🧪 Testing
- **135 automated tests** — 76 backend + 59 frontend across 16 suites:
  - Jira status mapping (9 tests) — Unity-specific status names
  - AES-256-GCM encryption (5 tests) — config security
  - Config merge logic (5 tests) — input validation and secret masking
  - Task cache (4 tests) — read/write round-trip
  - Urgency scoring (10 tests) — core ADHD prioritisation logic
  - Task filtering (7 tests) — overrides, done dates, wontdo
  - Week view filter (7 tests) — Focus view inclusion rules
  - Action log buffer (8 tests) — circular buffer behaviour
- **Code coverage** (measured on pure logic files, excluding React UI components):
  - `actionLog.ts` — 100% statements
  - `TaskCard.tsx` (logic only) — 23% statements (JSX rendering excluded by design)
  - `api.ts` — 0% statements (HTTP calls require a live server; not unit-tested)
  - `persistence.ts` — 0% statements (localStorage calls; not unit-tested)
  - `theme.ts` — 0% statements (DOM manipulation; not unit-tested)
  - *Note: React component JSX rendering and service files that wrap browser APIs are intentionally excluded from coverage measurement. UI behaviour is validated through manual testing and the smoke test suite. The coverage numbers above reflect only the files included in measurement scope.*
- Tests run on every commit via pre-commit hooks and GitHub Actions CI.

### 🔄 CI/CD Pipeline
Every push to `main` runs:
1. Backend tests (`node --test`)
2. Frontend tests (Vitest)
3. ESLint (frontend + backend)
4. TypeScript type check
5. Frontend build
6. Security audit (`npm audit --audit-level=high`)
7. Secret scanning (regex patterns for tokens)

### 🛡️ Error Recovery
- **React error boundary** — JS errors show a recovery UI, not a white screen
- **Google token auto-refresh** — OAuth tokens renew silently without re-authentication
- **Offline detection** — yellow banner when offline, auto-syncs on reconnect
- **Crash recovery** — EADDRINUSE handled gracefully with auto-retry; uncaught exceptions logged not swallowed
- **Config health check** — integration status logged on every server startup

### 📊 Observability
- **Structured JSON logging** — every API call, sync, error and slow request logged to `backend/logs/server-YYYY-MM-DD.log`
- **Performance monitoring** — API calls over 2 seconds flagged as warnings; syncs over 10 seconds surfaced in the UI
- **7-day log retention** — automatic log rotation

### 🔁 Updates
- **GitHub Releases** — versioned releases with changelog notes
- **In-app update banner** — checks for new versions daily, shows "What's new" link
- **One-click update** — pulls latest code, rebuilds frontend, restarts server automatically

### ♿ Accessibility
- **Screen reader compatible** — all buttons, dialogs, tabs and status regions have descriptive ARIA labels, roles and live regions
- **Colourblind-safe urgency indicators** — every colour signal has a secondary pattern and text label:
  - Overdue: red strip + `▲▲▲` triangles + "Overdue" badge
  - Due today: orange strip + `◆◆◆` diamonds + "Due today" badge
  - Due soon: yellow strip + `···` dots
- **Source badges** — always include text labels, colour is decorative
- **Keyboard navigation** — all interactive elements are focusable; sidebar sections support Enter/Space
- **Known limitation** — drag-and-drop requires a pointing device; keyboard drag is on the roadmap
- **Automated accessibility testing** — axe-core audit runs on every CI push; 11 dedicated accessibility unit tests verify urgency indicators, sort order, and source label integrity

See [docs/accessibility.md](docs/accessibility.md) for full details, automated test coverage, and WCAG conformance status.

### 🧹 Code Quality
- **ESLint** configured for TypeScript/React (frontend) and Node.js (backend)
- **Pre-commit hooks** (husky) — lint + tests must pass before any commit is allowed
- **JSDoc comments** on all key files — server, routes, App, FocusView, WeekView
- **TypeScript** throughout the frontend with strict type checking

---

## Installation

### Requirements
- Windows 10 or 11
- Google Chrome or Edge (for PWA install)
- Git (to clone the repo)

### Step 1 — Clone the repo

```powershell
git clone https://github.com/briancoughlin/focusboard.git
cd focusboard
```

### Step 2 — Run the setup script

Open PowerShell **as Administrator** (right-click → Run as Administrator):

```powershell
cd C:\path\to\focusboard
.\setup.ps1
```

The script will:
- Install Node.js automatically if not already installed
- Install all dependencies
- Build the app
- Register FocusBoard to start automatically at Windows login
- Register the Slack notification watcher (captures Windows toast notifications)
- Open http://localhost:3001 in your browser

### Step 3 — Install as a desktop app (optional but recommended)

In Chrome, look for the **⊕ install icon** in the far right of the address bar → click **Install FocusBoard**. Opens in its own window without a browser bar, just like a native app.

### Step 4 — Allow notification access (for Slack integration)

Go to **Windows Settings → Privacy & Security → Notifications** and enable **"Allow apps to access your notifications"**. This lets FocusBoard capture Slack Windows notifications automatically.

### Step 5 — Connect your services

Go to **Settings** (gear icon) and enter your credentials. See the Integration Setup section below.

---

## Installation

Docker is now available as an alternative to the Windows native setup — no Node.js required. See [INSTALL.md](INSTALL.md) for all four installation options (Windows native, Docker, Windows .exe coming, Mac coming).

## After Installation

FocusBoard starts automatically every time you log into Windows. It runs at **http://localhost:3001**.

Four background services run:
- **FocusBoard** — the main server (port 3001)
- **FocusBoardNotifications** — captures Slack Windows notifications
- **FocusBoardBackup** — nightly gzipped backup of all app data
- **FocusBoardWatchdog** — watchdog process (port 3002) that can restart FocusBoard on demand

```powershell
# Stop
Stop-ScheduledTask -TaskName "FocusBoard"
Stop-ScheduledTask -TaskName "FocusBoardNotifications"
Stop-ScheduledTask -TaskName "FocusBoardBackup"
Stop-ScheduledTask -TaskName "FocusBoardWatchdog"

# Start
Start-ScheduledTask -TaskName "FocusBoard"
Start-ScheduledTask -TaskName "FocusBoardNotifications"
Start-ScheduledTask -TaskName "FocusBoardBackup"
Start-ScheduledTask -TaskName "FocusBoardWatchdog"

# Uninstall
Unregister-ScheduledTask -TaskName "FocusBoard" -Confirm:$false
Unregister-ScheduledTask -TaskName "FocusBoardNotifications" -Confirm:$false
Unregister-ScheduledTask -TaskName "FocusBoardBackup" -Confirm:$false
Unregister-ScheduledTask -TaskName "FocusBoardWatchdog" -Confirm:$false
```

### Updating after code changes
```powershell
cd C:\path\to\focusboard
.\build.ps1
Stop-ScheduledTask -TaskName "FocusBoard"
Stop-ScheduledTask -TaskName "FocusBoardWatchdog"
Start-ScheduledTask -TaskName "FocusBoard"
Start-ScheduledTask -TaskName "FocusBoardWatchdog"
```

---

## Integration Setup

Go to **Settings** (gear icon) to configure each source.

### Anthropic / U-AI Gateway
Required for Gmail AI extraction and smart Quick Add.

- **Unity employees**: Go to the U-AI Portal, generate a key, and enter:
  - API Key: your U-AI token
  - Base URL: `https://uai-litellm.internal.unity.com`
- **Others**: Go to https://console.anthropic.com/account/keys, create a key, paste into Settings

Without a key: Quick Add falls back to bullet-point splitting, Gmail shows raw items.

---

### Jira

#### Atlassian Cloud (yourorg.atlassian.net)
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create an API token and copy it
3. In Settings: enter your Jira URL, email, token, and optionally a JQL filter and default project key

#### Unity Jira (jira.unity3d.com)
1. Make sure you're in the `Engine All` group
2. Go to https://jira.unity3d.com/plugins/servlet/de.resolution.apitokenauth/admin
3. Click **New API Token** → scope **Read & Write** → copy it
4. Connect to **Unity VPN or Netbird** before syncing
5. In Settings: URL = `https://jira.unity3d.com`, your Unity email, and the token

**Additional Jira Settings:**
- **JQL Filter** — paste your board's JQL to show only relevant tickets
- **Default Project Key** — e.g. `CSD` — pre-selected when creating tickets from FocusBoard
- **Epic filter** — dropdown in Focus view to filter kanban by epic

**Jira Write-Back:** Moving a card between columns automatically updates the ticket status in Jira. Creating a ticket from FocusBoard also creates it in Jira with your chosen project, issue type, priority, fix version, and initial status.

---

### Google (Gmail + Calendar)

1. Go to https://console.cloud.google.com (personal Google account is fine)
2. Create a project named `FocusBoard`
3. Enable **Gmail API** and **Google Calendar API**
4. Create OAuth credentials (Web application type, redirect URI: `http://localhost:3001/auth/google/callback`)
5. Add your work email as a test user on the OAuth consent screen
6. Paste Client ID and Client Secret into Settings, then click **Connect Google Account**

Gmail: fetches today's emails, AI extracts action items.
Calendar: shows this week's events in the Focus view week strip. Filters out working-location events (Home/Office).

---

### Slack

**Option A — Windows Notification Capture (no IT approval needed)**
FocusBoard automatically captures Slack Windows toast notifications when you receive DMs or mentions.

Setup:
1. Enable notification access: Windows Settings → Privacy → Notifications → Allow apps to access notifications
2. In Settings → Slack: enter your **Workspace URL** (e.g. `https://unity.slack.com`) and **Team ID** (from `app.slack.com/client/TEAM_ID/...`)
3. Add channel IDs in the **Channel ID Map** for direct linking — FocusBoard will prompt you to add them when new channels appear
4. Set Slack to email you for DMs/mentions when away (as a backup)

Notifications appear in the Slack section of the sidebar within 10 seconds.

**Option B — Bot Token (requires IT approval)**
1. Create a Slack app at https://api.slack.com/apps
2. Add scopes: `channels:history`, `im:history`, `im:read`, `search:read`, `users:read`
3. Install to workspace and copy the Bot User OAuth Token (`xoxb-...`) into Settings

---

### GitHub

Works with both github.com and GitHub Enterprise.

1. Go to https://github.com/settings/tokens (or your Enterprise equivalent)
2. Create a token with scopes: `repo`, `notifications`, `read:user`
3. Paste into Settings → GitHub
4. For GitHub Enterprise: also enter your Base URL (e.g. `https://github.unity3d.com/api/v3`)

Shows: PRs awaiting your review, your open PRs, assigned issues, CI pass/fail notifications.

---

### Zoom Meeting Summaries

Direct Zoom API requires IT approval. Workaround:

1. After a meeting, copy the AI-generated action item checklist
2. Click **Quick Add** in the header
3. Paste — each item becomes a card in the Zoom/Notes tab

---

## Features

### Focus View (default)
- **Week calendar** (top) — shows your calendar events for the week. Click a day to filter the kanban to that day's tasks. Drag a kanban card onto a calendar day to schedule it.
- **Kanban** (bottom) — shows this week's tasks + high priority items. Drag the handle to resize.
- **Inbox sidebar** (right) — three collapsible sections: GitHub notifications, Slack messages, Gmail action items
- **Epic filter** — dropdown to scope the kanban to a specific epic
- **Pin to Focus** — 📌 button on any card in Backlog view pins it to always appear in Focus

### Backlog View
Full kanban with all tasks. Filter by source: **All / Jira / Gmail / GitHub / Zoom+Notes**

### Jira Integration
- **Read** — fetches all assigned tickets with correct status mapping to your board columns
- **Write** — moving a card updates the Jira ticket status automatically
- **Create** — move a non-Jira card to In Progress → prompted to create a Jira ticket (project, type, priority, fix version, initial status all selectable)
- **Fix version** shown on each Jira card

### Slack Notifications
- Windows toast notifications captured within 10 seconds of arrival
- Appear in sidebar Slack section with direct channel links
- Click to open Slack at the right channel
- Channel ID map (Settings → Slack) enables precise deep linking

### GitHub CI Notifications
- ✅ CI pass / ❌ CI fail appear in sidebar within 5 minutes
- Colour coded: green for pass, red for fail
- Click to open the workflow run

### Urgency Indicators
- 🔴 Red strip = overdue
- 🟠 Orange strip = due today
- 🟡 Yellow strip = due within 3 days
- Priority badge on Jira cards (High / Med / Low)
- Fix version shown on Jira cards

### Daily Digest
Opens each morning — overdue, due today, meetings, high priority tasks. Newspaper icon reopens it anytime.

### Quick Add
Paste any text — Zoom checklist, meeting notes, single line reminder. AI extracts action items. Falls back to bullet-point splitting without an AI key. Single lines always create one card.

### Task Scheduling
Drag any card onto a calendar day in Focus view to schedule it. Cards with due dates appear on their day in the calendar with a source-coloured left border.

### Done Column
Only shows tasks completed today — resets each morning. Trophy counter tracks daily completions.

### Privacy Mode
Click the 👁 eye icon in the header to instantly blur all content on screen. Useful for demos, screen recordings, or any situation where you need to share your screen without exposing task details. Click again to reveal.

### Watcher Heartbeat Indicator
The notification watcher pings the server every 10 seconds. A 🟢 green dot in the sidebar confirms the watcher is alive; 🔴 red means it has stopped responding. This makes it immediately obvious if notifications have silently stopped working.

### API Cutover Date
Settings → API Cutover section includes a date picker to record when your team switches to a new API. Used as context in reports and digest summaries.

### Nightly Backups
All app data is automatically backed up each night as a gzipped JSON bundle in `backend/backups/`. Backups can be restored via `backend/restore.js`. Old backups are automatically pruned to save disk space.

### Theming
Automatically follows your Windows accent colour and dark/light mode. Manual override available in Settings → Appearance.

### Accessibility
Full tooltip coverage on all buttons and icons. Screen reader compatible with ARIA labels, roles, and live regions throughout.

### Auto-Refresh
All sources sync every 5 minutes automatically.

---

## Project Structure

```
focusboard/
  setup.ps1                    — One-command installer for new machines
  build.ps1                    — Rebuilds frontend after code changes
  backend/
    server.js                  — Express app (port 3001)
    notification-watcher.js    — Slack Windows notification capture
    routes/
      jira.js                  — Jira read (tickets, epics, fix versions)
      jira-create.js           — Jira write (create tickets, transition status)
      gmail.js                 — Gmail API + Claude extraction
      calendar.js              — Google Calendar API
      slack.js                 — Slack Web API
      slack-notification.js    — Windows notification receiver
      github.js                — GitHub PRs, reviews, CI notifications
      paste.js                 — Quick Add text processing
      claude.js                — Anthropic SDK helper
      persistence.js           — Local data storage
      theme.js                 — Windows theme reader
    config.json                — Credentials (gitignored, AES-256-GCM encrypted)
    data/                      — Persistent app state (gitignored)
  frontend/
    src/
      App.tsx                  — Root, state, Jira write-back
      components/
        FocusView.tsx          — Split calendar + kanban + inbox
        WeekView.tsx           — Weekly calendar with drag-to-schedule
        InboxSidebar.tsx       — GitHub / Slack / Gmail notification panel
        KanbanBoard.tsx        — Backlog with source filter tabs
        KanbanColumn.tsx       — Droppable column
        TaskCard.tsx           — Draggable card (urgency, pin, dismiss)
        Header.tsx             — Nav, Quick Add, digest, trophy
        SettingsPage.tsx       — All integration settings
        DailyDigest.tsx        — Morning summary popup
        PastePanel.tsx         — Quick Add panel
        JiraCreatePrompt.tsx   — Create Jira ticket from non-Jira card
        JiraDonePrompt.tsx     — Open Jira when marking done (fallback)
        SlackChannelPrompt.tsx — Capture Slack channel IDs on first use
        SourceBadge.tsx        — Coloured source pill
      services/
        api.ts                 — API fetch wrappers incl. Jira transition
        persistence.ts         — Backend persistence client
        theme.ts               — Windows theme reader
      types.ts                 — TypeScript types
    public/
      manifest.json            — PWA manifest
      sw.js                    — Service worker
```

## Data & Security

All data stays on your machine. Nothing sent to external servers beyond the APIs you configure.

| Data | Where stored |
|------|-------------|
| API credentials | `backend/config.json` (gitignored, AES-256-GCM encrypted) |
| Column positions | `backend/data/overrides.json` |
| Quick Add tasks | `backend/data/pasted-tasks.json` |
| Injected Jira tasks | `backend/data/injected-tasks.json` |
| Pinned tasks | `backend/data/pinned-tasks.json` |
| Dismissed cards | `backend/data/dismissed.json` |
| Due date overrides | `backend/data/due-date-overrides.json` |
| Done dates | `backend/data/done-dates.json` |
| Completed today | `backend/data/completed-today.json` |
| Completed history log | `backend/data/completed-history.json` |
| Nightly backups | `backend/backups/` (gzipped JSON bundles, auto-rotated) |
| Inbox read state | `backend/data/inbox-read.json` |
| Slack notifications | `backend/data/slack-notifications.json` |
| Focus view split | `backend/data/split-percent.json` |
| Theme preferences | `backend/data/theme-*.json` |

- Config is AES-256-GCM encrypted — useless if copied to another machine
- Tokens masked in Settings UI
- Session cookie required for all API access
- No telemetry, no cloud storage
