@echo off
title JHARSEWA CERTIFICATE ENTRY MANAGEMENT SOFTWARE
color 0A

echo ====================================================================
echo           JHARSEWA CERTIFICATE ENTRY MANAGEMENT SYSTEM
echo                AUTOMATIC APP & SERVER LAUNCHER
echo ====================================================================
echo.

:: 1. Start Backend Server Daemon Process
echo [1/3] Starting Backend API Server (Port 5000)...
cd /d "%~dp0backend"
start /b cmd /c "npm run dev > nul 2>&1"

:: 2. Start Frontend App Server
echo [2/3] Starting Frontend Web Interface (Port 3001)...
cd /d "%~dp0frontend"
start /b cmd /c "npm run dev > nul 2>&1"

:: 3. Wait 3 seconds for servers to initialize
echo [3/3] Waiting for services to initialize...
timeout /t 3 /nobreak > nul

:: 4. Open Application directly in Default Browser
echo Launching Application in Chrome / Web Browser...
start http://localhost:3001/

echo.
echo ====================================================================
echo   SUCCESS! Application is now running at: http://localhost:3001/
echo   Please do NOT close this window while using the application.
echo ====================================================================
echo.
pause
