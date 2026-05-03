# 🚀 CHECKLIST DE DEPLOY — MERCADOLIBRE ERP (Skills MCP)

Este documento es la guía paso a paso para activar en producción las funcionalidades implementadas en la sesión del 2026-05-03.

---

## ✅ PASO 1: Ejecutar SQL en Supabase

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard) → Tu proyecto
2. Navegar a **SQL Editor** → **New Query**
3. Pegar el contenido completo de `supabase/schema.sql` (la versión actualizada con las nuevas tablas)
4. Ejecutar (`Run`)
5. Verificar que se crearon:
   - Tabla `ml_notifications`
   - Tabla `category_mappings`
   - Columnas `needs_reauth` y `reauth_error` en `meli_accounts`

---

## ✅ PASO 2: Configurar Variables de Entorno

### En tu archivo `.env` local:
```bash
# Ya existentes (verificar que estén correctas)
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
MELI_CLIENT_ID=tu_app_id
MELI_CLIENT_SECRET=tu_secret
MELI_REDIRECT_URI=http://localhost:3000/api/auth/callback

# NUEVA — Para seguridad del Cron Job
CRON_SECRET=un_string_largo_aleatorio_de_32_caracteres_min
```

> **Cómo generar CRON_SECRET:** Abre PowerShell y ejecuta:
> ```powershell
> -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
> ```

---

## ✅ PASO 3: Deployar en Vercel

### Opción A — Vercel CLI:
```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login (primera vez)
vercel login

# Deploy
vercel --prod
```

### Opción B — Vercel Dashboard:
1. Ir a [vercel.com](https://vercel.com) → Importar proyecto
2. Conectar con tu repositorio GitHub
3. Configurar **Environment Variables** en el dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MELI_CLIENT_ID`
   - `MELI_CLIENT_SECRET`
   - `MELI_REDIRECT_URI` (usar la URL de Vercel: `https://tudominio.vercel.app/api/auth/callback`)
   - `CRON_SECRET`
4. Deploy

### Obtener la URL pública:
Al finalizar el deploy, Vercel te dará una URL como:
```
https://mercadolibre-erp-tuusuario.vercel.app
```

---

## ✅ PASO 4: Configurar Webhooks en MercadoLibre Developers

1. Ir a [applications.mercadolibre.com](https://applications.mercadolibre.com)
2. Seleccionar tu aplicación
3. Ir a la pestaña **Notificaciones** (Notifications)
4. En **URL de Retorno de Llamada (Callback URL)**, ingresar:
   ```
   https://tudominio.vercel.app/api/webhooks/meli
   ```
5. Seleccionar los **Tópicos** (Topics):
   - ✅ `items` — Cambios en publicaciones
   - ✅ `orders_v2` — Ventas y órdenes
   - ✅ `questions` — Preguntas de compradores
   - ✅ `shipments` — Envíos
   - ✅ `payments` — Pagos
6. Guardar cambios

### Verificar que funciona:
```bash
curl -X GET https://tudominio.vercel.app/api/webhooks/meli
```
Debe responder:
```json
{ "status": "ok", "service": "mercadolibre-webhook-receiver", "timestamp": "..." }
```

---

## ✅ PASO 5: Verificar Cron Job de Refresh Token

### En Vercel Dashboard:
1. Ir a tu proyecto → **Settings** → **Cron Jobs**
2. Deberías ver:
   - Path: `/api/cron/refresh-token`
   - Schedule: `0 */2 * * *` (cada 2 horas)

### Probar manualmente (desde local con secret):
```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  https://tudominio.vercel.app/api/cron/refresh-token
```

### Verificar logs:
En Vercel Dashboard → **Logs**, filtrar por:
- `[Cron Refresh]` para ver tokens refrescados
- `[meliGet]` para ver reintentos por rate limit
- `[Webhook ML]` para ver notificaciones recibidas

---

## ✅ PASO 6: Probar Mapeo de Categorías

### Desde local o Postman:
```bash
curl -X POST http://localhost:3000/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "lineCode": "11-000",
    "sublineCode": "11-001",
    "sublineName": "AMORTIGUADOR NORMAL",
    "title": "Amortiguador Delantero Toyota Corolla"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "line_code": "11-000",
  "subline_code": "11-001",
  "category_id": "MLA1747",
  "category_name": "Repuestos Autos y Camionetas",
  "is_validated": false,
  "suggestions": [...],
  "required_attributes": [...]
}
```

---

## ✅ PASO 7: Validar Notificaciones Push

### Simular una notificación de prueba (solo desarrollo):
```bash
curl -X POST http://localhost:3000/api/webhooks/meli \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "/items/MLV123456789",
    "user_id": 123456789,
    "topic": "items",
    "application_id": 123456789,
    "attempts": 1,
    "sent": "2026-05-03T10:00:00.000Z",
    "received": "2026-05-03T10:00:00.000Z"
  }'
```

### Verificar en Supabase:
```sql
SELECT * FROM ml_notifications ORDER BY created_at DESC LIMIT 5;
```

Debe aparecer la notificación con `status = 'pending'`.

---

## ✅ PASO 8: Hacer Git Push

```bash
git add -A
git commit -m "feat: skills MCP ML - webhooks, cron refresh, category mapping, rate limit retry"
git push origin main
```

---

## 📋 RESUMEN DE VERIFICACIÓN FINAL

| Funcionalidad | Cómo probar | Estado |
|---|---|---|
| Webhook recibe notificaciones | `curl POST /api/webhooks/meli` → 200 + fila en `ml_notifications` | ⬜ |
| Cron refresh tokens | Esperar 2h o ejecutar manual con CRON_SECRET | ⬜ |
| Retry rate limit (429) | Sincronizar 18k+ items y ver logs de `[meliGet]` | ⬜ |
| Mapeo de categorías | `curl POST /api/categories/suggest` con sublínea | ⬜ |
| Invalid grant handler | Revocar permisos de una cuenta y ver `needs_reauth` | ⬜ |

---

*Este checklist debe completarse en orden. Si algún paso falla, no avanzar al siguiente.*
