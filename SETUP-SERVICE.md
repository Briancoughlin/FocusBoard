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

## Updating FocusBoard
When code changes are made:
1. Rebuild the frontend: `.\build.ps1` from the focusboard root
2. Restart the service: `Restart-Service FocusBoard`
