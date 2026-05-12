@echo off
REM Stops the local PostgreSQL server
SET PGBIN=%USERPROFILE%\postgresql16\pgsql\bin
SET PGDATA=%USERPROFILE%\postgresql16\data
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" stop
echo PostgreSQL server stopped.
pause
