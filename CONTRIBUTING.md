# Contributing to FocusBoard

Thanks for your interest in contributing! FocusBoard is an ADHD-friendly productivity hub built for Unity employees but designed to be adaptable for any team.

---

## Getting started

### Prerequisites
- Windows 10 or 11
- Node.js 20+ (`winget install OpenJS.NodeJS.LTS`)
- Git

### Setup for development

```powershell
git clone https://github.com/Briancoughlin/FocusBoard.git
cd FocusBoard

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Start both servers (two terminals)
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173 for the dev server (with hot reload).

---

## Project structure

```
focusboard/
  setup.ps1                 One-command installer for Windows native installs
  build.ps1                 Rebuilds frontend after code changes
  Dockerfile                Single-container fallback (frontend + backend together)
  docker-compose.yml        Two-service setup: nginx (frontend) + Node.js (backend)
  .env.example              Template for FOCUSBOARD_KEY and other Docker env vars
  .dockerignore             Build context exclusions
  INSTALL.md                All 4 installation options (Windows native, Docker, exe coming, Mac coming)
  backend/                  Node.js/Express API (port 3001)
    Dockerfile              Node.js-only container image
    routes/                 One file per integration (jira, gmail, github, etc.)
    tests/                  Backend unit tests (Node built-in test runner)
    backups/                Nightly gzipped data bundles (gitignored)
    logger.js               Structured JSON logging
    crypto-utils.js         AES-256-GCM config encryption
    watchdog.js             Watchdog HTTP server (port 3002) — restarts FocusBoard on demand
    backup.js               Creates a nightly gzipped backup of backend/data/
    restore.js              Restores a backup bundle produced by backup.js
  frontend/                 React + Vite + TypeScript
    Dockerfile              nginx + built React image
    nginx.conf              SPA routing, /api/ + /auth/ proxy to backend, security headers
    src/
      components/           UI components
      services/             API clients (api.ts, persistence.ts, theme.ts)
      tests/                Frontend unit tests (Vitest)
      types.ts              Shared TypeScript types
    public/
      offline.html          Shown by the service worker when the server is unreachable
```

FocusBoard registers four Windows Scheduled Tasks:

| Task name | What it runs | When |
|---|---|---|
| `FocusBoard` | `backend/server.js` (port 3001) | At Windows login |
| `FocusBoardNotifications` | `backend/notification-watcher.js` | At Windows login |
| `FocusBoardBackup` | `backend/backup.js` | Nightly |
| `FocusBoardWatchdog` | `backend/watchdog.js` (port 3002) | At Windows login |

---

## Running tests

```powershell
# Backend (76 tests)
cd backend
node --test tests/*.test.js

# Frontend (59 tests)
cd frontend
npm test
```

All 135 tests must pass before submitting a PR. CI will run them automatically.

Docker is a supported install method — see [INSTALL.md](INSTALL.md) for the `docker-compose up` quick start. If you add behaviour gated on `FOCUSBOARD_DOCKER` or `FOCUSBOARD_KEY`, add tests to `backend/tests/docker-mode.test.js`.

---

## Adding a new integration

1. Create `backend/routes/your-source.js`
   - Export a default Express router
   - Return `{ tasks: Task[] }` or `{ tasks: [], error: 'message' }`
   - Use `loadConfig()` + `decryptConfig` for credentials
   - Add logging with `logger.info/warn/error`

2. Wire it into `backend/server.js`
   - Import and mount: `app.use('/api/your-source', yourRouter)`
   - Add to the sync sources array in `/api/sync`

3. Add the source type to `frontend/src/types.ts`
   ```typescript
   export type Source = '...' | 'your-source';
   ```

4. Add a badge colour to `frontend/src/components/SourceBadge.tsx`

5. Add a filter tab to `frontend/src/components/KanbanBoard.tsx`

6. Add settings fields to `frontend/src/components/SettingsPage.tsx`

7. Update the README integration setup section

---

## Code style

- **TypeScript** throughout the frontend — no `any` if avoidable
- **ES modules** throughout (`import/export`, not `require`)
- **JSDoc comments** on exported functions and complex logic
- **No secrets in code** — all credentials via config.json (gitignored + encrypted)
- ESLint runs on CI — `npm run lint` to check locally

---

## Making a PR

1. Fork the repo and create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `node --test tests/*.test.js` (backend) and `npm test` (frontend)
4. Run lint: `npm run lint` in both `backend/` and `frontend/`
5. Push and open a PR against `main`
6. CI will run automatically — all checks must pass

### PR checklist
- [ ] Tests pass
- [ ] Lint passes (warnings OK, errors not)
- [ ] New integrations have settings UI + README section
- [ ] No credentials or personal data in the code
- [ ] CHANGELOG.md updated under `[Unreleased]`

---

## Reporting bugs

Open a GitHub issue with:
- What you were doing
- What happened vs what you expected
- Paste the last 50 lines from `backend/logs/server-YYYY-MM-DD.log`

```powershell
Get-Content "backend\logs\server-$(Get-Date -Format 'yyyy-MM-dd').log" | Select-Object -Last 50
```

---

## Unity-specific notes

If you work at Unity and are adapting this for internal use:

- **Jira**: use the `de.resolution.apitokenauth` plugin token, not Atlassian Cloud tokens. Requires VPN/Netbird.
- **Slack**: IT approval needed for a bot token. Windows notification capture works without it.
- **Gmail/Calendar**: use your Unity Google account via the OAuth flow. Set up a Cloud project with your personal Google account.
- **U-AI Gateway**: use `https://uai-litellm.internal.unity.com` as the Anthropic base URL with your U-AI token.

---

## Questions?

Open a GitHub issue or ping @briancoughlin on Unity Slack.
