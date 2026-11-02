@echo off
REM One-click launcher for Floe Shove on Windows.
cd /d "%~dp0"
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 server.py
  exit /b %ERRORLEVEL%
)
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python server.py
  exit /b %ERRORLEVEL%
)
echo Python 3 is required to launch Floe Shove.
echo Install it from https://www.python.org/downloads/ and try again.
pause
exit /b 1
