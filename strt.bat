@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where docker >nul 2>nul
if not errorlevel 1 (
  docker info >nul 2>nul
  if not errorlevel 1 (
    echo Starting ForgeStudio with Docker Compose...
    docker compose up -d --build || exit /b 1
    docker compose run --rm migrate npm run db:seed || exit /b 1
    docker compose ps
    echo Open http://127.0.0.1:5173/login
    exit /b 0
  )
)

echo Docker is unavailable. Starting ForgeStudio with local Node.js processes...
where node >nul 2>nul || (echo Node.js 22+ is required. Install it and retry.& exit /b 1)
if not exist "backend\.env" (
  echo Missing backend\.env. Copy backend\.env.example to backend\.env and set DATABASE_URL.
  exit /b 1
)
if not exist "frontend\.env" (
  echo Missing frontend\.env. Copy frontend\.env.example to frontend\.env.
  exit /b 1
)
if not exist "backend\node_modules" call npm --prefix backend ci || exit /b 1
if not exist "frontend\node_modules" call npm --prefix frontend ci || exit /b 1
set "FORGE_DB_URL="
for /f "usebackq tokens=1,* delims==" %%A in ("backend\.env") do if "%%A"=="DATABASE_URL" set "FORGE_DB_URL=%%B"
if "%FORGE_DB_URL%"=="" (echo DATABASE_URL is required in backend\.env.& exit /b 1)
set "DATABASE_URL=%FORGE_DB_URL%"
powershell -NoProfile -Command "$u=[uri]$env:DATABASE_URL; if ($u.Host -notin @('localhost','127.0.0.1') -or $u.Scheme -notin @('postgresql','postgres')) { exit 1 }" || (echo Native startup requires a local PostgreSQL DATABASE_URL using localhost or 127.0.0.1.& exit /b 1)
set "NODE_ENV=development"
set "FORGE_AUTH_MODE=local"
set "FRONTEND_URL=http://127.0.0.1:5173"
set "FORGE_LOCAL_OTP_FILE=%TEMP%\forge-local-otp.json"
echo Applying database migrations...
call npm --prefix backend run db:migrate || exit /b 1
call npm --prefix backend run db:seed || exit /b 1
start "ForgeStudio API" cmd /k "cd /d %CD%\backend && npm run dev"
start "ForgeStudio Worker" cmd /k "cd /d %CD%\backend && npm run dev:worker"
start "ForgeStudio Frontend" cmd /k "cd /d %CD%\frontend && npm run dev -- --host 127.0.0.1"
echo ForgeStudio is starting: frontend http://127.0.0.1:5173, API http://127.0.0.1:5000/api/v1/health
echo Local sign-in codes are written to %FORGE_LOCAL_OTP_FILE% only in development mode.
endlocal
