@echo off
echo Ronin Staking Explorer
echo =====================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed. Please install Node.js from https://nodejs.org/
    echo.
    echo After installing Node.js, run this script again.
    pause
    exit /b
)

echo Node.js is installed. Checking version...
node --version
echo.

REM Check for npm install
if not exist "node_modules" (
    echo Installing dependencies (this may take a minute)...
    call npm install
    echo.
)

REM Prompt user to choose an option
echo Choose an option:
echo.
echo 1. Run Contract Checker (command-line)
echo 2. Run Web Application (browser-based)
echo.
choice /C 12 /N /M "Enter your choice (1 or 2): "

if %ERRORLEVEL% equ 1 (
    echo.
    echo Running Contract Checker...
    echo.
    call npx ts-node src/contractCheck.ts
) else (
    echo.
    echo Building and starting the web application...
    echo.
    call npm run build
    echo.
    echo Starting server...
    echo.
    call node dist/index.js
)

echo.
pause
