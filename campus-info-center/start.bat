@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Smart Campus - local static server
echo ============================================

where python >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Python found. Starting server...
  start "" http://localhost:8000
  python -m http.server 8000
  goto :end
)

where node >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Node.js found. Starting server...
  start "" http://localhost:8000
  node server.js
  goto :end
)

echo [ERROR] Neither Python nor Node.js was found.
echo Please install one of them, or open this folder with VS Code Live Server.
pause
:end
