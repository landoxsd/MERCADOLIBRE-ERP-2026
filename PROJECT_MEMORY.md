lta MEMORIA DEL PROYECTO: MERCADOLIBRE ERP 2026

Este documento es el **Punto de Control (Breakpoint)** maestro. Su objetivo es proporcionar contexto inmediato a cualquier IA o desarrollador que inicie una nueva sesión, asegurando la continuidad de los roles y la arquitectura.

---

## 🎭 ROLES ESTABLECIDOS
*   **DIRECTOR (USER):** Arquitecto de Negocio, Especialista en Mercado Libre y Operaciones de Autopartes (Profit Plus / Integraly). Dicta la visión estratégica y valida la funcionalidad en producción.
*   **ANTIGRAVITY (AI):** Desarrollador Full-Stack Lead. Responsable de la lógica compleja, integración de APIs de Meli, diseño de DB (Supabase) y elegancia de la UI (Next.js).

---

## 🚀 ONBOARDING PARA NUEVA SESIÓN DE IA

Cuando inicies una nueva conversación con una IA (Cline, Claude, ChatGPT, etc.), **siempre pega este documento (`PROJECT_MEMORY.md`) como el PRIMER mensaje**. Eso le da contexto completo del proyecto sin perder tiempo.

### Si la tarea es técnica compleja, también pega `PROJECT_SKILLS.md` junto con este archivo.

### Datos clave del proyecto (mencionar si la IA lo pide):
| Dato | Valor |
|---|---|
| **URL Producción** | https://mercadolibre-erp.vercel.app |
| **Client ID ML** | 2657663366318591 |
| **Site ID** | MLV (Venezuela) |
| **Stack** | Next.js 14 + Supabase + Vercel |
| **Supabase Project** | zqxesjcchykncxpekmbz |
| **Repo GitHub** | https://github.com/landoxsd/MERCADOLIBRE-ERP-2026.git |

### ⚠️ NUNCA compartir:
- `.env` completo (tiene secrets)
- `cline_mcp_settings.json` (tiene token Bearer activo)
- `SUPABASE_SERVICE_ROLE_KEY`

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

### 5. Notificaciones Push / Webhooks (`src/app/api/webhooks/ml/route.js` + Vercel)
*   **Función:** Recibe eventos de MercadoLibre en tiempo real (items, orders_v2, questions, shipments, payments), los encola en Supabase (`ml_notifications`) y los **procesa automáticamente** actualizando `products`, `orders`, `order_items` y `questions`.
*   **Estado:** Implementado con procesador automático (v2.0). Requiere configurar Callback URL en app de ML.
*   **Callback URL:** `https://mercadolibre-erp.vercel.app/api/webhooks/ml`
*   **Nota:** MercadoLibre NO permite suscribir webhooks por API. Se configura manualmente en `applications.mercadolibre.com`.

### 6. Vercel Cron Job — Refresh Token (`src/app/api/cron/refresh-token/route.js`)
*   **Función:** Refresca tokens automáticamente cada 2 horas sin depender del PC local.
*   **Estado:** Implementado. Configurado en `vercel.json` con schedule `0 */2 * * *`.

### 7. Módulo de Mapeo de Categorías (`src/lib/meli-categories.js`)
*   **Función:** Estandariza SubLíneas internas (ej: 11-001 AMORTIGUADOR NORMAL) con categorías MLV usando `domain_discovery` y validación de atributos obligatorios.
*   **Estado:** Implementado. Tabla `category_mappings` en Supabase + endpoint `/api/categories/suggest`.

### 8. Resiliencia API (`src/lib/meli.js`)
*   **Función:** `meliGet()` ahora incluye retry con backoff exponencial para HTTP 429 (rate limit).
*   **Estado:** Implementado. 3 reintentos automáticos (1s → 2s → 4s → max 30s).

### 9. MCP Server Connector (`mcp-token-refresh/` + `cline_mcp_settings.json`)
*   **Función:** Mantiene el servidor MCP de MercadoLibre conectado a Cline/Antigravity para consultar documentación oficial y herramientas de ML directamente desde el chat.
*   **Estado:** Activo. Token auto-refrescable mediante `refresh-token.js` y script `actualizar-token-mcp.bat`.

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
- [x] **MCP Server Connector** (Skill #14): Token refresher + script `.bat` + conexión a Cline/Antigravity.
- [x] **Webhooks Processor con Auto-Sync** (Skill #15): Procesamiento automático de notificaciones ML actualizando DB en tiempo real.
- [x] **Frontend Auto-Refresh de Token** (Skill #16): Endpoints nunca muestran "Token expirado" porque refrescan automáticamente.
- [x] **Batch Token Refresher** (Skill #17): Script que refresca TODAS las cuentas simultáneamente.
- [x] **Task Scheduler Silencioso** (Skill #18): `.bat` sin interacción para ejecutar desatendido desde Windows Task Scheduler.

### 🎯 PRÓXIMOS OBJETIVOS (Prioridad en orden)
1.  **Verificar Webhooks en Producción:**
    - Confirmar que MercadoLibre envía notificaciones a `https://mercadolibre-erp.vercel.app/api/webhooks/ml`.
    - Verificar en dashboard que lleguen notificaciones y se marquen como `completed`.
    - Ejecutar SQL `ALTER TABLE ml_notifications DISABLE ROW LEVEL SECURITY;` en Supabase para que el frontend pueda leer las notificaciones.
2.  **Mapear Categorías Existentes:**
    - Importar sublíneas de `LINEAS SUBLINEAS.xlsx` a `category_mappings`.
    - Usar script para sugerir categorías ML vía `domain_discovery` masivamente.
    - Validar mapeos manualmente (especialmente las 20 sublíneas más usadas).
3.  **Módulo de Ventas y Visitas:** Implementar el tablero de analíticas usando los datos ya sincronizados para medir el rendimiento real por publicación.
4.  **Extractor Universal:** Crear scripts que aprovechen la columna `raw_data` para extraer descripciones o variaciones sin llamar a la API.

---

## 🚦 CHECKPOINT DE IMPLEMENTACIÓN (Sesión 2026-05-03)
**Estado:** MCP conectado. Webhooks con procesador automático deployado en Vercel.
**URL de Producción:** https://mercadolibre-erp.vercel.app
**Contexto:** El usuario eligió Vercel como receptor de webhooks (100% uptime) y el ERP local sigue corriendo en Windows. El refresh token corre en Vercel Cron Job cada 24h (plan Hobby). La Callback URL de webhooks configurada en ML Developers es `/api/webhooks/ml`.

### Archivos creados/modificados en esta sesión:
| Archivo | Estado |
|---|---|
| `PROJECT_SKILLS.md` | ✅ Actualizado con Skills 14-18 |
| `PROJECT_MEMORY.md` | ✅ Actualizado con nuevos módulos y checkpoint |
| `actualizar-token-mcp.bat` | ✅ Nuevo. Script de doble clic para refrescar token MCP |
| `mcp-token-refresh/refresh-token.js` | ✅ Reescrito. Refresca TODAS las cuentas |
| `mcp-token-refresh/run-refresh-token.bat` | ✅ Nuevo. Sin interacción para Task Scheduler |
| `mcp-token-refresh/README.md` | ✅ Actualizado. Documenta modo todas las cuentas |
| `src/app/api/webhooks/ml/route.js` | ✅ Reescrito. Receptor + Procesador automático v2.0 |
| `src/app/api/webhooks/meli/route.js` | ✅ Duplicado con procesador (respaldo) |
| `src/app/api/webhooks/subscribe/route.js` | ✅ Reescrito. Instrucciones de config manual |
| `src/app/api/webhooks/test/route.js` | ✅ Nuevo. Endpoint de prueba sin validación de IP |
| `src/app/dashboard/webhooks/page.js` | ✅ Reescrito. Panel con instrucciones de setup |
| `src/app/api/orders/route.js` | ✅ Corregido. Auto-refresh de token integrado |
| `src/app/api/account/overview/route.js` | ✅ Corregido. Auto-refresh de token integrado |
| `src/lib/supabase-admin.js` | ✅ Corregido. Usa `SUPABASE_SERVICE_ROLE_KEY` |
| `supabase/fix_ml_notifications_rls.sql` | ✅ Nuevo. SQL para desactivar RLS en notificaciones |
| `cline_mcp_settings.json` | ✅ Token actualizado automáticamente |

### Pendiente técnico inmediato:
- [x] Ejecutar SQL actualizado en Supabase (Dashboard → SQL Editor).
- [x] Agregar variable `CRON_SECRET` en `.env`.
- [x] Hacer `git push` de todos los cambios.
- [x] Deployar a Vercel y obtener URL pública.
- [x] Agregar variables de entorno en Vercel Dashboard.
- [x] Configurar Callback URL en app de MercadoLibre Developers (`/api/webhooks/ml`).
- [ ] Ejecutar SQL `ALTER TABLE ml_notifications DISABLE ROW LEVEL SECURITY;` en Supabase para mostrar notificaciones en el dashboard.
- [ ] Verificar que lleguen notificaciones y se procesen correctamente.

### Decisión de arquitectura tomada:
- **Vercel** solo recibe notificaciones y ejecuta cron jobs. Todo el ERP (dashboard, publicación, sincronización) sigue en local.
- **Supabase** es la base de datos compartida entre Vercel y Local.
- **Refresh token** se ejecuta en Vercel Cron cada 2 horas, eliminando dependencia de Windows Task Scheduler.
- **MCP** mantiene acceso a documentación oficial de ML para consultas rápidas del desarrollador.

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

## 🛠️ PROTOCOLO DE MANTENIMIENTO DE MEMORIA Y SKILLS
Para asegurar la continuidad eterna del proyecto, se seguirán estas reglas:
1.  **Actualización de Memoria:** Al finalizar cada hito funcional o cambio estructural. Se actualiza el TODO, el timestamp y el checkpoint.
2.  **Actualización de Skills:** **CADA VEZ que se domine una nueva capacidad técnica o se optimice radicalmente un proceso existente, se debe:**
    - Agregar la nueva Skill numerada al final de `PROJECT_SKILLS.md`.
    - Actualizar `PROJECT_MEMORY.md` en la sección de módulos correspondiente.
    - Marcar la skill como completada en el checklist de este documento.
    - Actualizar el checkpoint de implementación con los archivos modificados.
3.  **Respaldo Exitoso:** Nunca cerrar sesión sin un `git push` previo.
4.  **Caché:** Los archivos `.audit_cache_*.json` son temporales y no se versionan, pero son vitales para la persistencia en caliente de la sesión.

---

## 📋 REGLAS DE INTEGRACIÓN CON MERCADOLIBRE
### ⚠️ REGLA CRÍTICA: Consultar MCP antes de asumir
> **Cuando exista CUALQUIER DUDA sobre cómo funciona una API, endpoint, o comportamiento de MercadoLibre, SIEMPRE consultar primero el MCP Server de MercadoLibre conectado (`mercadolibre-mcp-server`) antes de asumir o implementar.**

**Ejemplos de cuándo consultar el MCP:**
- ¿Requiere autenticación un endpoint específico? (ej: `/items/{id}` SÍ requiere token, NO es público).
- ¿Cuál es el formato correcto de un ID de item? (ej: `MLV12345678` sin guión para la API, aunque en URLs aparezca como `MLV-12345678`).
- ¿Qué parámetros acepta un endpoint de búsqueda?
- ¿Cómo manejar errores específicos de ML (401, 403, 404, 429)?

**NO asumir que un endpoint es público o no requiere token sin confirmar en la documentación oficial via MCP.**

## 🚦 CHECKPOINT DE IMPLEMENTACIÓN (Sesión 2026-05-04)
**Estado:** Mapeo de categorías completamente refactorizado. Error 403 corregido. Nuevo modal de búsqueda con breadcrumb deployado.
**URL de Producción:** https://mercadolibre-erp.vercel.app
**Contexto:** Se corrigió el endpoint `extract-category` para usar token con auto-refresh (la API `/items/{id}` de ML requiere autenticación según documentación oficial). Se agregaron 3 nuevos endpoints para mapeo de categorías y un modal de búsqueda con breadcrumb en el frontend.

### Archivos creados/modificados en esta sesión:
| Archivo | Estado |
|---|---|
| `src/app/api/utils/extract-category/route.js` | ✅ Reescrito. Usa `getValidAccessToken()` con auto-refresh. Regex corregido para IDs de cualquier país de ML. |
| `src/app/api/categories/batch-detect/route.js` | ✅ Nuevo. Detecta categorías de múltiples sublíneas en paralelo (lotes de 10). |
| `src/app/api/categories/detect-one/route.js` | ✅ Nuevo. Detecta categoría para UNA sublínea por su nombre. |
| `src/app/api/categories/search-with-breadcrumb/route.js` | ✅ Nuevo. Busca categorías por término y devuelve breadcrumb completo (ruta de categorías). |
| `src/app/dashboard/settings/page.js` | ✅ Reescrito. UI con 4 métodos de detección: 🔎 Buscar breadcrumb, 🎯 Auto-detectar, 🔍 Link exacto, 🤖 Detectar todas. |
| `scripts/download-mlv-categories.js` | ✅ Nuevo. Script para descargar jerarquía completa de categorías MLV (requiere token). |
| `PROJECT_MEMORY.md` | ✅ Actualizado. Nueva regla crítica: consultar MCP antes de asumir comportamiento de ML. |

### Pendiente técnico inmediato:
- [ ] Ejecutar SQL `ALTER TABLE ml_notifications DISABLE ROW LEVEL SECURITY;` en Supabase para mostrar notificaciones en el dashboard.
- [ ] Verificar que lleguen notificaciones y se procesen correctamente.
- [ ] Probar los 4 métodos de mapeo de categorías en producción y confirmar que funcionan correctamente.

---

## 🚦 CHECKPOINT DE IMPLEMENTACIÓN (Sesión 2026-05-04 05:00)
**Estado:** Exportador masivo ML completamente implementado y deployado. Build exitoso. Push a GitHub realizado.
**URL de Producción:** https://mercadolibre-erp.vercel.app
**Contexto:** Se implementó un sistema completo para generar archivos Excel compatibles con la plataforma de publicación masiva de MercadoLibre Venezuela (https://www.mercadolibre.com.ve/publicar-masivamente/), diseñado específicamente para la cuenta CORPORACIONRWC que tiene limitaciones de API por tienda oficial.

### Archivos creados/modificados en esta sesión:
| Archivo | Estado |
|---|---|
| `src/app/api/inventory/export-massive-excel/route.js` | ✅ Nuevo. API que genera Excel ML con pestañas por categoría, headers dinámicos, fotos múltiples, títulos SEO 60 chars. |
| `src/app/dashboard/inventory/page.js` | ✅ Modificado. Nuevo panel de exportación masiva con filtros (stock, fotos, límite) y botón de descarga. |
| `src/app/api/inventory/upload/route.js` | ✅ Modificado. Detección dinámica de columna SubLínea desde Excel de Profit Plus. |
| `supabase/schema.sql` | ✅ Actualizado. Tablas `image_bank` y `category_mappings` agregadas. Columna `subcategory` en `internal_inventory`. |
| `PROJECT_SKILLS.md` | ✅ Actualizado. Skill #19: Generador de Excel para Publicación Masiva ML. |
| `PLANILLA PUBLICACION MASIVA ML.xlsx` | ✅ Referencia. Ejemplo oficial de ML para comparar estructura. |

### Pendiente técnico inmediato:
- [ ] Ejecutar SQL `supabase/schema.sql` en Supabase si aún no existen las tablas `image_bank` y `category_mappings`.
- [ ] Poblar `category_mappings` con las sublíneas de Profit Plus y sus IDs de categoría ML correspondientes.
- [x] **Hito 3: Banco de Imágenes & Dashboard**  
  - Creación de tabla `image_bank` en Supabase.
  - Script de escaneo y sincronización masiva (v1.1 con Smart Skip).
  - Dashboard visual en `/dashboard/image-bank` (Desplegado en producción).
  - Integración en Sidebar del ERP.

### Decisiones de arquitectura tomadas:
- El Excel se agrupa por **categoría de MercadoLibre** (una pestaña por categoría), no por sublínea interna.
- Los títulos se optimizan a **máximo 60 caracteres** con abreviaciones automáticas (DEL → Delantero, TRAS → Trasero, etc.).
- Las fotos se toman de `image_bank` (URLs de ML), no de fotos locales.
- Los atributos técnicos se obtienen dinámicamente de `/categories/{id}/attributes` de la API de ML.
- Columnas ML manejadas: Tipo de publicación, Cargo por venta, Forma de envío, Costo de envío, Zonas/regiones, Retiro en persona, Tipo de garantía, Tiempo, Unidad, Origen.

## 🚦 CHECKPOINT DE IMPLEMENTACIÓN (Sesión 2026-05-05 - GOLDEN EDITION)

**Estado:** Inteligencia de Mapeo GOLDEN y Conexión MCP restaurada.
**Logros Clave:**
- **Motor de Mapeo GOLDEN**: Extracción masiva de **18,858 mapeos reales** desde el historial de RWC y WorldCars. Se generaron **363 Reglas de Oro** que vinculan sublíneas internas con categorías ML exitosas.
- **Importación Masiva**: 556 mapeos validados cargados a Supabase (`category_mappings`).
- **MCP Fixed**: Conexión con el servidor MCP de Mercado Libre reparada mediante inyección automática de tokens OAuth2.
- **Precisión Total**: Corregido el mapeo de "Amortiguadores" y otras sublíneas críticas (Mapeado a `MLV122587`).

### Archivos Respaldados (Session Backup):
- `scratch/smart_mapping.GOLDEN_BACKUP.py` (Motor híbrido IA+Experiencia)
- `mapeo_categorias_GOLDEN.xlsx` (Tabla de la verdad cargada a DB)
- `scratch/import_golden.BACKUP.py` (Cargador masivo a Supabase)

### Pendiente técnico inmediato:
- [ ] Reiniciar Antigravity/Cline para refrescar la conexión MCP del sistema.
- [ ] Realizar una prueba de publicación masiva usando los nuevos mapeos validados.
- [ ] Iniciar migración de módulos secundarios a TypeScript.

---
*Última actualización: 2026-05-05 15:35 (Mapeo Inteligente GOLDEN - 18k Registros Procesados).*

*   **Hito: Motor de Mapeo GOLDEN y Reparación de Atributos Técnicos** (2026-05-05)
    *   Desplegamos el motor de mapeo híbrido (Histórico + IA) basado en 18,858 registros.
    *   Corregimos el error crítico de "Volumen de la unidad" mediante la inyección inteligente de valores técnicos ("1 L", "1 kg") en tiempo de publicación.
    *   Optimizamos el **Exportador de Excel Masivo**: Añadida columna de Sublínea (Grupo) y links reales de Image Bank.
    *   **Estado**: Producción (Vercel) actualizado y operativo.
