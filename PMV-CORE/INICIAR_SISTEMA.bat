@echo off
title PMV-Core Engine
color 0b
echo ===========================================================
echo            PMV-CORE: VERIFICADOR DE PAGOS IA
echo ===========================================================
echo.
echo [!] RECUERDA:
echo  1. Escanea el QR si aparece una ventana de Chrome.
echo  2. Mira el Dashboard en: http://localhost:3000
echo  3. El bot solo responde en el grupo autorizado.
echo.
echo [i] Iniciando motor de WhatsApp y Servidor Web...
echo.
cd /d "%~dp0"
node index.js
pause
