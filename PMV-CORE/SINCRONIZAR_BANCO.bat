@echo off
title PMV-Core: Sincronizador Bancario
color 0e
echo ===========================================================
echo            PMV-CORE: CONECTANDO CON BANESCO...
echo ===========================================================
echo.
echo [!] RECUERDA:
echo  1. Debes tener tu usuario y clave en el archivo .env
echo  2. No toques el mouse mientras el robot navega el banco.
echo.
echo [i] Iniciando Scraper de Banesco...
echo.
cd /d "%~dp0"
node banesco-sync.js
echo.
echo ===========================================================
echo    SINCRONIZACION FINALIZADA. REVISA TU DASHBOARD.
echo ===========================================================
pause
