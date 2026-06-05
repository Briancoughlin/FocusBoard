# FocusBoard Setup Script
# Run this once to install and configure FocusBoard on a new machine

$ErrorActionPreference = "Stop"
$FocusboardDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   FocusBoard Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Check for Node.js ---
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
$nodePath = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path $nodePath)) {
    Write-Host "Node.js not found. Installing via winget..." -ForegroundColor Yellow
    try {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        Write-Host "Node.js installed." -ForegroundColor Green
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    } catch {
        Write-Host "Could not auto-install Node.js. Please install it from https://nodejs.org then re-run this script." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Node.js found at $nodePath" -ForegroundColor Green
}

# --- Step 2: Install backend dependencies ---
Write-Host ""
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$FocusboardDir\backend"
& $nodePath "$env:APPDATA\npm\node_modules\npm\bin\npm-cli.js" install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # Try npm directly
    npm install
}
Write-Host "Backend dependencies installed." -ForegroundColor Green

# --- Step 3: Install frontend dependencies ---
Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$FocusboardDir\frontend"
npm install
Write-Host "Frontend dependencies installed." -ForegroundColor Green

# --- Step 4: Build frontend ---
Write-Host ""
Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build
Write-Host "Frontend built." -ForegroundColor Green

# --- Step 5: Register scheduled task ---
Write-Host ""
Write-Host "Setting up auto-start on login..." -ForegroundColor Yellow

$taskName = "FocusBoard"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Removing existing scheduled task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "server.js" `
    -WorkingDirectory "$FocusboardDir\backend"

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit 0 `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -Hidden

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "FocusBoard ADHD task aggregator" `
    -Force | Out-Null

Write-Host "Auto-start registered." -ForegroundColor Green

# --- Step 6: Register notification watcher scheduled task ---
Write-Host ""
Write-Host "Setting up notification watcher auto-start..." -ForegroundColor Yellow

$watcherTaskName = "FocusBoardNotifications"
$existingWatcherTask = Get-ScheduledTask -TaskName $watcherTaskName -ErrorAction SilentlyContinue

if ($existingWatcherTask) {
    Write-Host "Removing existing notification watcher task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $watcherTaskName -Confirm:$false
}

$watcherAction = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "notification-watcher.js" `
    -WorkingDirectory "$FocusboardDir\backend"

$watcherTrigger = New-ScheduledTaskTrigger -AtLogOn

$watcherSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit 0 `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -Hidden

$watcherPrincipal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $watcherTaskName `
    -Action $watcherAction `
    -Trigger $watcherTrigger `
    -Settings $watcherSettings `
    -Principal $watcherPrincipal `
    -Description "FocusBoard Slack notification watcher" `
    -Force | Out-Null

Write-Host "Notification watcher auto-start registered." -ForegroundColor Green

# --- Step 7: Register nightly backup scheduled task ---
Write-Host ""
Write-Host "Setting up nightly backup task..." -ForegroundColor Yellow

$backupTaskName = "FocusBoardBackup"
$existingBackupTask = Get-ScheduledTask -TaskName $backupTaskName -ErrorAction SilentlyContinue

if ($existingBackupTask) {
    Write-Host "Removing existing backup task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $backupTaskName -Confirm:$false
}

$backupAction = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "backup.js" `
    -WorkingDirectory "$FocusboardDir\backend"

$backupTrigger = New-ScheduledTaskTrigger -Daily -At "00:00"

$backupSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -Hidden

$backupPrincipal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $backupTaskName `
    -Action $backupAction `
    -Trigger $backupTrigger `
    -Settings $backupSettings `
    -Principal $backupPrincipal `
    -Description "FocusBoard nightly backup — runs daily at midnight" `
    -Force | Out-Null

Write-Host "Nightly backup task registered (runs daily at midnight)." -ForegroundColor Green

# --- Step 9: Start FocusBoard now ---
Write-Host ""
Write-Host "Starting FocusBoard..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

Write-Host "Starting notification watcher..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $watcherTaskName
Start-Sleep -Seconds 1

# --- Step 8: Open browser ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   FocusBoard is ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening http://localhost:3001 in your browser..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Go to Settings and enter your API credentials" -ForegroundColor Gray
Write-Host "  2. Click the install icon in Chrome's address bar to install as a desktop app" -ForegroundColor Gray
Write-Host "  3. FocusBoard will start automatically every time you log in" -ForegroundColor Gray
Write-Host "  4. Allow notification access: Windows Settings > Privacy & Security > Notifications" -ForegroundColor Gray
Write-Host "     Enable 'Allow apps to access your notifications' for Slack notifications to be captured" -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:3001"

Set-Location $FocusboardDir
