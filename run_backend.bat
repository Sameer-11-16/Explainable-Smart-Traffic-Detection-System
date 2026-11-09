@echo off
title Explainable Smart Traffic Detection - Backend (Flask)
echo ========================================================
echo   Explainable Smart Traffic Detection System - Backend
echo ========================================================
echo.
cd /d "%~dp0backend"
echo [1/2] Checking Python dependencies...
python -c "import flask, flask_cors, cv2, ultralytics, sklearn, shap" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing missing packages...
    python -m pip install -r requirements.txt
)
echo [2/2] Starting Flask server on http://localhost:5000 ...
python app.py
pause

