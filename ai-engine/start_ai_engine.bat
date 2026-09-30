@echo off
rem AI-Dost AI Engine starter (FastAPI :8001)
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo [SETUP] Creating venv...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] venv creation failed. Python install karke PATH me add karo, phir retry karo.
    pause
    exit /b 1
  )
)
echo [SETUP] Installing/updating requirements...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed. requirements.txt aur network check karo.
  pause
  exit /b 1
)
start "AI-Dost AI Engine" /min .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
echo AI Engine starting on http://127.0.0.1:8001
timeout /t 5 >nul
