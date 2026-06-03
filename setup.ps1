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

# --- Step 6: Start FocusBoard now ---
Write-Host ""
Write-Host "Starting FocusBoard..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

# --- Step 7: Open browser ---
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
Write-Host ""

Start-Process "http://localhost:3001"

Set-Location $FocusboardDir
