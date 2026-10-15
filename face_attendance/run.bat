@echo off
title FaceTrack AI Server
color 0A
cls
echo.
echo  ============================================
echo    FaceTrack AI - Face Attendance System
echo  ============================================
echo.
echo  [*] Starting server on http://localhost:5000
echo  [*] Press CTRL+C to stop the server
echo.

cd /d "%~dp0"

:: Force UTF-8 so emoji / unicode in Python print() never crash on Windows
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

python app.py

echo.
echo  [!] Server stopped.
pause
