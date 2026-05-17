@echo off
setlocal enabledelayedexpansion

rem If a Next.js dev server is already running for this project, kill it first.
rem The lock file .next/dev/lock stores the PID of the active dev server.
set LOCKFILE=%~dp0..\.next\dev\lock
if exist "!LOCKFILE!" (
  for /f "tokens=1" %%a in ('powershell -NoProfile -Command "(Get-Content '!LOCKFILE!' | ConvertFrom-Json).pid" 2^>nul') do (
    if not "%%a"=="" (
      taskkill /F /PID %%a >nul 2>&1
    )
  )
  del "!LOCKFILE!" >nul 2>&1
  timeout /t 1 /nobreak >nul
)

set BACKEND_URL=http://127.0.0.1:9999
"C:\Users\mesar\AppData\Local\nvm\v24.15.0\node.exe" "%~dp0..\node_modules\next\dist\bin\next" dev --port 3001
