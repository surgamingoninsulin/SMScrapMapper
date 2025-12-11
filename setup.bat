@echo off
REM Scrap Mechanic Map - Auto Setup and Run Script
REM This script automatically sets up the environment and runs the application

echo ============================================================
echo Scrap Mechanic Map - Auto Setup and Run
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo [1/5] Python found: 
python --version
echo.

REM Check if virtual environment exists
if not exist ".venv" (
    echo [2/5] Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
) else (
    echo [2/5] Virtual environment already exists
)
echo.

REM Activate virtual environment
echo [3/5] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b 1
)
echo [OK] Virtual environment activated
echo.

REM Update pip
echo [4/5] Updating pip...
python -m pip install --upgrade pip --quiet
if errorlevel 1 (
    echo [WARNING] Failed to update pip, continuing anyway...
) else (
    echo [OK] Pip updated
)
echo.

REM Install/upgrade requirements
echo [5/5] Installing/updating requirements...
python -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install requirements!
    echo Trying without --quiet flag for more details...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        pause
        exit /b 1
    )
) else (
    echo [OK] Requirements installed/updated
)
echo.

REM Run the application
echo ============================================================
echo Starting Scrap Mechanic Map Server...
echo ============================================================
echo.
python Main.py

REM If the script exits, pause so user can see any error messages
if errorlevel 1 (
    echo.
    echo [ERROR] Application exited with an error!
    pause
)

