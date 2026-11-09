@echo off
title Explainable Smart Traffic Detection System - Launcher
echo ========================================================
echo   Launching Explainable Smart Traffic Detection System
echo ========================================================
echo.
echo Starting Backend (Flask on port 5000)...
start "STDS Backend API" cmd /k "%~dp0run_backend.bat"

echo Starting Frontend (Vite on port 5173)...
start "STDS Frontend Dashboard" cmd /k "%~dp0run_frontend.bat"

echo.
echo Application launched!
echo - Backend API:  http://localhost:5000
echo - Frontend UI:  http://localhost:5173
echo.
pause

