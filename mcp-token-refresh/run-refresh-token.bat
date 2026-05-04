@echo off
setlocal

:: ================================================================
:: Run Refresh Token - Sin interacción para Task Scheduler
:: ================================================================
:: Este script corre refresh-token.js sin pedir enter ni pause.
:: Úsalo directamente en taskschd.msc como acción programada.
::
:: Ejemplo de configuración en Task Scheduler:
::   Programa:  C:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mcp-token-refresh\run-refresh-token.bat
::   Iniciar en: C:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mcp-token-refresh
::
:: ================================================================

cd /d "%~dp0"
node refresh-token.js >> refresh-token.log 2>&1

exit /b %ERRORLEVEL%
