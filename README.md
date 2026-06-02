# FocusBoard

An ADHD-friendly task aggregator that pulls your work from Jira, Gmail, Google Calendar, Slack, and Zoom meeting notes into a single drag-and-drop board. Designed to reduce context switching and help you stay focused on what matters most.

Runs locally on your machine — your data never leaves your computer.

---

## Installation

### Requirements
- Windows 10 or 11
- Google Chrome (for PWA install)
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
- Open http://localhost:3001 in your browser

### Step 3 — Install as a desktop app (optional but recommended)

In Chrome, look for the **⊕ install icon** in the far right of the address bar → click **Install FocusBoard**. It will open in its own window without a browser bar, just like a native app.

### Step 4 — Connect your services

Go to **Settings** (gear icon) and enter your credentials. See the Integration Setup section below for how to get each one.

---

## After Installation

FocusBoard starts automatically every time you log into Windows. It runs at **http://localhost:3001**.

### Stopping FocusBoard
```powershell
Stop-ScheduledTask -TaskName "FocusBoard"
```

### Starting it again
```powershell
Start-ScheduledTask -TaskName "FocusBoard"
```

### Uninstalling
```powershell
Stop-ScheduledTask -TaskName "FocusBoard"
Unregister-ScheduledTask -TaskName "FocusBoard" -Confirm:$false
```

### Updating after code changes
```powershell
cd C:\path\to\focusboard
.\build.ps1
Restart-ScheduledTask -TaskName "FocusBoard"
```

---

## Integration Setup

Go to **Settings** (gear icon) to configure each source. You only need to do this once — credentials are saved locally.

### Anthropic API Key (optional — enhances Gmail, Slack + Quick Add)
1. Go to https://console.anthropic.com/account/keys
2. Create a new API key
3. Paste into **Settings → Anthropic**

Without this key the app still works — Quick Add falls back to bullet-point splitting, and Gmail/Slack show raw items without AI extraction.

---

### Jira

#### Atlassian Cloud (yourorg.atlassian.net)
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**, copy it
3. In Settings: enter your Jira URL, email, and token

#### Unity Jira (jira.unity3d.com)
Unity uses a plugin-based token — standard Atlassian tokens won't work.

1. Make sure you're in the `Engine All` group (check your [Jira Profile](https://jira.unity3d.com/secure/ViewProfile.jspa))
2. Go to https://jira.unity3d.com/plugins/servlet/de.resolution.apitokenauth/admin
3. Click **New API Token** → name it, set scope to **Read & Write** → copy the token
4. Connect to **Unity VPN or Netbird** before syncing
5. In Settings:
   - Jira URL: `https://jira.unity3d.com`
   - Email: your Unity email
   - Token: the one you just created

You can also paste a custom **JQL filter** in Settings to show exactly the tickets you want (e.g. your team board filter).

---

### Google (Gmail + Calendar)

You need a Google Cloud project to get OAuth credentials. A personal Google account works fine for this even if you connect your work Gmail.

1. Go to https://console.cloud.google.com and sign in
2. Create a new project named `FocusBoard`
3. Go to **APIs & Services → Library**, enable:
   - Gmail API
   - Google Calendar API
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** → fill in app name and your email → save
   - Add your work email as a **Test user**
5. Go to **Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application**
   - Authorised redirect URI: `http://localhost:3001/auth/google/callback`
6. Copy **Client ID** and **Client Secret** into FocusBoard Settings
7. Click **Save All**, then **Connect Google Account**
8. Sign in with your **work** Google account in the popup

Calendar automatically filters out working-location events (Home/Office) and solo location events.

---

### Slack
Requires workspace admin approval to create an app. Contact your IT team.

1. Go to https://api.slack.com/apps → **Create New App → From scratch**
2. Go to **OAuth & Permissions → Bot Token Scopes**, add:
   - `channels:history`, `im:history`, `im:read`, `search:read`, `users:read`
3. Click **Install to Workspace** → authorize
4. Copy the **Bot User OAuth Token** (`xoxb-...`) into Settings

---

### Zoom Meeting Summaries
Direct Zoom API integration requires IT admin approval. In the meantime use Quick Add:

1. After a Zoom meeting, copy the AI-generated action item checklist
2. Click **Quick Add** in the FocusBoard header
3. Paste the checklist — each item becomes a card in the Zoom/Notes tab

---

## Features

### Focus View (default)
Split view with your week calendar on top and tasks below. Drag the divider to resize. Pre-filtered to show only this week's tasks. Inbox sidebar on the right for Gmail and Slack messages.

### Board View
Full kanban board with all tasks. Filter by source: **All / This Week / Jira / Gmail / Slack / Zoom+Notes**

### Urgency Indicators
- 🔴 Red strip = overdue
- 🟠 Orange strip = due today
- 🟡 Yellow strip = due within 3 days
- Priority badge on Jira tickets (High / Med / Low)

### Daily Digest
Opens automatically each morning — overdue items, due today, meetings, high priority tasks at a glance. Click the newspaper icon to reopen anytime.

### Quick Add
Paste Zoom summaries, meeting notes, or any text. Each action item becomes a card. AI-powered with Anthropic key, bullet-point splitting without.

### Done Column
Only shows tasks completed today — resets to a clean slate each morning.

### Completed Today Counter
Trophy icon counts tasks completed today. Good for the dopamine.

### Auto-Refresh
Syncs all sources every 5 minutes automatically.

---

## Project Structure

```
focusboard/
  setup.ps1              — One-command installer for new machines
  build.ps1              — Rebuilds frontend after code changes
  backend/
    server.js            — Express app (port 3001), serves frontend + API
    routes/
      jira.js            — Jira REST API (Cloud + Data Center)
      gmail.js           — Gmail API + Claude extraction
      calendar.js        — Google Calendar API
      slack.js           — Slack Web API + Claude extraction
      paste.js           — Quick Add text processing
      claude.js          — Anthropic SDK helper
    config.json          — Local credentials (gitignored)
  frontend/
    src/
      App.tsx            — Root, state management, auto-refresh
      components/
        FocusView.tsx    — Split calendar + kanban view
        WeekView.tsx     — Weekly calendar strip
        InboxSidebar.tsx — Gmail/Slack notification panel
        KanbanBoard.tsx  — Full board with source tabs
        KanbanColumn.tsx — Droppable column
        TaskCard.tsx     — Draggable card with urgency + dismiss
        Header.tsx       — Nav, Quick Add, digest, trophy
        SettingsPage.tsx — Integration config
        DailyDigest.tsx  — Morning summary
        PastePanel.tsx   — Quick Add panel
        JiraDonePrompt.tsx — Prompt to close ticket in Jira
        SourceBadge.tsx  — Source pill
      services/api.ts    — API fetch wrappers
      types.ts           — TypeScript types
    public/
      manifest.json      — PWA manifest
      sw.js              — Service worker
```

## Data & Security

All data is stored locally on your machine — nothing is sent to any external server beyond the APIs you configure.

| Data | Where stored |
|------|-------------|
| API credentials | `backend/config.json` (gitignored) |
| Column positions (drag overrides) | `backend/data/overrides.json` |
| Pasted/Quick Add tasks | `backend/data/pasted-tasks.json` |
| Dismissed cards | `backend/data/dismissed.json` |
| Done dates | `backend/data/done-dates.json` |
| Completed today count | `backend/data/completed-today.json` |
| Inbox read state | `backend/data/inbox-read.json` |
| Focus view split position | `backend/data/split-percent.json` |

Data in `backend/data/` survives browser cache clears and browser switches since it lives on disk, not in the browser. Both `config.json` and `data/` are gitignored so nothing sensitive is ever committed.

- Tokens are masked in the Settings UI (shown as `••••••••`)
- Everything runs locally — no cloud, no telemetry
