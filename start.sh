#!/usr/bin/env bash
# One command: creates a local .venv, installs backend deps, serves API + web app on http://127.0.0.1:8000
set -e
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install -q -r backend/requirements.txt
cd backend
echo "KrishiGuide running -> http://${HOST:-127.0.0.1}:${PORT:-8000}   (Ctrl+C to stop)"
exec ../.venv/bin/python -m uvicorn app.main:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}"
