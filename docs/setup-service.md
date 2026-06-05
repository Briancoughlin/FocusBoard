# Running FocusBoard as a Windows Service

## One-time setup

### Step 1 — Build the frontend
Open PowerShell and run:
```powershell
cd C:\Users\briancoughlin\Claudecoder\focusboard
.\build.ps1
```

### Step 2 — Install the service (run as Administrator)
Right-click PowerShell → Run as Administrator, then:
```powershell
cd C:\Users\briancoughlin\Claudecoder\focusboard\backend
npm install
node install-service.js
```

### Step 3 — Install the PWA
Open Chrome and go to http://localhost:3001
Click the install icon (⊕) in the address bar → Install FocusBoard

FocusBoard will now:
- Start automatically when Windows starts
- Be available at http://localhost:3001 always
- Run as a proper desktop app via the PWA install

## Managing the service

### Stop the service
```powershell
Stop-Service FocusBoard
```

### Start the service
```powershell
Start-Service FocusBoard
```

### Remove the service (run as Administrator)
```powershell
cd C:\Users\briancoughlin\Claudecoder\focusboard\backend
node uninstall-service.js
```

## Slack Notification Watcher

FocusBoard includes a notification watcher (`backend/notification-watcher.js`) that captures Windows toast notifications from Slack and automatically creates tasks.

### Required permission

The watcher uses the Windows Runtime `UserNotificationListener` API, which requires explicit user consent.

**Before the watcher can read notifications:**

1. Open **Windows Settings** → **Privacy & Security** → **Notifications**
2. Make sure **"Allow apps to access your notifications"** is turned **On**
3. Scroll down and ensure **Node.js** (or whichever app runs the watcher) is allowed

If permission is missing, the watcher logs:
```
PERMISSION REQUIRED: Go to Windows Settings > Privacy & Security > Notifications ...
```
It will keep retrying every 10 seconds — no restart needed once you grant access.

### Running the watcher manually

```powershell
cd C:\Users\briancoughlin\Claudecoder\focusboard\backend
npm run watch-notifications
```

### Scheduled task

`setup.ps1` registers a second scheduled task called **FocusBoardNotifications** that starts the watcher automatically at login, alongside the main FocusBoard server.

To manage it:

```powershell
# Check status
Get-ScheduledTask -TaskName FocusBoardNotifications

# Start / stop manually
Start-ScheduledTask  -TaskName FocusBoardNotifications
Stop-ScheduledTask   -TaskName FocusBoardNotifications

# Remove
Unregister-ScheduledTask -TaskName FocusBoardNotifications -Confirm:$false
```

### How it works

1. Every 10 seconds the watcher runs a PowerShell script that calls `UserNotificationListener.GetNotificationsAsync()`.
2. Notifications whose `AppInfo.DisplayName` contains "Slack" are parsed for title and body text.
3. Each new notification is `POST`ed to `http://localhost:3001/api/slack-notification`.
4. The backend creates a high-priority task and holds it in memory.
5. The next `/api/sync` call picks up the pending tasks and returns them to the frontend.

## FocusBoardWatchdog Scheduled Task

The watchdog process (`backend/watchdog.js`) runs on port 3002 and can restart FocusBoard on demand. It is what the offline recovery page (`frontend/public/offline.html`) calls when you click the "Restart" button.

### Register the watchdog task (run as Administrator)

```powershell
$focusBoardDir = "C:\Users\briancoughlin\Claudecoder\focusboard"
$nodePath = (Get-Command node).Source

$action  = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "backend\watchdog.js" `
    -WorkingDirectory $focusBoardDir

$trigger = New-ScheduledTaskTrigger -AtLogon

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "FocusBoardWatchdog" `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -RunLevel  Highest `
    -Force
```

### Manage the watchdog

```powershell
# Check status
Get-ScheduledTask -TaskName FocusBoardWatchdog

# Start / stop manually
Start-ScheduledTask  -TaskName FocusBoardWatchdog
Stop-ScheduledTask   -TaskName FocusBoardWatchdog

# Remove
Unregister-ScheduledTask -TaskName FocusBoardWatchdog -Confirm:$false
```

### Verify it is running

```powershell
Invoke-RestMethod http://localhost:3002/health
# Expected: @{ alive = True; watchdog = True }
```

---

## FocusBoardBackup Scheduled Task

The backup script (`backend/backup.js`) creates a gzipped JSON bundle of all app data in `backend/backups/`.

### Register the backup task (run as Administrator)

```powershell
$focusBoardDir = "C:\Users\briancoughlin\Claudecoder\focusboard"
$nodePath = (Get-Command node).Source

$action  = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "backend\backup.js" `
    -WorkingDirectory $focusBoardDir

# Run nightly at 2 AM
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

Register-ScheduledTask `
    -TaskName "FocusBoardBackup" `
    -Action   $action `
    -Trigger  $trigger `
    -RunLevel Highest `
    -Force
```

---

## Updating FocusBoard
When code changes are made:
1. Rebuild the frontend: `.\build.ps1` from the focusboard root
2. Restart the main server and watchdog:
```powershell
Stop-ScheduledTask  -TaskName "FocusBoard"
Stop-ScheduledTask  -TaskName "FocusBoardWatchdog"
Start-ScheduledTask -TaskName "FocusBoard"
Start-ScheduledTask -TaskName "FocusBoardWatchdog"
```
