 MEMORIA DEL PROYECTO: MERCADOLIBRE ERP 2026

Este documento es el **Punto de Control (Breakpoint)** maestro. Su objetivo es proporcionar contexto inmediato a cualquier IA o desarrollador que inicie una nueva sesión, asegurando la continuidad de los roles y la arquitectura.

---

## 🎭 ROLES ESTABLECIDOS
*   **DIRECTOR (USER):** Arquitecto de Negocio, Especialista en Mercado Libre y Operaciones de Autopartes (Profit Plus / Integraly). Dicta la visión estratégica y valida la funcionalidad en producción.
*   **ANTIGRAVITY (AI):** Desarrollador Full-Stack Lead. Responsable de la lógica compleja, integración de APIs de Meli, diseño de DB (Supabase) y elegancia de la UI (Next.js).

---

## 🏗️ ARQUITECTURA Y MÓDULOS
El sistema está construido para ser escalable mediante micro-servicios internos (API Routes) en Next.js.

### 1. Núcleo de Autenticación (`src/lib/meli-auth-helper.js`)
*   **Función:** Gestiona el OAuth2 de Mercado Libre, el refresco automático de tokens y la persistencia en Supabase.
*   **Estado:** Estable. Soporta múltiples cuentas de forma aislada.

### 2. Motor de Sincronización (`src/api/account/publications/sync/`)
*   **Función:** Realiza barridos (scroll) en la API de Meli para bajar el catálogo.
*   **Estado:** Optimizado. Se corrigió el bug de "items cerrados" mediante un barrido de 3 pasadas (Active, Paused, Closed). Ahora guarda el `raw_data` (JSON completo) para futuras extracciones.

### 3. Auditoría de Inventario (`src/app/api/inventory/upload/`)
*   **Función:** Cruza un Excel local (Profit Plus) contra la DB de Meli.
*   **Estado:** Funcional. Maneja volúmenes masivos (>41k registros) con paginación de Supabase. Posee sistema de **Caché Snapshot** (archivo local `.audit_cache_${accId}.json`) para persistencia por cuenta.

### 4. Exportador Integraly (`src/app/dashboard/inventory/page.js`)
*   **Función:** Genera un archivo `.xlsx` con la estructura exacta que requiere la plataforma Integraly para mapear SKUs masivamente.

### 5. Notificaciones Push / Webhooks (`src/app/api/webhooks/meli/route.js` + Vercel)
*   **Función:** Recibe eventos de MercadoLibre en tiempo real (items, orders_v2, questions, shipments, payments) y los encola en Supabase (`ml_notifications`).
*   **Estado:** Implementado. Requiere deploy en Vercel y configurar Callback URL en app de ML.

### 6. Vercel Cron Job — Refresh Token (`src/app/api/cron/refresh-token/route.js`)
*   **Función:** Refresca tokens automáticamente cada 2 horas sin depender del PC local.
*   **Estado:** Implementado. Configurado en `vercel.json` con schedule `0 */2 * * *`.

### 7. Módulo de Mapeo de Categorías (`src/lib/meli-categories.js`)
*   **Función:** Estandariza SubLíneas internas (ej: 11-001 AMORTIGUADOR NORMAL) con categorías MLV usando `domain_discovery` y validación de atributos obligatorios.
*   **Estado:** Implementado. Tabla `category_mappings` en Supabase + endpoint `/api/categories/suggest`.

### 8. Resiliencia API (`src/lib/meli.js`)
*   **Función:** `meliGet()` ahora incluye retry con backoff exponencial para HTTP 429 (rate limit).
*   **Estado:** Implementado. 3 reintentos automáticos (1s → 2s → 4s → max 30s).

---

## 🚩 ESTADO ACTUAL Y SIGUIENTES PASOS (TODO)

### ✅ COMPLETADO
- [x] Multi-cuenta funcional con cookies.
- [x] Sincronización de ítems "Cerrados/Finalizados".
- [x] Descarga de Excel formato Integraly.
- [x] Persistencia de la última auditoría en caché.
- [x] Columna `raw_data` en Supabase para historial total.
- [x] Cronómetros de rendimiento en botones.
- [x] **Detector de Faltantes Globales** (Skill #7).
- [x] **Procesador de Notas de Recepción Proactivo** (Skill #8).
- [x] **Mecanismo de Batching (2000 ítems):** Eliminados los "Statement Timeouts".
- [x] **Aislamiento de UI (Tabs):** Previene pausar huérfanos por accidente.
- [x] **Notificaciones Push / Webhooks** (Skill #9): Endpoint en Vercel + tabla `ml_notifications`.
- [x] **Vercel Cron Job — Refresh Token** (Skill #10): Auto-refresh cada 2h + manejo `invalid_grant`.
- [x] **Mapeo de Categorías Internas → ML** (Skill #11): Tabla `category_mappings` + `meli-categories.js`.
- [x] **Resiliencia ante Rate Limits** (Skill #12): Retry con backoff exponencial en `meliGet`.
- [x] **Recuperación ante Token Inválido** (Skill #13): Columnas `needs_reauth` + `reauth_error`.

### 🎯 PRÓXIMOS OBJETIVOS (Prioridad en orden)
1.  **Activar Webhooks en Producción:**
    - Deployar en Vercel.
    - Configurar Callback URL en app de MercadoLibre.
    - Suscribirse a topics: `items`, `orders_v2`, `questions`, `shipments`, `payments`.
    - Probar recepción con `curl` o Postman.
2.  **Mapear Categorías Existentes:**
    - Importar sublíneas de `LINEAS SUBLINEAS.xlsx` a `category_mappings`.
    - Usar script para sugerir categorías ML vía `domain_discovery` masivamente.
    - Validar mapeos manualmente (especialmente las 20 sublíneas más usadas).
3.  **Consumidor de Notificaciones (ERP Local):**
    - Crear polling o Supabase Realtime para leer `ml_notifications` pending.
    - Procesar topic `items` → sincronizar producto modificado.
    - Procesar topic `orders_v2` → crear orden en tabla `orders` + descontar stock.
    - Procesar topic `questions` → insertar en tabla `questions`.
    - Marcar notificaciones como `completed` o `error`.
4.  **Módulo de Ventas y Visitas:** Implementar el tablero de analíticas usando los datos ya sincronizados para medir el rendimiento real por publicación.
5.  **Extractor Universal:** Crear scripts que aprovechen la columna `raw_data` para extraer descripciones o variaciones sin llamar a la API.

---

## 🚦 CHECKPOINT DE IMPLEMENTACIÓN (Sesión 2026-05-03)
**Estado:** Deploy exitoso en Vercel — Skills MCP activos en producción.
**URL de Producción:** https://mercadolibre-erp.vercel.app
**Contexto:** El usuario eligió Vercel como receptor de webhooks (100% uptime) y el ERP local sigue corriendo en Windows. El refresh token corre en Vercel Cron Job cada 24h (plan Hobby).

### Archivos creados/modificados en esta sesión:
| Archivo | Estado |
|---|---|
| `PROJECT_SKILLS.md` | ✅ Actualizado con 5 skills nuevas (9-13) |
| `supabase/schema.sql` | ✅ Agregadas tablas `ml_notifications`, `category_mappings`, columnas `needs_reauth`/`reauth_error` |
| `src/app/api/webhooks/meli/route.js` | ✅ Nuevo. Recibe POST de ML, valida IP, guarda en Supabase, responde 200 |
| `src/app/api/cron/refresh-token/route.js` | ✅ Nuevo. Cron job cada 2h, refresca tokens, maneja `invalid_grant` |
| `src/lib/meli-categories.js` | ✅ Nuevo. Helpers de `domain_discovery`, validación de categorías, mapeo |
| `src/app/api/categories/suggest/route.js` | ✅ Nuevo. API para sugerir categoría ML por SubLínea interna |
| `vercel.json` | ✅ Nuevo. Configuración del cron job |
| `src/lib/meli.js` | ✅ Mejorado. `meliGet()` ahora tiene retry con backoff para HTTP 429 |

### Pendiente técnico inmediato:
- [x] Ejecutar SQL actualizado en Supabase (Dashboard → SQL Editor).
- [x] Agregar variable `CRON_SECRET` en `.env`.
- [x] Hacer `git push` de todos los cambios.
- [x] Deployar a Vercel y obtener URL pública.
- [x] Agregar variables de entorno en Vercel Dashboard.
- [ ] Configurar Callback URL en app de MercadoLibre Developers (pendiente del usuario).
- [ ] Probar webhook enviando notificación de prueba.

### Decisión de arquitectura tomada:
- **Vercel** solo recibe notificaciones y ejecuta cron jobs. Todo el ERP (dashboard, publicación, sincronización) sigue en local.
- **Supabase** es la base de datos compartida entre Vercel y Local.
- **Refresh token** se ejecuta en Vercel Cron cada 2 horas, eliminando dependencia de Windows Task Scheduler.

---

## 📈 ESTRATEGIA DE ESCALABILIDAD Y RESPALDOS
Para asegurar que el proyecto se pueda mudar de máquina o sesión sin pérdidas:

1.  **🚀 RESPALDOS GITHUB:** 
    - **Frecuencia:** Obligatorio después de cada "Tarea Grande" completada o al final de la jornada. 
    - **Regla:** Nunca cerrar sesión sin un `git push`.
2.  **🔒 SEGURIDAD:** 
    - Las API Keys y DB URLs se mantienen en el `.env` local.
    - El repositorio GitHub debe ser **PRIVADO** siempre.
3.  **🔄 CONTINUIDAD IA:** 
    - Si cambias de IA o de conversación, pega este documento (`PROJECT_MEMORY.md`) como primer mensaje para "saltar" la curva de aprendizaje de la nueva entidad.

---

## 🛠️ PROTOCOLO DE MANTENIMIENTO DE MEMORIA
Para asegurar la continuidad eterna del proyecto, se seguirán estas reglas:
1.  **Actualización de Memoria:** Al finalizar cada hito funcional o cambio estructural. Se actualiza el TODO y el timestamp.
2.  **Actualización de Skills:** Cada vez que se domine una nueva capacidad técnica o se optimice radicalmente un proceso existente.
3.  **Respaldo Exitoso:** Nunca cerrar sesión sin un `git push` previo.
4.  **Caché:** Los archivos `.audit_cache_*.json` son temporales y no se versionan, pero son vitales para la persistencia en caliente de la sesión.

---
*Última actualización: 2026-05-03 14:18 (Deploy exitoso en Vercel. Skills 9-13 activas en producción. Webhook verificado y respondiendo OK. Pendiente: configurar ML Developers).*
