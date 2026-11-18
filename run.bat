@echo off
title TAHOTO Enterprise Web Server (Tap Hoa Tong Hop Tho Hoa)
cd /d "%~dp0"
echo ===================================================
echo   KHOI DONG HE THONG TAHOTO ENTERPRISE WEB (PORT 8000)
echo   Mo trinh duyet tai: http://localhost:8000
echo ===================================================
start "" "http://localhost:8000"
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
