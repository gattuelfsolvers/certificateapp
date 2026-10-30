@echo off
setlocal enabledelayedexpansion
title Certificate Management Launcher
color 0b

echo ====================================================================
echo           CERTIFICATE ENTRY MANAGEMENT - APP LAUNCHER
echo ====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "WEB_URL=https://certificateapp.onrender.com"

:: ----------------------------------------------------------------------
:: STEP 1: ENSURE LOCAL BACKEND ENGINE (PORT 5000) IS RUNNING
:: ----------------------------------------------------------------------
echo [1/2] Checking Local Sync Engine (Port 5000)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Local Sync Engine is already running in background!
) else (
    echo       Starting Local Sync Engine in background...
    if exist "%SCRIPT_DIR%run-hidden.vbs" (
        wscript //B "%SCRIPT_DIR%run-hidden.vbs"
    ) else if exist "%SCRIPT_DIR%src\server.js" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory '%SCRIPT_DIR%' -WindowStyle Hidden"
    ) else if exist "%SCRIPT_DIR%backend\src\server.js" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory '%SCRIPT_DIR%backend' -WindowStyle Hidden"
    )
    ping -n 4 127.0.0.1 >nul
)

:: ----------------------------------------------------------------------
:: STEP 2: LAUNCH WEB APPLICATION IN NATIVE STANDALONE APP WINDOW
:: ----------------------------------------------------------------------
echo [2/2] Opening Certificate Management Window...

:: Search for Google Chrome or Microsoft Edge to open with --app (no address bar / no tabs)
set "BROWSER_FOUND=0"

where chrome >nul 2>&1
if %errorlevel% equ 0 (
    start "" chrome --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

:: If Chrome not found, launch via Microsoft Edge in app mode
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

:LAUNCH_DONE
if !BROWSER_FOUND! equ 0 (
    echo [INFO] Opening default browser...
    start "" "%WEB_URL%"
)

echo.
echo ====================================================================
echo  Certificate Entry Management application launched successfully!
echo ====================================================================
timeout /t 2 >nul
exit /b 0
