@echo off
chcp 65001 >nul
:: =============================================================================
:: MCP MercadoLibre Token Refresher — Task Scheduler Setup
:: =============================================================================
:: Este script crea una tarea programada en Windows que ejecuta
:: refresh-token.js cada 5 horas automáticamente.
::
:: EJECUTAR COMO ADMINISTRADOR
:: =============================================================================

title MCP Token Refresher — Setup

echo.
echo  🔄 MCP MercadoLibre Token Refresher — Instalador de Tarea Programada
echo  =================================================================
echo.

:: Detectar ruta de Node.js
for /f "delims=" %%i in ('where node 2^>nul') do set NODE_PATH=%%i

if not defined NODE_PATH (
    echo  ❌ ERROR: Node.js no encontrado en el PATH.
    echo     Asegúrate de que Node.js esté instalado y disponible globalmente.
    echo.
    pause
    exit /b 1
)

echo  ✅ Node.js encontrado: %NODE_PATH%

:: Detectar ruta del script
set SCRIPT_PATH=%~dp0refresh-token.js
set SCRIPT_PATH=%SCRIPT_PATH:\=\\%

echo  ✅ Script: %SCRIPT_PATH%

:: Nombre de la tarea
set TASK_NAME=MeliMCPRefresh

:: Eliminar tarea anterior si existe
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel%==0 (
    echo  📝 Tarea anterior encontrada. Eliminando...
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
    echo  ✅ Tarea anterior eliminada.
)

:: Crear nueva tarea
echo  🔧 Creando tarea programada...

schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%NODE_PATH%\" \"%SCRIPT_PATH%\"" ^
    /sc hourly ^
    /mo 5 ^
    /rl HIGHEST ^
    /ru %USERNAME% ^
    /np ^
    /f >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo  ❌ ERROR: No se pudo crear la tarea programada.
    echo     Asegúrate de ejecutar este script como Administrador.
    echo.
    pause
    exit /b 1
)

echo  ✅ Tarea "%TASK_NAME%" creada exitosamente.
echo.
echo  📅 Configuración:
echo     • Frecuencia: Cada 3 horas
echo     • Comando:    %NODE_PATH% %SCRIPT_PATH%
echo     • Usuario:    %USERNAME%
echo.
echo  💡 Puedes verificar la tarea en:
echo     Task Scheduler ^> Task Scheduler Library ^> %TASK_NAME%
echo.
echo  🚀 Para probar ahora mismo, ejecuta:
echo     node "%~dp0refresh-token.js"
echo.

pause
