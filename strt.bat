@echo off
rem Compatibility launcher; start.bat also validates optional Stitch/Claude settings.
setlocal EnableExtensions
rem Compatibility alias; all startup validation lives in start-forge.ps1.
call "%~dp0start.bat" %*
exit /b %errorlevel%
