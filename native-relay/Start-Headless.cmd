@echo off
cd /d "%~dp0"
if not exist headless.json (
  echo Missing headless.json
  echo Copy headless.example.json to headless.json and add sessionToken, launchToken, or registrationLog settings.
  pause
  exit /b 1
)
npm run headless -- headless.json
pause
