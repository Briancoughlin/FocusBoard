# FocusBoard — Error Code Reference

Every significant error in the FocusBoard backend logs includes a `code` field so you can identify the problem without parsing message strings.

---

## Reading the logs

Log files are at `backend/logs/server-YYYY-MM-DD.log`. Each line is a JSON object:

```json
{"ts":"2026-06-05T21:00:00.000Z","level":"error","code":"JIRA_VPN_REQUIRED","msg":"Jira error","data":{"vpnLikely":true}}
```

**Quick search for errors:**
```powershell
# All errors today
Get-Content "backend\logs\server-$(Get-Date -Format 'yyyy-MM-dd').log" | Where-Object { $_ -match '"level":"error"' }

# Find a specific code
Get-Content "backend\logs\server-$(Get-Date -Format 'yyyy-MM-dd').log" | Where-Object { $_ -match 'JIRA_VPN_REQUIRED' }

# Last 50 lines of today's log
Get-Content "backend\logs\server-$(Get-Date -Format 'yyyy-MM-dd').log" | Select-Object -Last 50
```

**Docker:**
```bash
docker compose logs backend | grep '"level":"error"'
docker compose logs backend | grep 'JIRA_VPN_REQUIRED'
```

---

## Application error codes

Defined in `backend/error-codes.js`.

### Jira

| Code | Meaning | Fix |
|---|---|---|
| `JIRA_CONFIG_MISSING` | jiraUrl or jiraToken not set | Settings → Integrations → Jira |
| `JIRA_AUTH_FAILED` | 401 / 403 from Jira API — token invalid or expired | Regenerate your PAT in Jira → Account Settings → Security → API tokens |
| `JIRA_VPN_REQUIRED` | Network error — server unreachable | Connect to VPN or Netbird before syncing |
| `JIRA_SERVER_ERROR` | 5xx from Jira API — Jira is down or misconfigured | Check Jira status; may be a temporary outage |
| `JIRA_EPIC_FETCH_FAILED` | Epic name lookup failed — non-fatal | Tickets will show epic keys instead of names; sync will continue |
| `JIRA_CREATE_FAILED` | Failed to create a Jira ticket from FocusBoard | Check Jira permissions; your token may lack create-issue scope |

### Google (Gmail + Calendar)

| Code | Meaning | Fix |
|---|---|---|
| `GOOGLE_CONFIG_MISSING` | OAuth client ID or secret not set | Settings → Integrations → Gmail & Calendar |
| `GOOGLE_AUTH_EXPIRED` | Access token expired and refresh failed | Settings → Integrations → Gmail & Calendar → Connect Google Account |
| `GOOGLE_AUTH_FAILED` | OAuth error (not a simple expiry) | Re-run the Google OAuth flow — may need to revoke and re-grant access |
| `GOOGLE_API_ERROR` | Generic Google API error | Check the `data.error` field in the log for the specific error message |
| `GMAIL_EXTRACT_FAILED` | Claude failed to extract action items from emails | Check `ANTHROPIC_KEY_MISSING` — Claude is required for Gmail |
| `GMAIL_FEEDBACK_FAILED` | Could not write "not an action" feedback to disk | Check disk space and permissions on `backend/data/` |

### GitHub

| Code | Meaning | Fix |
|---|---|---|
| `GITHUB_CONFIG_MISSING` | githubToken not set | Settings → Integrations → GitHub |
| `GITHUB_AUTH_FAILED` | 401 from GitHub API — token invalid or expired | Regenerate your PAT at github.com/settings/tokens |
| `GITHUB_API_ERROR` | Generic GitHub API error | Check the `data.error` field; may be rate limiting or permissions |

### Slack

| Code | Meaning | Fix |
|---|---|---|
| `SLACK_CONFIG_MISSING` | Bot token or workspace URL not set | Settings → Integrations → Slack |
| `SLACK_AUTH_FAILED` | 401 from Slack API | Regenerate your bot token at api.slack.com/apps |
| `SLACK_API_ERROR` | Generic Slack API error | Check the `data.error` field |

### Claude AI (Anthropic)

| Code | Meaning | Fix |
|---|---|---|
| `ANTHROPIC_KEY_MISSING` | anthropicKey not configured | Settings → Integrations → Claude AI. Required for Gmail action extraction and Quick Add AI |
| `ANTHROPIC_API_ERROR` | Claude API call failed | Check your API key is valid and has credit; check Anthropic status |
| `ANTHROPIC_PARSE_ERROR` | Claude returned a response that wasn't valid JSON | Usually a transient issue — retry the sync |

### Server / infrastructure

| Code | Meaning | Fix |
|---|---|---|
| `SERVER_PORT_IN_USE` | Port 3001 already in use on startup | Another FocusBoard instance is running; stop it with `Stop-ScheduledTask -TaskName FocusBoard` then restart |
| `SERVER_NETWORK_ERROR` | ECONNRESET / ETIMEDOUT on server socket | Usually a VPN or WiFi change — non-fatal, server continues |
| `SERVER_UNCAUGHT` | Uncaught exception in server code | Check `data.stack` in the log; this is a bug — please report it |
| `SERVER_UNHANDLED` | Unhandled promise rejection | Check `data.stack` in the log; this is a bug — please report it |

### Config

| Code | Meaning | Fix |
|---|---|---|
| `CONFIG_DECRYPT_FAILED` | AES-256-GCM decryption failed — wrong key | If on Windows, hostname or username may have changed. If in Docker, `FOCUSBOARD_KEY` may have changed — restore the original key |
| `CONFIG_WRITE_FAILED` | Couldn't write config.json | Check disk space and file permissions on `backend/` |
| `CONFIG_READ_FAILED` | Couldn't read config.json | File may be corrupt — delete it and re-enter credentials in Settings |

### Docker

| Code | Meaning | Fix |
|---|---|---|
| `DOCKER_KEY_MISSING` | `FOCUSBOARD_DOCKER=true` but `FOCUSBOARD_KEY` not set | Add `FOCUSBOARD_KEY` to your `.env` file. Generate one: `openssl rand -hex 32` |

### Backup

| Code | Meaning | Fix |
|---|---|---|
| `BACKUP_FAILED` | Nightly backup write failed | Check disk space; check permissions on `backend/backups/` |
| `RESTORE_FAILED` | Backup restore failed | The `.gz` file may be corrupt — try an earlier backup from `backend/backups/` |

### Watchdog

| Code | Meaning | Fix |
|---|---|---|
| `WATCHDOG_RESTART_FAILED` | PowerShell restart command failed | Run `Start-ScheduledTask -TaskName FocusBoard` manually in an admin PowerShell |

---

## Windows Scheduled Task exit codes

When a scheduled task fails, Windows records an exit code. View it in Task Scheduler → right-click task → History, or via PowerShell:

```powershell
Get-ScheduledTaskInfo -TaskName "FocusBoard" | Select-Object LastRunTime, LastTaskResult
```

Common codes:

| Exit code | Hex | Meaning |
|---|---|---|
| `0` | `0x0` | Success |
| `1` | `0x1` | General error (Node.js uncaught exception) |
| `2147942402` | `0x80070002` | File not found — Node.js or server.js path wrong |
| `2147942405` | `0x80070005` | Access denied — run setup.ps1 as Administrator |
| `2147942415` | `0x8007000F` | Invalid drive — the drive the task points to doesn't exist |
| `2147943568` | `0x80070650` | Port already in use (EADDRINUSE) — another instance running |
| `267009` | `0x41301` | Task is currently running |
| `267011` | `0x41303` | Task has not yet run |
| `267014` | `0x41306` | Task was terminated by user |

**FocusBoard-specific exit codes** (set by Node.js):

| Exit code | Meaning |
|---|---|
| `0` | Clean shutdown |
| `1` | Uncaught exception or fatal startup error |
| `1` | `DOCKER_KEY_MISSING` — process.exit(1) on Docker startup without key |

---

## Node.js exit codes

| Code | Meaning |
|---|---|
| `1` | Uncaught fatal exception |
| `5` | Fatal V8 error (out of memory) |
| `9` | Invalid argument to Node.js itself |
| `12` | Invalid debug argument |

FocusBoard catches uncaught exceptions and promise rejections so they are logged rather than causing an exit — see `SERVER_UNCAUGHT` and `SERVER_UNHANDLED` above.

---

## Finding errors after a crash

```powershell
# 1. Check when the task last ran and its result
Get-ScheduledTaskInfo -TaskName "FocusBoard" | Select-Object LastRunTime, LastTaskResult

# 2. Check today's log for errors
$log = "backend\logs\server-$(Get-Date -Format 'yyyy-MM-dd').log"
Get-Content $log | Where-Object { $_ -match '"level":"error"' } | Select-Object -Last 20

# 3. Check yesterday's log if the crash was overnight
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
Get-Content "backend\logs\server-$yesterday.log" | Where-Object { $_ -match '"level":"error"' } | Select-Object -Last 20

# 4. Full last 100 lines
Get-Content $log | Select-Object -Last 100
```
