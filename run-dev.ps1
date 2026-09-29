# ForgeStudio Fast Dev Launcher (PowerShell)
# Preserves all active increments, git stages, and qualification pipelines

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting ForgeStudio Backend & Frontend" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Start Backend in a new window
Write-Host "Launching Backend on http://localhost:5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\backend'; npm run dev"

# Start Frontend in a new window
Write-Host "Launching Frontend on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; npm run dev"

Write-Host ""
Write-Host "Started successfully in dedicated windows!" -ForegroundColor Green
Write-Host "  Backend API:  http://localhost:5000" -ForegroundColor Green
Write-Host "  Frontend App: http://localhost:5173" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
