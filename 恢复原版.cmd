@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required. Please read README.md.
  pause
  exit /b 1
)
node bin\gemini-zh.mjs restore
set "GEMINI_ZH_RESULT=%ERRORLEVEL%"
pause
exit /b %GEMINI_ZH_RESULT%
