@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js first.
  pause
  exit /b 1
)
start "Kenangan Backend" cmd /k "node backend/server.js"
timeout /t 2 /nobreak >nul
start "Kenangan Website" http://localhost:3000
