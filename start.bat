@echo off
rem Starts API, durable AI worker and frontend. Stitch/Claude settings stay server-side.
setlocal EnableExtensions
rem Shared launcher validates backend prompt retention and worker cleanup settings.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-forge.ps1" %*
exit /b %errorlevel%
