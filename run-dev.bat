@echo off
echo ========================================================
echo Starting ForgeStudio Backend and Frontend in Fast Mode
echo (Preserving all pipeline files and qualification state)
echo ========================================================

:: Navigate to root directory of the script
cd /d "%~dp0"

:: Start Backend in a new window
echo Starting Backend (Port 5000)...
start "ForgeStudio - Backend (:5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

:: Start Frontend in a new window
echo Starting Frontend (Port 5173)...
start "ForgeStudio - Frontend (:5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both services launched in separate windows!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo ========================================================
