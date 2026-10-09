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
set "SHORTCUT_NAME=Certificate Management.lnk"

:: ----------------------------------------------------------------------
:: STEP 1: CREATE DESKTOP SHORTCUT IF NOT ALREADY CREATED
:: ----------------------------------------------------------------------
echo [1/3] Checking Desktop Application Shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$shortcutPath = Join-Path $desktop '%SHORTCUT_NAME%'; " ^
  "$targetPath = '%SCRIPT_DIR%Start_App.bat'; " ^
  "$wsh = New-Object -ComObject WScript.Shell; " ^
  "$shortcut = $wsh.CreateShortcut($shortcutPath); " ^
  "$shortcut.TargetPath = $targetPath; " ^
  "$shortcut.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$shortcut.Description = 'Certificate Entry Management Software'; " ^
  "$shortcut.IconLocation = 'shell32.dll,15'; " ^
  "$shortcut.WindowStyle = 7; " ^
  "$shortcut.Save();"

if %errorlevel% equ 0 (
    echo       [OK] Desktop shortcut 'Certificate Management' verified!
) else (
    echo       [INFO] Proceeding to engine start...
)

:: ----------------------------------------------------------------------
:: STEP 2: ENSURE LOCAL BACKEND ENGINE (PORT 5000) IS RUNNING
:: ----------------------------------------------------------------------
echo [2/3] Checking Local Sync Engine (Port 5000)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Local Sync Engine is already running in background!
) else (
    echo       Starting Local Sync Engine in background...
    if exist "%SCRIPT_DIR%backend\src\server.js" (
        cd /d "%SCRIPT_DIR%backend"
        start "" /b cmd /c "node src/server.js > nul 2>&1"
    ) else if exist "%SCRIPT_DIR%src\server.js" (
        cd /d "%SCRIPT_DIR%"
        start "" /b cmd /c "node src/server.js > nul 2>&1"
    ) else if exist "%SCRIPT_DIR%package.json" (
        cd /d "%SCRIPT_DIR%"
        start "" /b cmd /c "npm start > nul 2>&1"
    )
    timeout /t 2 /nobreak > nul
)

:: ----------------------------------------------------------------------
:: STEP 3: LAUNCH WEB APPLICATION IN NATIVE STANDALONE APP WINDOW
:: ----------------------------------------------------------------------
echo [3/3] Opening Certificate Management Window...

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

where msedge >nul 2>&1
if %errorlevel% equ 0 (
    start "" msedge --app=%WEB_URL%
    set "BROWSER_FOUND=1"
    goto LAUNCH_DONE
)

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
if "%BROWSER_FOUND%"=="0" (
    echo [INFO] Standalone app browser not detected directly, opening default browser...
    start %WEB_URL%
)

echo.
echo ====================================================================
echo   SUCCESS! Software Launched Successfully.
echo   You can minimize or close this window now.
echo ====================================================================
timeout /t 3 > nul
exit
