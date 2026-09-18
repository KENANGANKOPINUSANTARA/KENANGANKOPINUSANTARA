@echo off
cd /d "%~dp0"
if not exist backend\server.js (echo Backend not found.&pause&exit /b 1)
node backend\server.js
pause
