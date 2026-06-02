<<<<<<< HEAD
# FocusBoard

An ADHD-friendly task aggregator with a Kanban board UI. Pulls tasks from Jira, Gmail, Google Calendar, and Slack into a single drag-and-drop board. Uses Claude AI to extract action items from emails and messages.

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend (new terminal)
cd frontend
npm install
```

### 2. Configure integrations

Start the backend, then open http://localhost:5173 and go to **Settings**.

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

---

## Integration Setup

### Anthropic API Key (required for Gmail + Slack AI extraction)

1. Go to https://console.anthropic.com/account/keys
2. Create a new API key
3. Paste it into **Settings → Anthropic**

---

### Jira Personal Access Token

1. Log into your Jira instance (e.g. `https://yourorg.atlassian.net`)
2. Go to **Account Settings** → **Security** → **API tokens**
   - Direct link: https://id.atlassian.com/manage-profile/security/api-tokens
3. Click **Create API token**, give it a name, copy the token
4. In FocusBoard Settings:
   - **Jira Base URL**: `https://yourorg.atlassian.net`
   - **Email**: your Atlassian account email
   - **Personal Access Token**: the token you just copied

---

### Google OAuth2 Credentials (Gmail + Google Calendar)

1. Go to https://console.cloud.google.com/
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library** and enable:
   - Gmail API
   - Google Calendar API
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `FocusBoard`
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**
7. Go to **OAuth consent screen** and add your email as a test user
8. In FocusBoard Settings:
   - Paste Client ID and Client Secret
   - Click **Save All** first
   - Then click **Connect Google Account** — a browser window will open
   - Authorize the app; the window will close automatically

---

### Slack Bot Token

1. Go to https://api.slack.com/apps
2. Click **Create New App → From scratch**
3. Name it (e.g. `FocusBoard`) and select your workspace
4. Go to **OAuth & Permissions**
5. Under **Bot Token Scopes**, add:
   - `channels:history`
   - `im:history`
   - `im:read`
   - `search:read`
   - `users:read`
6. Click **Install to Workspace** and authorize
7. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
8. Paste it into **Settings → Slack → Bot Token**

---

## Project Structure

```
focusboard/
  backend/
    server.js          — Express app (port 3001)
    routes/
      jira.js          — Jira REST API v3
      gmail.js         — Gmail API + Claude action extraction
      calendar.js      — Google Calendar API
      slack.js         — Slack Web API + Claude action extraction
      claude.js        — Anthropic SDK helper
    config.json        — Local credentials (gitignored)
  frontend/
    src/
      App.tsx           — Root component, state management
      components/
        KanbanBoard.tsx  — DnD context + error banners
        KanbanColumn.tsx — Column with Droppable
        TaskCard.tsx     — Draggable task card
        Header.tsx       — Navigation + refresh
        SettingsPage.tsx — Integration configuration
        SourceBadge.tsx  — Colored source pill
      services/
        api.ts           — Fetch wrappers
      types.ts           — Shared TypeScript types
```

## Notes

- Drag cards between columns; positions are saved in `localStorage`
- If a source isn't configured, the board still works — you'll see a banner with a link to Settings
- The backend self-creates `config.json` on first run
- Never commit `config.json` — it contains your API tokens
=======
# FocusBoard
>>>>>>> f68e191e1bc77459187897ca838836dda939e226
