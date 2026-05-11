@echo off
title PMV-Core Full Installer
echo ==========================================
echo    INSTALADOR DE DEPENDENCIAS PMV-CORE
echo ==========================================
cd /d "%~dp0"

echo [1/2] Instalando librerias de Node.js...
call npm install

echo [2/2] Descargando motores de navegacion (Playwright)...
call npx playwright install chromium

echo ==========================================
echo    ¡INSTALACION COMPLETA Y EXITOSA!
echo    Ya puedes iniciar con INICIAR_SISTEMA.bat
echo ==========================================
pause
