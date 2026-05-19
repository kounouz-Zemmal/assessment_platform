@echo off
REM ========================================================
REM  Assessment Platform - Local PostgreSQL Startup Script
REM  Run this ONCE per session before starting the Django server
REM ========================================================

SET PGBIN=%USERPROFILE%\postgresql16\pgsql\bin
SET PGDATA=%USERPROFILE%\postgresql16\data

echo [1/2] Starting local PostgreSQL server on port 5433...
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%USERPROFILE%\postgresql16\pg.log" -o "-p 5433" start

echo Waiting 3 seconds for server to be ready...
timeout /t 3 /nobreak >nul

echo [2/3] Starting React frontend...
start cmd /k "cd /d %~dp0 && npm run dev"

echo [2/2] Starting Django development server...
cd /d "%~dp0backend"
python manage.py runserver

pause
