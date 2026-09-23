@echo off
setlocal
cd /d "%~dp0"
set "LOG=%CD%\liflow-startup-log.txt"

if not exist "package.json" (
  echo.
  echo Liflow cannot start because its files are missing.
  echo Right-click the ZIP, choose "Extract All", then open START_LIFLOW.bat
  echo from the extracted folder.
  echo.
  pause
  exit /b 1
)

rem Refresh common Node.js installation paths even when Windows PATH has not
rem propagated to Explorer yet.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if exist "%AppData%\nvm\current\node.exe" set "PATH=%AppData%\nvm\current;%PATH%"

where node
if errorlevel 1 (
  echo.
  echo Node.js was not found by Windows.
  echo Restart Windows once after installing Node.js, then try again.
  pause
  exit /b 1
)

where npm.cmd
if errorlevel 1 (
  echo.
  echo npm was not found. Restart Windows once, then try again.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
echo Node.js version:
node --version
echo npm version:
call npm.cmd --version
if %NODE_MAJOR% LSS 22 (
  echo.
  echo Node.js is too old. Install Node.js 22 or later, then try again.
  pause
  exit /b 1
)

echo.
echo Starting Liflow. The first launch can take several minutes.
echo Keep this window open while using Liflow.
echo.
call npm.cmd run local
set "RESULT=%ERRORLEVEL%"

if not "%RESULT%"=="0" (
  echo.
  echo Liflow could not start.
  echo Please take a screenshot of the error shown above and send it here.
) else (
  echo Liflow stopped.
)
pause
exit /b %RESULT%
