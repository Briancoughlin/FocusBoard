# FocusBoard startup wrapper — captures Node crash output to a log file
$logDir = "$PSScriptRoot\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = "$logDir\server-$(Get-Date -Format 'yyyy-MM-dd').log"

"[$(Get-Date -Format 'HH:mm:ss')] FocusBoard starting..." | Add-Content $logFile

& "C:\Program Files\nodejs\node.exe" "$PSScriptRoot\server.js" 2>&1 | ForEach-Object {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $_"
    $line | Add-Content $logFile
    $line
}

"[$(Get-Date -Format 'HH:mm:ss')] FocusBoard process exited with code $LASTEXITCODE" | Add-Content $logFile
