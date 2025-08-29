@echo off
echo ========================================
echo   Digital Parking Management System
echo ========================================
echo.
echo Starting the system...
echo.
echo Please wait while we install dependencies...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    echo Please install npm or reinstall Node.js
    echo.
    pause
    exit /b 1
)

echo Node.js version: 
node --version
echo npm version:
npm --version
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
) else (
    echo Dependencies already installed.
    echo.
)

echo Starting the system on port 7000...
echo.
echo Once started, open your browser and go to:
echo http://localhost:7000
echo.
echo Default login credentials:
echo Username: admin
echo Password: admin123
echo.
echo Press Ctrl+C to stop the system
echo.

REM Start the system
npm start

pause
