@echo off
REM One command: creates a local .venv, installs backend deps, serves API + web app on http://127.0.0.1:8000
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  python -m venv .venv || goto :err
)
.venv\Scripts\python -m pip install -q -r backend\requirements.txt || goto :err
echo KrishiGuide running at http://127.0.0.1:8000  (Ctrl+C to stop)
start "" http://127.0.0.1:8000
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
goto :eof
:err
echo Setup failed. Is Python 3.10+ installed and on PATH? (python.org installer: tick "Add python.exe to PATH")
pause
