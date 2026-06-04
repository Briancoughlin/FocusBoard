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
  backend/          Node.js/Express API (port 3001)
    routes/         One file per integration (jira, gmail, github, etc.)
    tests/          Backend unit tests (Node built-in test runner)
    logger.js       Structured JSON logging
    crypto-utils.js AES-256-GCM config encryption
  frontend/         React + Vite + TypeScript
    src/
      components/   UI components
      services/     API clients (api.ts, persistence.ts, theme.ts)
      tests/        Frontend unit tests (Vitest)
      types.ts      Shared TypeScript types
```

---

## Running tests

```powershell
# Backend (19 tests)
cd backend
node --test tests/*.test.js

# Frontend (24 tests)
cd frontend
npm test
```

All 43 tests must pass before submitting a PR. CI will run them automatically.

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
