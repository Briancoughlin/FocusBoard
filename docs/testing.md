# FocusBoard — Test Suite Reference

All tests run automatically on every commit via pre-commit hooks (husky) and GitHub Actions CI.

---

## Running tests locally

```powershell
# Backend unit tests (109 tests)
cd backend
node --test tests/*.test.js

# Backend smoke tests only (server must be running)
npm run test:smoke

# Frontend unit tests (99 tests)
cd frontend
npm test

# Frontend with coverage report
npm run test:coverage

# All tests (both suites)
cd backend && node --test tests/*.test.js
cd ../frontend && npm test
```

---

## Backend unit tests — `backend/tests/`

Run with `node --test tests/*.test.js` (Node built-in test runner, no dependencies).

### `jira-status.test.js` — 9 tests
Jira status string → FocusBoard status mapping (`mapJiraStatus`).

| Test | Covers |
|---|---|
| "To Do" → `todo` | Standard todo status |
| "In Progress" → `inprogress` | Standard active status |
| "In Review" → `inprogress` | Code review treated as in progress |
| "Waiting" → `waiting` | Blocked/waiting bucket |
| "Done" → `done` | Resolved status |
| "Won't Do" → `wontdo` | Explicitly declined |
| Unknown status → `todo` | Safe fallback |
| statusCategory "indeterminate" → `waiting` | Category-level fallback |
| statusCategory "done" → `done` | Category-level fallback |

---

### `crypto.test.js` — 5 tests
AES-256-GCM config encryption/decryption (`encryptConfig` / `decryptConfig`).

| Test | Covers |
|---|---|
| Round-trip preserves all fields | Encrypt → decrypt → same object |
| Different machines produce different ciphertext | Machine-binding via hostname+username |
| Decrypting garbage throws | Tampered ciphertext rejected |
| Empty config round-trips | Edge case — no fields |
| Large config round-trips | Performance / buffer handling |

---

### `config-merge.test.js` — 7 tests
Config field merging logic in `POST /api/config`.

| Test | Covers |
|---|---|
| Known string fields are saved | jiraUrl, slackToken, etc. |
| `***` placeholder is not overwritten | Frontend masks secrets it can't read |
| Empty string is not overwritten | Blank field = no change |
| Field over 2000 chars is rejected | Input length validation |
| Unknown fields are ignored | Allowlist enforcement |
| Features object survives merge | `{ jira: false, gmail: true }` preserved |
| Non-boolean feature values are dropped | Type validation on feature flags |

---

### `cache.test.js` — 5 tests
Task cache read/write (`backend/data/task-cache.json`).

| Test | Covers |
|---|---|
| Write then read returns same tasks | Round-trip integrity |
| Missing cache file returns empty array | Graceful cold start |
| Malformed JSON returns empty array | Corrupt cache doesn't crash |
| `cachedAt` timestamp is written | Cache staleness tracking |
| Task fields are preserved | No data loss through cache |

---

### `backup.test.js` — 14 tests
Nightly backup bundle creation, restore, and pruning (`backup.js` / `restore.js`).

| Test | Covers |
|---|---|
| Bundle contains config and data files | All files included |
| Files are base64 encoded | Binary-safe serialisation |
| Gzip compress + decompress round-trip | Compression integrity |
| Unicode filenames preserved | Non-ASCII path handling |
| Restore writes files back to original paths | Restore correctness |
| Pruning keeps exactly 7 backups | Old bundles removed |
| Pruning with fewer than 7 keeps all | No over-deletion |
| `daysSince` calculates correctly | Date arithmetic |
| `daysSince` on today returns 0 | Edge case |
| Cutoff date filter excludes old backups | API cutover date respected |
| Cutoff date filter includes new backups | Recent files pass through |
| Empty data directory produces valid bundle | Edge case |
| Corrupted gzip throws on restore | Error handling |
| Bundle is valid JSON after decompression | Format integrity |

---

### `jira-vpn.test.js` — 9 tests
VPN/connectivity error detection in `backend/routes/jira.js`.

| Test | Covers |
|---|---|
| ECONNREFUSED in message → `vpnLikely: true` | Server port closed |
| ENOTFOUND in message → `vpnLikely: true` | DNS resolution failed |
| ETIMEDOUT in cause → `vpnLikely: true` | Connection timed out |
| ECONNRESET → `vpnLikely: true` | Connection dropped |
| EHOSTUNREACH → `vpnLikely: true` | Host unreachable |
| "fetch failed" (no auth code) → `vpnLikely: true` | Generic network failure |
| "fetch failed" with "401" → `vpnLikely: false` | Auth error, not VPN |
| "Jira API error 500" → `vpnLikely: false` | Server error, not VPN |
| When `vpnLikely`, error message is friendly | "Jira unreachable — are you on VPN or Netbird?" |

---

### `feature-toggles.test.js` — 6 tests
Source filtering in `/api/sync` based on `features` config object.

| Test | Covers |
|---|---|
| All features enabled → all 5 sources included | Default behaviour |
| `features.jira = false` → jira excluded | Single toggle |
| `features.gmail = false` + `features.github = false` → both excluded | Multiple toggles |
| `features = {}` → all 5 sources included | Empty config defaults to all on |
| `features.slack = false` → slack excluded | Slack toggle |
| Feature key not present → source included | Absent key = not disabled |

---

### `docker-mode.test.js` — 14 tests
Docker-specific key derivation, auth bypass, and startup validation.

**Key derivation (5 tests)**

| Test | Covers |
|---|---|
| FOCUSBOARD_KEY used when set | Container key takes priority |
| Same key always produces same output | Deterministic derivation |
| Different keys produce different output | Key isolation |
| Falls back to machine binding when not set | Native mode unchanged |
| Machine key differs from Docker key | No accidental cross-mode collision |

**Auth bypass (4 tests)**

| Test | Covers |
|---|---|
| Bypasses localhost check when FOCUSBOARD_DOCKER=true | nginx is the gatekeeper |
| Does not bypass when env var is unset | Default is secure |
| Does not bypass when env var is "false" | Explicit opt-in only |
| Case-sensitive — only "true" works, not "True" or "1" | Strict string match |

**Startup validation (5 tests)**

| Test | Covers |
|---|---|
| Valid when both FOCUSBOARD_DOCKER and FOCUSBOARD_KEY are set | Happy path |
| Invalid when FOCUSBOARD_DOCKER=true but FOCUSBOARD_KEY missing | Exits with clear error |
| Invalid when FOCUSBOARD_KEY is empty string | Empty string treated as missing |
| Valid in native mode without key | Machine binding used |
| Valid in native mode with optional key | Key present, machine mode |

---

## Backend smoke tests — `backend/tests/smoke.test.js`

Run with `npm run test:smoke`. Requires the server to be running on port 3001 (and optionally the watchdog on port 3002). Tests skip gracefully if the server is not running.

| Test | Endpoint | Checks |
|---|---|---|
| Root route | `GET /` | Returns 200 |
| Sync shape | `GET /api/sync` | `{ tasks: Array, errors: Array }` |
| Config shape | `GET /api/config` | `jiraConfigured`, `googleConfigured`, `githubConfigured` are booleans |
| Config features | `GET /api/config` | `features` object present; known keys are booleans |
| Update check | `GET /api/update/check` | `hasUpdate` boolean, `currentVersion` string |
| Watcher health | `GET /api/health/watcher` | `alive` boolean |
| Watchdog health | `GET http://localhost:3002/health` | `alive: true`, `watchdog: true` (skips if watchdog not running) |
| Done-tasks report | `GET /api/report/done-tasks` | `{ tasks: Array, doneDates: Object }` |
| Task cache | `GET /api/cache` | `{ tasks: Array }` |
| Docker mode — API accessible without cookies | `GET /api/sync` with FOCUSBOARD_DOCKER=true | Auth bypass active in Docker mode |
| Docker mode — FOCUSBOARD_KEY presence verified | Startup check | Server does not start if key is missing in Docker mode |

---

## Frontend unit tests — `frontend/src/tests/`

Run with `npm test` (Vitest).

### `accessibility.test.ts` — 12 tests
Colourblind urgency indicators and sort order.

| Test | Covers |
|---|---|
| Overdue task → `▲▲▲` pattern | Red urgency indicator |
| Due today → `◆◆◆` pattern | Orange urgency indicator |
| Due soon → `···` pattern | Yellow urgency indicator |
| Normal task → no pattern | No false positives |
| Overdue sorts before today | Priority ordering |
| Today sorts before soon | Priority ordering |
| Soon sorts before normal | Priority ordering |
| High priority boosts urgency score | Priority weighting |
| Source badge labels are non-empty strings | No missing labels |
| All source types have valid badge values | Exhaustive source coverage |
| `aria-label` format for urgency | Screen reader announcement |
| Score ties broken by due date | Stable sort |

---

### `actionLog.test.ts` — 6 tests
Circular buffer for user action trail (used in bug reports).

| Test | Covers |
|---|---|
| Logs are appended | Basic write |
| Buffer caps at 50 entries | Memory bound |
| Oldest entries evicted when full | FIFO eviction |
| Timestamp uses 24-hour format | CI locale independence (`HH:MM:SS` not `hh:MM:SS AM/PM`) |
| `getLog()` returns copy, not reference | Immutability |
| Empty log returns empty array | Cold start |

---

### `filters.test.ts` — 5 tests
Task filtering pipeline (`applyOverrides`, `applyDueDateOverrides`, done-date filtering).

| Test | Covers |
|---|---|
| Status override replaces API status | User drag wins over sync |
| Due-date override replaces API due date | Calendar drag wins over sync |
| Task done yesterday is hidden | Daily reset logic |
| Task done today stays visible | Today's completions visible |
| `wontdo` tasks never filtered by date | Won't Do persists indefinitely |

---

### `urgency.test.ts` — 7 tests
Urgency level calculation for task card colour strips.

| Test | Covers |
|---|---|
| Past due date → `overdue` | Red strip |
| Due today → `today` | Orange strip |
| Due within 3 days → `soon` | Yellow strip |
| Due in 2 weeks → `normal` | No strip |
| No due date → `normal` | Missing date handled |
| High priority adds score weight | Urgency scoring |
| Low priority reduces score weight | Urgency scoring |

---

### `week-filter.test.ts` — 7 tests
Which tasks appear in the Focus week view (`baseWeekFilter`).

| Test | Covers |
|---|---|
| Task due this week → included | Core week filter |
| Task due next week → excluded | Out-of-window filter |
| Pinned task with no due date → included | Pin override |
| Paste task with no due date → included | Quick Add always visible |
| Done task → excluded | Completed tasks hidden |
| Wontdo task → excluded | Won't Do tasks hidden |
| Task due today → included | Edge: today is this week |

---

### `vpn-banner.test.ts` — 8 tests
VPN error detection logic from `KanbanBoard.tsx` (`findVpnError`).

| Test | Covers |
|---|---|
| `vpnLikely: true` on jira error → detected | Backend flag respected |
| Error contains "unreachable" → detected | Friendly message match |
| Error contains "vpn" (case-insensitive) → detected | Keyword match |
| Error contains "ECONNREFUSED" → detected | Raw error code match |
| Non-jira source with `vpnLikely` → not detected | Only Jira shows VPN warning |
| Normal Jira 500 error → not detected | Server errors are not VPN |
| "Jira not configured" → not detected | Config errors are not VPN |
| Multiple errors, only jira one matches → returns jira error | Correct error returned |

---

### `fix-version.test.ts` — 8 tests
Fix version quarter detection and task filtering from `App.tsx`.

| Test | Covers |
|---|---|
| "26.2" matches Q2 2026 | Short year + quarter pattern |
| "Q2 2026" matches Q2 2026 | Long quarter pattern |
| "R26.2" matches Q2 2026 | Release tag pattern |
| "26.3" does not match Q2 2026 | Wrong quarter excluded |
| Non-Jira tasks always pass filter | Gmail/Slack/GitHub unaffected |
| Jira task with matching fixVersion → included | Filter passes matching task |
| Jira task with wrong fixVersion → excluded | Filter removes non-matching task |
| Duplicate fix versions produce unique sorted list | `allFixVersions` deduplication |

---

### `regression.test.ts` — 18 tests
Guards against bugs that were previously fixed in the frontend. Each describe block is named after the original bug.

**actionLog 24-hour timestamp (5 tests)**

| Test | Covers |
|---|---|
| Timestamp is always `HH:MM:SS` format | GitHub Actions CI runners use 12-hour locale — must not affect output |
| Midnight formats as `00:XX:XX` not `12:XX:XX AM` | Edge case: midnight |
| Noon formats as `12:XX:XX` not `12:XX:XX PM` | Edge case: noon |
| 1pm formats as `13:XX:XX` not `1:XX:XX PM` | 24-hour conversion |
| Single-digit hours are zero-padded | `09:05:03` not `9:5:3` |

**Trophy midnight reset (4 tests)**

| Test | Covers |
|---|---|
| Counter resets when date changes | Interval check must detect day rollover |
| Counter does not reset within the same day | No false resets during the day |
| Counter resets across month boundary | May 31 → June 1 |
| Counter resets across year boundary | Dec 31 → Jan 1 |

**Done task daily filter (5 tests)**

| Test | Covers |
|---|---|
| Task done today remains visible | Today's completions stay on board |
| Task done yesterday is hidden | Previous day tasks must not persist |
| Wontdo tasks are never filtered | Won't Do persists indefinitely |
| Active tasks are never filtered | todo/inprogress always visible |
| Mix of today and yesterday filters correctly | Combined scenario |

**VPN error friendly banner (4 tests)**

| Test | Covers |
|---|---|
| `vpnLikely` flag triggers friendly banner | Backend flag respected by frontend |
| Raw ECONNREFUSED string triggers banner | Error string detection |
| Non-Jira source does not trigger Jira VPN banner | Source-specific detection |
| Friendly message does not contain raw error codes | No ECONNREFUSED in UI text |

---

### `regression.test.js` — 17 tests
Guards against bugs that were previously fixed in the backend. If any of these fail a regression has occurred.

**Config merge — *** placeholder handling (3 tests)**

| Test | Covers |
|---|---|
| Existing secret preserved when frontend sends `***` | Frontend masks secrets it can't read — must not overwrite |
| Existing secret preserved when frontend sends empty string | Blank field = no change |
| New value correctly replaces existing when a real value is sent | Legitimate update path |

**Jira VPN error — friendly message (4 tests)**

| Test | Covers |
|---|---|
| ECONNREFUSED shows friendly VPN message | Raw error code must not reach the UI |
| ENOTFOUND shows friendly VPN message | DNS failure = VPN not connected |
| 401 Unauthorized is NOT classified as VPN error | Auth errors are a different problem |
| Generic "fetch failed" classified as VPN error | Node's wrapper for all network failures |

**Server crash handling — EADDRINUSE / ECONNRESET (4 tests)**

| Test | Covers |
|---|---|
| EADDRINUSE triggers retry, not crash | Port in use on restart — must retry |
| ECONNRESET is handled gracefully | Network change must not kill the server |
| ECONNABORTED is handled gracefully | Aborted connection must not kill the server |
| Unknown errors are logged but do not crash | No unhandled fatal for unknown codes |

**Feature toggle filter — undefined safety (4 tests)**

| Test | Covers |
|---|---|
| Empty features object does not crash | Missing key defaults to enabled |
| `features.jira = false` excludes only jira | Single toggle precision |
| `features.jira = null` does NOT disable jira | Only explicit `false` disables |
| `features.jira = 0` does NOT disable jira | Type strictness |

**Network error classification (2 tests)**

| Test | Covers |
|---|---|
| ECONNRESET is non-fatal | VPN/WiFi change must not propagate as crash |
| ETIMEDOUT on server socket is handled | Timeout must not kill the server |

---

### `gmail-feedback.test.js` — 10 tests
Gmail feedback POST logic — input validation, sender extraction, noise pattern building, and sanitization.

| Test | Covers |
|---|---|
| Missing taskId rejected | Required field validation |
| taskId over 200 chars rejected | Length validation |
| Valid request accepted | Happy path |
| `Name <email@domain.com>` → `email@domain.com` | Sender email extraction |
| Plain email with no angle brackets passes through | Email without display name |
| Sender with 2+ feedback entries included in patterns | Minimum threshold for learning |
| Sender with only 1 feedback entry excluded | Prevents premature learning |
| falsePositiveRate clamped to max 0.95 | Rate ceiling |
| `from` over 500 chars gets truncated | Input sanitization |
| `confidence` outside 0–1 gets clamped | Boundary enforcement |

---

### `watchdog.test.js` — 6 tests
Watchdog HTTP server response shapes and safety checks.

| Test | Covers |
|---|---|
| GET /health returns `{ alive: true, watchdog: true }` | Health check shape |
| POST /restart returns success shape | Restart response shape |
| Unknown route returns 404 | Route handling |
| PowerShell command contains Stop-ScheduledTask | Command safety guard |
| PowerShell command contains Start-ScheduledTask | Command safety guard |
| Watchdog port is 3002, not 3001 | No conflict with main server |

---

## Frontend unit tests — `frontend/src/tests/` (continued)

### `week-navigation.test.ts` — 8 tests
Week offset navigation logic from `WeekView.tsx`.

| Test | Covers |
|---|---|
| `getWeekDays(0)` starts on Monday of current week | Current week baseline |
| `getWeekDays(1)` returns next week | Forward navigation |
| `getWeekDays(-1)` returns last week | Backward navigation |
| First day is always Monday | Week start invariant |
| Last day is always Sunday | Week end invariant |
| All 7 days are consecutive | No gaps in week |
| Works across month boundaries | Month-end edge case |
| Works across year boundaries | Year-end edge case |

---

### `leaderboard.test.ts` — 8 tests
Leaderboard scoring logic from `LeaderboardModal.tsx`.

| Test | Covers |
|---|---|
| Rank 1 → 🥇 | Gold medal |
| Rank 2 → 🥈 | Silver medal |
| Rank 3 → 🥉 | Bronze medal |
| Rank 4+ → no medal | Top 3 only |
| 3 consecutive days → streak of 3 | Streak calculation |
| Gap in days → streak resets | Streak breaks on gap |
| No scores → streak of 0 | Empty state |
| Days ranked by score descending | Sort order |

---

### `confidence-dots.test.ts` — 5 tests
Confidence dot level thresholds from `InboxSidebar.tsx`.

| Test | Covers |
|---|---|
| confidence ≥ 0.8 → level 3 (high) | High confidence threshold |
| 0.55 ≤ confidence < 0.8 → level 2 (medium) | Medium confidence threshold |
| confidence < 0.55 → level 1 (low) | Low confidence threshold |
| confidence exactly 0.8 → level 3 | Boundary: high/medium |
| confidence exactly 0.55 → level 2 | Boundary: medium/low |

---

## CI pipeline — GitHub Actions

Every push and pull request to `main` runs `.github/workflows/ci.yml` on Node.js 24 (Ubuntu).

| Step | Command | On failure |
|---|---|---|
| Backend lint | `npm run lint` | Warn (non-blocking) |
| Backend unit tests | `npm test` | **Blocks merge** |
| Secret check (config.json) | bash grep | **Blocks merge** |
| Smoke tests | `npm run test:smoke` | Warn (server may not be available in CI) |
| Backend dependency audit | `npm audit --audit-level=high` | Warn |
| Frontend dependency audit | `npm audit --audit-level=high` | Warn |
| Frontend lint | `npm run lint` | Warn |
| Frontend unit tests | `npm test` | **Blocks merge** |
| Frontend coverage | `npm run test:coverage` | Warn |
| Accessibility audit (axe-core) | `npx @axe-core/cli` | Warn |
| TypeScript type check | `npx tsc --noEmit` | **Blocks merge** |
| Frontend build | `npm run build` | **Blocks merge** |
| Hardcoded secret scan | regex grep on `*.ts`, `*.tsx`, `*.js` | **Blocks merge** |
| Validate docker-compose.yml | `docker compose config` | Warn (non-blocking) |
| Build backend Docker image | `docker build ./backend` | Warn (non-blocking) |
| Build frontend Docker image | `docker build ./frontend` | Warn (non-blocking) |
| Smoke tests in Docker mode | `FOCUSBOARD_DOCKER=true npm run test:smoke` | Warn (non-blocking) |

Steps marked **Blocks merge** will fail the CI check and prevent the PR from being merged. Steps marked Warn use `continue-on-error: true` — they log a warning but don't fail the build.

---

## Test count summary

| Suite | File | Tests |
|---|---|---|
| Backend unit | jira-status.test.js | 9 |
| Backend unit | crypto.test.js | 5 |
| Backend unit | config-merge.test.js | 7 |
| Backend unit | cache.test.js | 5 |
| Backend unit | backup.test.js | 14 |
| Backend unit | jira-vpn.test.js | 9 |
| Backend unit | feature-toggles.test.js | 6 |
| Backend unit | docker-mode.test.js | 14 |
| Backend unit | regression.test.js | 17 |
| Backend unit | gmail-feedback.test.js | 10 |
| Backend unit | watchdog.test.js | 6 |
| Backend smoke | smoke.test.js | 11 |
| Frontend unit | accessibility.test.ts | 12 |
| Frontend unit | actionLog.test.ts | 6 |
| Frontend unit | filters.test.ts | 5 |
| Frontend unit | urgency.test.ts | 7 |
| Frontend unit | week-filter.test.ts | 7 |
| Frontend unit | vpn-banner.test.ts | 8 |
| Frontend unit | fix-version.test.ts | 8 |
| Frontend unit | regression.test.ts | 18 |
| Frontend unit | week-navigation.test.ts | 8 |
| Frontend unit | leaderboard.test.ts | 8 |
| Frontend unit | confidence-dots.test.ts | 5 |
| **Total** | | **208** |
