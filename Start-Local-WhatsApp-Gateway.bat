@echo off
title Certificate App - Local WhatsApp Gateway Engine
color 0A
cls
echo =======================================================================
echo     CERTIFICATE MANAGEMENT - LOCAL WHATSAPP GATEWAY ENGINE
echo =======================================================================
echo.
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this PC! Please install Node.js first.
    pause
    exit
)

echo [2/3] Starting Local WhatsApp Gateway Engine on http://localhost:5000...
echo.
echo =======================================================================
echo  Keep this window OPEN while running WhatsApp Automation.
echo  Scan QR code or use 8-Digit Pairing Code directly in Admin Dashboard.
echo =======================================================================
echo.

cd /d "%~dp0\backend"
npm run dev

pause
