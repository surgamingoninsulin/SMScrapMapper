@echo off
echo Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed!
    echo Opening Node.js download page...
    start https://www.nodejs.org
    pause
    exit /b 1
)

echo Node.js is installed!
node --version

echo.
echo Checking for package.json...
if not exist "package.json" (
    echo Creating package.json...
    (
        echo {
        echo   "name": "sm-overview-map",
        echo   "version": "1.0.0",
        echo   "description": "Scrap Mechanic Overview Map",
        echo   "main": "index.js",
        echo   "scripts": {
        echo     "start": "node index.js"
        echo   },
        echo   "dependencies": {
        echo     "express": "^4.18.2"
        echo   }
        echo }
    ) > package.json
    echo package.json created!
)

echo.
echo Checking for node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

echo.
echo Starting server...
echo Server will be available at http://localhost:8080
echo Press Ctrl+C to stop the server
echo.
node index.js

