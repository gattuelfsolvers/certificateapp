@echo off
title Certificate Entry Management Server Launcher
color 0A
echo ======================================================
echo       STARTING CERTIFICATE ENTRY MANAGEMENT
echo ======================================================
echo.

echo [1/3] Starting Backend Server (Port 5000)...
start "Backend Server (Port 5000)" /min cmd /c "cd /d e:\SOFTWARE\Certificate Entry Management\backend && node src/server.js"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Frontend Server (Port 3001)...
start "Frontend Server (Port 3001)" /min cmd /c "cd /d e:\SOFTWARE\Certificate Entry Management\frontend && npm run dev"

echo Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo [3/3] Opening Software Page in Google Chrome...
start chrome "http://localhost:3001"

echo.
echo ======================================================
echo   SUCCESS! All servers started & browser opened.
echo   You can minimize this window.
echo ======================================================
timeout /t 3 /nobreak >nul
exit
