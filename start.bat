@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo ============================================
echo  Hospital Scheduler - Starting all services
echo ============================================

REM --- 1. Start MongoDB via Docker ---
echo [1/3] Starting MongoDB (Docker)...

REM Launch Docker Desktop if not already running
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
if %errorlevel% neq 0 (
    echo       Docker Desktop not running - launching it...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo       Docker Desktop already running.
)

REM Wait for the Docker daemon to become ready (up to 60s)
echo       Waiting for Docker daemon...
set DOCKER_READY=0
for /L %%i in (1,1,30) do (
    if !DOCKER_READY!==0 (
        docker info >nul 2>&1
        if !errorlevel!==0 (
            set DOCKER_READY=1
            echo       Docker daemon is ready.
        ) else (
            timeout /t 2 /nobreak >nul
        )
    )
)
if !DOCKER_READY!==0 (
    echo [ERROR] Docker daemon did not start in time. Try again after Docker Desktop finishes loading.
    pause
    exit /b 1
)

REM Check if the container already exists (running or stopped)
docker inspect mongo >nul 2>&1
if %errorlevel%==0 (
    REM Container exists - start it if not already running
    docker start mongo >nul 2>&1
    echo       MongoDB container started.
) else (
    REM Container does not exist - create and run it
    docker run -d --name mongo -p 27017:27017 mongo:latest >nul 2>&1
    echo       MongoDB container created and started.
)

REM Wait a moment for MongoDB to be ready
timeout /t 3 /nobreak >nul

REM --- 2. Start Flask backend ---
echo [2/3] Starting Flask backend (port 5000)...
if exist "%BACKEND%\venv\Scripts\activate.bat" (
    start "Backend - Flask" cmd /k "cd /d "%BACKEND%" && call venv\Scripts\activate.bat && python run.py"
) else if exist "%BACKEND%\.venv\Scripts\activate.bat" (
    start "Backend - Flask" cmd /k "cd /d "%BACKEND%" && call .venv\Scripts\activate.bat && python run.py"
) else (
    start "Backend - Flask" cmd /k "cd /d "%BACKEND%" && python run.py"
)
echo       Flask backend window opened.

REM --- 3. Start Next.js frontend ---
echo [3/3] Starting Next.js frontend (port 3000)...
start "Frontend - Next.js" cmd /k "cd /d "%FRONTEND%" && npm run dev"
echo       Next.js frontend window opened.

echo.
echo All services launched.
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo Close the individual terminal windows to stop each service.
pause
