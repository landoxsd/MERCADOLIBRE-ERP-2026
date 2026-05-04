# 🔄 MCP MercadoLibre Token Refresher

Script automatizado para refrescar el `access_token` de MercadoLibre y mantener actualizada la configuración del MCP Server en Cline/Antigravity.

---

## ¿Qué hace este script?

1. **Lee** los `refresh_token` de **TODAS las cuentas** (o una específica) desde Supabase.
2. **Solicita** un nuevo `access_token` a la API de MercadoLibre por cada cuenta.
3. **Actualiza** la base de datos con los nuevos tokens y sus fechas de expiración.
4. **Reemplaza** el token en los archivos de configuración de Cline (`cline_mcp_settings.json`).

> **Nota:** Los tokens de MercadoLibre expiran cada **6 horas**. Este script asegura que nunca tengas un token vencido.

---

## 📁 Estructura

```
mcp-token-refresh/
├── refresh-token.js          # Script principal
├── setup-task-scheduler.bat  # Instalador del Task Scheduler (Windows)
└── README.md                 # Este archivo
```

---

## 🚀 Uso manual

```bash
cd mcp-token-refresh
node refresh-token.js
```

Salida esperada:
```
🔄 MCP Token Refresher — 2026-05-02T20:00:00.000Z

📡 Buscando cuenta "CORPORACIONRWCCA" en Supabase...
🔑 Refresh token encontrado
🌐 Solicitando nuevo access_token a MercadoLibre...
✅ Nuevo token recibido
   Expira en: 21600 segundos (~6h)
   User ID: 248086934
💾 Actualizando base de datos...
✅ Base de datos actualizada

📝 Actualizando archivos de configuración...
✅ Config actualizado: C:\Users\ORLANDO\...\cline_mcp_settings.json
✅ Config actualizado: C:\Users\ORLANDO\Documents\...\claude_desktop_config_snippet.json

🎉 Proceso completado exitosamente!
   Token válido hasta: 2026-05-03T02:00:00.000Z
   Archivos actualizados: 2

💡 Nota: Si Cline/Antigravity está abierto, reinícialo para que lea el nuevo token.
```

---

## ⚙️ Automatización con Task Scheduler (Windows)

Para que el script corra automáticamente cada 5 horas:

### Opción 1: Script automático (recomendada)

1. Abre una terminal **como Administrador**.
2. Ejecuta:

```batch
cd "C:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mcp-token-refresh"
setup-task-scheduler.bat
```

3. Verifica que la tarea se creó correctamente:
   - Abre `Task Scheduler` (programador de tareas)
   - Ve a `Task Scheduler Library` → `MeliMCPRefresh`

### Opción 2: Configuración manual

1. Abre **Task Scheduler** (`taskschd.msc`).
2. Crea una **Basic Task**:
   - **Name:** `MeliMCPRefresh`
   - **Trigger:** Daily, Repeat every 5 hours
   - **Action:** Start a program
   - **Program:** `C:\Program Files\nodejs\node.exe`
   - **Arguments:** `"C:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mcp-token-refresh\refresh-token.js"`
3. Marca **"Run whether user is logged on or not"**.
4. Guarda.

---

## 🔧 Configuración

Si necesitas cambiar algo, edita estas variables al inicio de `refresh-token.js`:

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `ACCOUNT_NICKNAME` | Cuenta de ML a refrescar (vacío = todas) | `CORPORACIONRWCCA` |
| `CONFIG_PATHS` | Rutas a los archivos de config | Array con 2 rutas |

Las credenciales de Supabase y MercadoLibre se leen de las variables de entorno si existen, o usan los valores por defecto del proyecto.

### Modo: todas las cuentas
Para refrescar **todas** las cuentas vinculadas, deja `ACCOUNT_NICKNAME` vacío o coméntala:
```javascript
const ACCOUNT_NICKNAME = ""; // Vacío = todas las cuentas
```

---

## ⚠️ Solución de problemas

### "No se encontró la cuenta"
- Verifica que `ACCOUNT_NICKNAME` coincida exactamente con el nickname en Supabase.
- Revisa que la tabla `meli_accounts` tenga datos.

### "ML API Error: invalid_grant"
- El `refresh_token` expiró o fue revocado.
- Re-vincula la cuenta en `/auth` de tu app y vuelve a correr el script.

### "Archivo no encontrado"
- Verifica que las rutas en `CONFIG_PATHS` existan.
- En Windows usa barras normales (`/`) o dobles barras invertidas (`\\`).

### Cline sigue usando el token viejo
- **Reinicia Cline/Antigravity** después de correr el script.
- El MCP se carga al iniciar; no detecta cambios en caliente.

---

## 📅 Frecuencia recomendada

| Opción | Frecuencia | Notas |
|--------|-----------|-------|
| Manual | Cuando falle | Útil para pruebas |
| Task Scheduler | Cada 5 horas | Recomendado para producción |
| Al iniciar Windows | Cada login | Buen complemento |

---

## 📝 Cambios en el refresh_token

MercadoLibre **devuelve un nuevo refresh_token** en cada solicitud. El script actualiza automáticamente la base de datos, así que no hay que preocuparse por eso.

Si por alguna razón el refresh_token deja de funcionar, la única solución es re-autorizar la aplicación vía OAuth (`/auth` en tu app).

---

Creado para el proyecto **MERCADOLIBRE ERP 2026**.
