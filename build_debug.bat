@echo off
REM Build EXE with console enabled for debugging
REM This will show error messages when the EXE runs

echo Building SMScrapMapper.exe with console enabled for debugging...
echo.

REM Activate virtual environment if it exists
if exist ".venv" (
    call .venv\Scripts\activate.bat
)

REM Build with console enabled (remove --noconsole)
python -m PyInstaller --noconfirm --onefile --console --icon "static\assets\img\favicon.ico" --name "SMScrapMapper" --add-data "static;static/" --hidden-import "webview" --hidden-import "webview.platforms.winforms" --hidden-import "webview.platforms.edgechromium" --collect-all "webview" --exclude-module "matplotlib" --exclude-module "numpy" --exclude-module "pandas" --exclude-module "scipy" --exclude-module "tkinter" Main.py

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Debug Build Complete!
echo EXE location: dist\SMScrapMapper.exe
echo.
echo This version has console enabled to show errors.
echo ============================================================
echo.
pause

