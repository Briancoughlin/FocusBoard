# Changelog

All notable changes to FocusBoard are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
