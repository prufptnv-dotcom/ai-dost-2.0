@echo off
title AI-Dost 3.0 - VKP-Omni-2B Engine (NandiAi/VKP-Omni-2B)
echo ========================================================
echo   AI-Dost 3.0 - VKP-Omni-2B Multimodal AI Engine
echo   Model: NandiAi/VKP-Omni-2B
echo   Developed by: Vikash Kumar Pandit
echo ========================================================

cd /d "%~dp0"

REM Detect Python with PyTorch / CUDA
set PYTHON_CMD=python
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist .venv\Scripts\python.exe (
    set "PYTHON_CMD=.venv\Scripts\python.exe"
)

echo Using Python: %PYTHON_CMD%
set VKP_OMNI_PORT=8002
"%PYTHON_CMD%" vkp_omni_engine.py

pause
