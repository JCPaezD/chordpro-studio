@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..\..") do set "REPO_ROOT=%%~fI"
set "SERVER_PATH=%REPO_ROOT%\tools\stitch-mcp\src\server.mjs"

if not exist "%SERVER_PATH%" (
  >&2 echo Unable to locate Stitch MCP server entrypoint at "%SERVER_PATH%".
  exit /b 1
)

if not defined STITCH_API_KEY call :load_user_api_key
if not defined STITCH_API_KEY (
  >&2 echo Missing required environment variable STITCH_API_KEY. Set it in your user environment before starting the Stitch MCP server.
  exit /b 1
)

call :find_node
if errorlevel 1 exit /b 1

cd /d "%REPO_ROOT%"
"%NODE_EXE%" "%SERVER_PATH%"
exit /b %ERRORLEVEL%

:load_user_api_key
for /f "tokens=1,2,*" %%A in ('reg query "HKCU\Environment" /v STITCH_API_KEY 2^>nul ^| findstr /R /C:"\<STITCH_API_KEY\>"') do (
  set "STITCH_API_KEY=%%C"
)
exit /b 0

:find_node
for %%I in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%~$PATH:I"
if defined NODE_EXE if exist "%NODE_EXE%" exit /b 0

if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" (
  set "NODE_EXE=%NVM_SYMLINK%\node.exe"
  exit /b 0
)

if exist "C:\nvm4w\nodejs\node.exe" (
  set "NODE_EXE=C:\nvm4w\nodejs\node.exe"
  exit /b 0
)

if defined ProgramFiles if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  exit /b 0
)

if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
  exit /b 0
)

if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
  set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
  exit /b 0
)

>&2 echo Unable to locate node.exe. Ensure Node.js is installed or available through PATH/NVM.
exit /b 1
