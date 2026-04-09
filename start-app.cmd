@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1" %*
set ERR=%ERRORLEVEL%
echo.
echo ---------------------------------------------------------------------------
if %ERR% neq 0 (
  echo Script finished with error code %ERR%.
) else (
  echo Script finished.
)
echo Press any key to close this window.
pause >nul
endlocal
exit /b %ERR%
