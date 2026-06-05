# Changelog

All notable changes to FocusBoard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Docker support — multi-container setup with nginx (frontend) + Node.js (backend)
- backend/Dockerfile, frontend/Dockerfile, docker-compose.yml, .env.example, .dockerignore
- INSTALL.md — unified installation guide covering all 4 options (Windows native, Docker, Windows .exe coming, Mac coming)
- FOCUSBOARD_KEY env var — stable encryption key for containers (overrides machine-bound key)
- FOCUSBOARD_DOCKER=true — tells backend it's behind nginx with unexposed port; skips localhost auth check
- nginx security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Release workflow now builds and pushes focusboard-frontend and focusboard-backend images to GHCR
- CI validates docker-compose.yml syntax and builds both images on every push

### Fixed
- Server exits with a clear error message if FOCUSBOARD_DOCKER=true but FOCUSBOARD_KEY not set (previously would silently use unstable container hostname as key)
- 76 backend tests (14 new docker-mode tests covering key derivation, auth bypass, startup validation)

---

## [1.3.1] - 2026-06-05

### Added
- **Email Intelligence** — Gmail items now show Claude confidence dots (●●● / ●●○ / ●○○), hover to see raw email snippet, "Not an action" 👎 button dismisses and teaches the noise filter, learned patterns injected into Claude prompt on next sync
- **Week navigation** — ‹ › arrows in the Focus week view to move between weeks; "This week" button to jump back; current week highlighted in blue
- **Friendly startup** — human-readable terminal banner with integration status (✓ connected / ○ not configured / ○ disabled), actionable warnings, no raw JSON on startup
- **Watchdog friendly output** — watchdog process uses same clean terminal style

### Fixed
- Settings page components (`Toggle`, `IntegrationSection`, `TestButton`) moved to module scope — eliminates remount-on-every-keypress bug that made Settings inaccessible

---

## [1.3.0] - 2026-06-05

### Added
- **Watchdog process** (`backend/watchdog.js`) — separate lightweight process on port 3002 that can restart FocusBoard on demand; registered as the `FocusBoardWatchdog` scheduled task
- **Offline recovery page** (`frontend/public/offline.html`) — shown by the service worker when the main server is unreachable; includes a one-click restart button that calls the watchdog
- **Nightly backups** (`backend/backup.js`, `backend/restore.js`) — all app data saved nightly as a gzipped JSON bundle to `backend/backups/`; registered as the `FocusBoardBackup` scheduled task; old bundles auto-pruned
- **Watcher heartbeat indicator** — notification watcher pings `/api/health/watcher/ping` every 10 seconds; sidebar shows 🟢 (alive) or 🔴 (stopped) so notification outages are immediately visible
- **API Cutover date** — Settings → Integrations tab with a date picker to limit how far back each API fetches
- **Completed history log** — tasks moved to Done are written to `backend/data/completed-history.json` for use in the weekly report
- **Privacy mode** — 👁 eye icon in the header blurs all on-screen content for demos and screen sharing; click again to reveal
- **`/api/report/done-tasks` endpoint** — reconstructs weekly done-task history from Jira API and the completed-history log
- **Feature toggles** — Settings → Integrations tab; each source has a toggle in its header; disabled sources are skipped entirely during sync
- **Settings sub-tabs** — Settings page split into Integrations (credentials + toggles) and App (appearance, maintenance)
- **Productivity leaderboard** — click the 🏆 trophy to see daily high scores, personal best ⭐, current streak 🔥, and all-time total
- **New high score fireworks** — confetti burst + "New High Score!" banner when you beat your personal best
- **Fix version filter** — dropdown in the header nav auto-selects the current quarter; Quick Add tasks are stamped with the selected fix version
- **Calendar item expand on hover** — week view task titles expand to full text on hover; collapse when you move away
- **Friendly VPN warning** — when Jira is unreachable due to a network error, a clear amber banner explains the likely cause and offers a one-click sync retry
- **Clear cache & reload button** — Settings → App → Maintenance; unregisters the service worker and clears all cached assets in one click
- **119 automated tests** — 34 back-end + 85 front-end across 15 suites; new suites for VPN detection, feature toggle filtering, fix version logic

### Fixed
- **Weekly report** — now uses `/api/report/done-tasks` so history survives server restarts and daily resets
- **Trophy midnight reset** — counter checks every minute and resets correctly when the date changes
- **Network crash** — server now binds to `127.0.0.1` only, preventing crashes when WiFi or VPN interfaces change
- **Settings page remounting** — `Toggle`, `IntegrationSection`, and `TestButton` moved to module scope so React no longer recreates them on every render

---

## [1.2.1] - 2026-06-04

### Added
- **Task cache** — board loads instantly on startup from cached data, no blank screen
- **Non-disruptive sync** — background syncs show "Syncing..." in header instead of blanking the board
- **Bug report button** — 🐛 icon in header creates a GitHub issue with server logs, user action trail, and system state
- **User action trail** — last 50 actions recorded in memory, included in bug reports
- **Smoke tests** — 4 end-to-end tests verifying server health and API response shapes
- **Zero ESLint warnings** — all 19 warnings fixed, clean codebase

### Fixed
- Subtle grey overlay during background sync instead of blank screen

---

## [1.2.0] - 2026-06-04

### Added
- **Auto-update system** — checks GitHub Releases daily, shows banner when update available, one-click update that pulls, rebuilds and restarts
- **Automated GitHub Releases** — tagging `v*` automatically creates a release with changelog notes
- **Performance monitoring** — logs API calls over 2 seconds, warns user if sync takes over 10 seconds
- **Structured JSON logging** — all backend activity logged to `backend/logs/server-YYYY-MM-DD.log` with 7-day retention
- **Pre-commit hooks** (husky) — lint and all 43 tests run before every commit
- **ESLint** — code linting for frontend (TypeScript/React) and backend
- **43 targeted tests** — Jira status mapping, encryption, urgency scoring, task filtering, week view filter
- **Dependabot auto-merge** — patch and minor dependency updates auto-merge when CI passes
- **CHANGELOG.md** — full version history
- **CONTRIBUTING.md** — setup guide, how to add integrations, PR checklist, Unity-specific notes
- **React error boundary** — catches JS errors, shows recovery UI instead of white screen
- **Offline detection** — banner when offline, auto-syncs on reconnect
- **Google token auto-refresh** — OAuth tokens silently renew without re-authentication
- **Config health check** — server logs integration status on startup
- **Version number** — displayed in header (v1.2.0)

### Changed
- CI pipeline now runs ESLint, tests, TypeScript check, build and secret scanning

---

## [1.1.0] - 2026-06-04

### Added
- **GitHub integration** — PRs awaiting review, your open PRs, assigned issues, CI pass/fail notifications with commit message and duration
- **Jira write-back** — moving a card between columns automatically updates the ticket status in Jira
- **Jira ticket creation** — moving a non-Jira card to In Progress prompts to create a Jira ticket (project, type, priority, fix version, initial status)
- **Jira closing comments** — prompted to add a closing comment when marking a Jira ticket as done
- **Won't Do status** — cards in the Done column can be toggled to Won't Do (strikethrough, persists indefinitely, excluded from schedule)
- **Calendar day filtering** — click a calendar day to filter the kanban to that day's tasks
- **Drag to schedule** — drag kanban cards onto calendar days to set their due date
- **Pin to Focus** — 📌 button on cards forces them into the Focus view regardless of due date
- **Epic filter** — dropdown in Focus view to scope kanban to a specific Jira epic
- **Fix version** on Jira cards — extracted from Jira and shown on each card
- **AI standup report** — 📊 button generates an executive-ready progress summary for today or this week
- **Windows notification capture** — Slack mentions and DMs captured via Windows toast notifications within 10 seconds
- **Slack channel ID mapper** — Settings UI to map channel names to IDs for direct deep links
- **Slack channel prompt** — automatically prompts to add channel ID when an unmapped channel arrives
- **Sidebar sections** — three collapsible sections: GitHub, Slack, Gmail
- **Unsaved changes warning** — Settings page warns before navigating away with unsaved changes
- **Done button on calendar** — hover over a scheduled task in the calendar to mark it done without dragging
- **Structured JSON logging** — all backend activity logged to `backend/logs/server-YYYY-MM-DD.log`
- **React error boundary** — catches JS errors and shows a recovery UI instead of a white screen
- **Offline detection** — yellow banner when offline, auto-syncs when reconnected
- **Google token auto-refresh** — OAuth tokens silently renew without requiring re-authentication
- **Config health check** — server logs integration status summary on startup
- **ESLint** — code linting for both frontend and backend
- **43 targeted tests** — covering Jira status mapping, encryption, urgency scoring, task filtering, week view filter
- **Auto-merge Dependabot PRs** — patch and minor dependency updates auto-merge when CI passes
- **Version number** — displayed in the header (v1.1.0)

### Changed
- **Backlog** tab renamed from "Board"
- **Focus view** is now the default view on load
- **Slack notifications** filtered to mapped channels only — reduces noise
- **Calendar strip** excludes done and Won't Do tasks
- **Done column** resets daily; Won't Do tasks persist indefinitely
- **Report prompt** rewritten for executive-ready, outcome-focused tone
- **CI pipeline** now runs tests, lint, TypeScript check, build, and secret scanning

### Fixed
- Drag offset misalignment in WeekView (replaced with hover done button)
- Port conflict crash on restart — server retries after 3 seconds
- Unhandled promise rejections no longer silently kill the process
- Settings page scroll in PWA mode
- Quick Add always creates at least one card (even from a single line)
- Config not decrypted in all route files (routes now all use encrypted config)
- Duplicate `handlePastedTasks` declaration

---

## [1.0.0] - 2026-06-02

### Added
- **Focus view** — split pane with week calendar (top) and kanban (bottom), resizable divider
- **Backlog view** — full kanban with source filter tabs
- **Jira integration** — fetches all assigned tickets with Unity-specific status mapping, epic names, paginated (271+ tickets)
- **Gmail integration** — fetches today's emails, Claude extracts action items
- **Google Calendar** — week strip view, filters working-location and solo-location events
- **Quick Add** — paste Zoom summaries, meeting notes, or any text to create cards
- **Daily digest** — morning summary of overdue, due today, meetings, high priority
- **Urgency sorting** — overdue → today → soon → normal, with colour-coded strip
- **Dismiss cards** — × button hides cards without marking done
- **Completed today counter** — trophy icon tracks daily completions
- **Dark/light mode** — follows Windows accent colour and theme automatically
- **Manual theme override** — colour picker and toggle in Settings
- **PWA support** — installs as desktop app, manifest and service worker
- **Auto-starts at Windows login** — scheduled task registered by setup.ps1
- **Encrypted config** — AES-256-GCM encryption tied to the machine
- **Session auth** — localhost session cookie protects the API
- **GitHub Actions CI** — runs on every push, checks build, secrets, dependencies
- **Dependabot** — weekly dependency vulnerability scanning
- **Windows notification watcher** — `FocusBoardNotifications` scheduled task
- **One-command setup** — `setup.ps1` installs Node, builds, registers tasks
- **README** — full setup guide including Unity-specific Jira instructions
- **Code comments** — JSDoc on key files (server, routes, App, FocusView, WeekView)
