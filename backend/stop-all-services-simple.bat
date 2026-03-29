@echo off
cd /d "%~dp0"
echo ========================================
echo Stopping All Backend Services
echo ========================================
echo.

echo Closing the 6 service CMD windows...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\backend\stop-all-services.ps1"

echo.
echo ========================================
echo Stop script finished
echo ========================================
pause
