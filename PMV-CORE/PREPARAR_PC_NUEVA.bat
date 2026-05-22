@echo off
title PMV-Core Full Installer (V2)
color 0b
echo ===========================================================
echo    INSTALADOR DE DEPENDENCIAS PMV-CORE (V2 - CONCILIACION)
echo ===========================================================
echo.
cd /d "%~dp0"

echo [1/2] Instalando librerias de Node.js (Express, Socket.io, Gemini, Axios)...
echo Esto puede tardar un poco dependiendo de tu internet...
call npm install

echo.
echo [2/2] Configurando motores de navegacion (Playwright/Banesco)...
call npx playwright install chromium

echo.
echo ===========================================================
echo    ¡INSTALACION COMPLETADA CON EXITO!
echo.
echo RECUERDA:
echo 1. Revisa que tu archivo .env tenga el WHATSAPP_GROUP_ID.
echo 2. Asegurate de crear la tabla payment_attempts en Supabase.
echo 3. Inicia el bot con INICIAR_SISTEMA.bat.
echo ===========================================================
pause
