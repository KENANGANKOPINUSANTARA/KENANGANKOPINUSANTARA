@echo off
cd /d "%~dp0"
if not exist backend\server.js (echo Backend server not found.&pause&exit /b 1)
start "KENANGAN KOPI NUSANTARA Backend" cmd /k "node backend\server.js"
timeout /t 2 >nul
start "KENANGAN KOPI NUSANTARA" http://localhost:3000
