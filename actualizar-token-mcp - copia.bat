@echo off
chcp 65001 >nul
title Actualizar Token MCP MercadoLibre
echo ============================================
echo  🔄 ACTUALIZAR TOKEN MCP MERCADOLIBRE
echo ============================================
echo.
echo Este script refresca el access_token de MercadoLibre
echo y actualiza la configuracion de Cline/Antigravity.
echo.
echo Cuenta: CORPORACIONRWCCA
echo.
pause

echo.
echo 📡 Ejecutando refresh-token.js...
echo.

node "%~dp0mcp-token-refresh\refresh-token.js"

echo.
echo ============================================
if %ERRORLEVEL% EQU 0 (
    echo  ✅ Token actualizado correctamente
    echo.
    echo 💡 Si Cline/Antigravity esta abierto,
    echo    reinicialo para que lea el nuevo token.
) else (
    echo  ❌ Error al actualizar el token
    echo    Revisa la conexion a internet y Supabase.
)
echo ============================================
echo.
pause
