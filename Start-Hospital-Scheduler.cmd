@echo off
setlocal EnableExtensions
rem Double-click from Desktop: finds training\hospital-scheduler-app next to this file.
rem Double-click from repo root: runs start-app.cmd in the same folder.

if exist "%~dp0start-app.cmd" (
  call "%~dp0start-app.cmd" %*
  exit /b %ERRORLEVEL%
)

if exist "%~dp0training\hospital-scheduler-app\start-app.cmd" (
  call "%~dp0training\hospital-scheduler-app\start-app.cmd" %*
  exit /b %ERRORLEVEL%
)

echo Could not find start-app.cmd
echo - Put this file on your Desktop beside the folder training\hospital-scheduler-app, OR
echo - Keep it inside the repo folder next to start-app.cmd
echo.
echo If your project lives somewhere else, edit this file and set ROOT to that path.
pause
exit /b 1
