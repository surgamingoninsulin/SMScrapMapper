@echo off
REM One-line auto-py-to-exe build command for SMScrapMapper
REM This includes all static files baked into the EXE
REM Only user_data.json will be generated on launch
REM cells.json must be placed by user next to the EXE

echo Building SMScrapMapper.exe...
echo.

REM Activate virtual environment if it exists
if exist ".venv" (
    call .venv\Scripts\activate.bat
)

REM One-line PyInstaller command
python -m PyInstaller --noconfirm --onefile --noconsole --icon "static\assets\img\favicon.ico" --name "SMScrapMapper" --add-data "static;static/" --hidden-import "webview" --hidden-import "webview.platforms.winforms" --hidden-import "webview.platforms.edgechromium" --collect-all "webview" --exclude-module "matplotlib" --exclude-module "numpy" --exclude-module "pandas" --exclude-module "scipy" --exclude-module "tkinter" Main.py

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Build Complete!
echo EXE location: dist\SMScrapMapper.exe
echo ============================================================
echo.
echo NOTE: 
echo - All static files are baked into the EXE
echo - cells.json must be placed next to SMScrapMapper.exe by the user
echo - user_data.json will be generated automatically on launch
echo.
pause

