@echo off
title Photo Bridge FOTOS + Integraly Search (8088)
cd /d "%~dp0.."
echo.
echo  Photo Bridge — expone \\Servidor\e\FOTOS (F:) al Dell R630
echo  Puerto: 8088  |  Esta PC debe ser alcanzable como 192.168.1.97
echo.
node scripts\photo-bridge.js
pause
