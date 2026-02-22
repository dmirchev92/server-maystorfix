@echo off
echo ====================================
echo SnapFix Beta - Cookie Sync Setup
echo ====================================
echo.

REM Install Python dependencies
echo Installing dependencies...
pip install pycryptodome requests
echo.

REM Create Windows Scheduled Task (every 4 hours)
echo Creating scheduled task...
schtasks /create /tn "SnapFix-CookieSync" /tr "python \"%~dp0sync-cookies.py\"" /sc HOURLY /mo 4 /f
echo.

echo ====================================
echo Setup complete!
echo.
echo The task "SnapFix-CookieSync" will run every 4 hours.
echo To run manually: python "%~dp0sync-cookies.py"
echo To check logs: type "%~dp0sync-cookies.log"
echo To remove task: schtasks /delete /tn "SnapFix-CookieSync" /f
echo ====================================
pause
