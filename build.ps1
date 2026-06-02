Write-Host "Building FocusBoard frontend..."
Set-Location frontend
npm run build
Set-Location ..
Write-Host "Build complete. Frontend built to frontend/dist/"
Write-Host "Start the backend: cd backend && npm run dev"
