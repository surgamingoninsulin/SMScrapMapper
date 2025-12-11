@echo off
REM Build EXE for Scrap Mechanic Map
REM This script builds the EXE excluding cells.json

echo ============================================================
echo Building Scrap Mechanic Map EXE
echo ============================================================
echo.

REM Activate virtual environment FIRST if it exists
if exist ".venv" (
    echo [1/3] Activating virtual environment...
    call .venv\Scripts\activate.bat
    if errorlevel 1 (
        echo [ERROR] Failed to activate virtual environment!
        pause
        exit /b 1
    )
    echo [OK] Virtual environment activated
    echo.
) else (
    echo [WARNING] Virtual environment not found. Using system Python.
    echo.
)

REM Check if PyInstaller is installed (using venv Python if available)
python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo [2/3] PyInstaller not found. Installing...
    python -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller!
        pause
        exit /b 1
    )
    echo [OK] PyInstaller installed
) else (
    echo [2/3] PyInstaller found
)
echo.

REM Verify webview is installed
python -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] webview module not found in current environment!
    echo Installing requirements...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install requirements!
        pause
        exit /b 1
    )
    echo [OK] Requirements installed
    echo.
)

REM Build the EXE
echo [3/3] Building EXE (this may take a few minutes)...
echo.

REM Use the spec file if it exists, otherwise use command line
if exist "ScrapMechanic Map.spec" (
    echo Using spec file: ScrapMechanic Map.spec
    python -m PyInstaller --noconfirm "ScrapMechanic Map.spec"
) else (
    echo Using command line options...
    python -m PyInstaller --noconfirm ^
        --onefile ^
        --noconsole ^
        --icon "static\assets\img\favicon.ico" ^
        --name "ScrapMechanic Map" ^
        --add-data "static;static/" ^
        --exclude-module "cells.json" ^
        --hidden-import "webview" ^
        --hidden-import "webview.platforms" ^
        --hidden-import "webview.platforms.winforms" ^
        --hidden-import "webview.platforms.edgechromium" ^
        --collect-all "webview" ^
        --exclude-module "matplotlib" ^
        --exclude-module "numpy" ^
        --exclude-module "pandas" ^
        --exclude-module "scipy" ^
        --exclude-module "tkinter" ^
        Main.py
)

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Build Complete!
echo EXE location: dist\ScrapMechanic Map.exe
echo ============================================================
echo.
echo NOTE: cells.json is NOT included in the EXE.
echo Users must place their own cells.json in: static\assets\json\
echo.
pause

