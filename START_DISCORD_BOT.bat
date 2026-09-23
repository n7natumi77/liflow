@echo off
setlocal
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if not exist ".env.discord" (
  echo .env.discord is missing.
  echo Copy .env.discord.example to .env.discord and fill in the values.
  pause
  exit /b 1
)
call npm.cmd run discord:bot
if errorlevel 1 echo Discord Bot could not start. Check the message above.
pause
