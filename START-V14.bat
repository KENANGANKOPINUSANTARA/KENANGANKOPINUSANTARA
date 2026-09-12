@echo off
cd /d "%~dp0"
echo =============================================
echo   KENANGAN KOPI NUSANTARA - V14
 echo   Consistent Product Card Actions
 echo =============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terinstall. Install Node.js terlebih dahulu.
  pause
  exit /b 1
)
node backend/server.js
pause
