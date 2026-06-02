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

## Updating FocusBoard
When code changes are made:
1. Rebuild the frontend: `.\build.ps1` from the focusboard root
2. Restart the service: `Restart-Service FocusBoard`
