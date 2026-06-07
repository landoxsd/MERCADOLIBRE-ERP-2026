# MASTER BRAIN — MercadoLibre ERP Venezuela 2026
### Documento Maestro Consolidado · Ultima actualizacion: 2026-05-24

> Este documento **reemplaza y consolida** toda la informacion dispersa en:
> PROJECT_MEMORY.md · PROJECT_STATUS.md · PROJECT_SKILLS.md · FUTURE_IMPROVEMENTS.md
>
> **Pega este documento como PRIMER mensaje en cualquier nueva sesion de IA.**
> Si la tarea es tecnica compleja, tambien comparte PROFIT_MASTER_DB.md.

---

## 1. Identidad del Proyecto

| Dato | Valor |
|---|---|
| **Nombre** | MercadoLibre ERP Venezuela 2026 |
| **URL Produccion** | https://mercadolibre-erp.vercel.app |
| **Stack** | Next.js 14 + Supabase + Vercel |
| **Site ML** | MLV (Venezuela) |
| **Negocio** | Autopartes · 18,000-40,000 SKUs |
| **Client ID ML** | 2657663366318591 |
| **Supabase Project** | zqxesjcchykncxpekmbz |
| **Repo GitHub** | https://github.com/landoxsd/MERCADOLIBRE-ERP-2026.git |
| **ERP local** | Profit Plus Administrativo (SQL Server) |
| **Publicacion masiva** | Integraly (importa CSV/Excel por SKU) |

### Roles
- **DIRECTOR (USER):** Arquitecto de negocio, especialista ML y autopartes (Profit Plus / Integraly). Valida en produccion.
- **ANTIGRAVITY (AI):** Desarrollador Full-Stack Lead. APIs ML, DB Supabase, UI Next.js.

### NO compartir nunca
- .env completo
- cline_mcp_settings.json (token Bearer activo)
- SUPABASE_SERVICE_ROLE_KEY

---

## 2. Arquitectura y Modulos Activos

### Core (Estable)

| Modulo | Archivo Principal | Estado |
|---|---|---|
| Auth OAuth2 multi-cuenta | src/lib/meli-auth-helper.js | Estable |
| Cliente ML con retry | src/lib/meli.js / meliGet() | Estable |
| Supabase admin client | src/lib/supabase-admin.js | Estable |
| Sync masiva de items | src/api/account/publications/sync/ | Optimizado |
| Auditoria de inventario | src/app/api/inventory/upload/ | Pro Operativo |
| Exportador Integraly SheetJS | src/app/dashboard/inventory/page.js | Operativo |
| Webhooks ML tiempo real | src/app/api/webhooks/ml/route.js | Activo |
| Cron refresh tokens | src/app/api/cron/refresh-token/route.js | Cada 2h |
| Mapeo categorias internas | src/lib/meli-categories.js | Operativo |
| Scraping Mercado Envios | Playwright + bypass dual auth | Operativo |
| Middleware auth | middleware.js | Estable |

### Modulos de Inteligencia — 5 Sprints COMPLETADOS

| Modulo | Dashboard | API | Estado |
|---|---|---|---|
| Seller Spy | /dashboard/spy | /api/tools/sniper/ | SPRINT 1 |
| Radar de Categorias | /dashboard/radar | /api/tools/radar/ | SPRINT 2 |
| Top 20 Ganadores | /dashboard/radar/[category_id] | /api/tools/radar/top-products | SPRINT 3 |
| Keywords Inverso | /dashboard/keywords | /api/tools/keywords | SPRINT 4 |
| Big Data Export | /dashboard/export | /api/tools/export/combined | SPRINT 5 |
| Listing Sniper V3 | /dashboard/intelligence | src/lib/sniper-scoring.js | OPERATIVO |

### Sprint 6 — OPTIMIZACIÓN ACTIVA (COMPLETADO)

| Modulo | Dashboard | Estado |
|---|---|---|
| Image Hunter | /dashboard/images/hunter | Backend parcial, UI pendiente |
| SEO Optimizer (Quirófano) | /dashboard/optimizer | OPERATIVO (Update Atributos via API) |
| SERP Interconnect | /dashboard/intelligence | OPERATIVO (Ruteo a Spy y Optimizer) |

### Sprint 7 — RADAR DE EVOLUCIÓN (EN PLANIFICACIÓN)

| Modulo | Dashboard | Estado |
|---|---|---|
| Seller Watchlist (Timeseries) | /dashboard/spy | Diseño DB Aprobado |

---

## 3. Inventario de Skills (31 Battle-Tested)

### Core (1-13)
1. Sync Masiva Multi-Status (scroll API) — src/lib/meli.js getAllItemIds()
2. Auditoria Ultra-Velocidad Set O(1) — src/app/api/inventory/upload/route.js
3. Persistencia Snapshots cache JSON local — src/app/api/inventory/last/route.js
4. Inyector Integraly XLS SheetJS client-side — src/app/dashboard/inventory/page.js handleDownloadIntegraly()
5. OAuth2 Robusto + Auto-Refresh — src/lib/meli-auth-helper.js
6. Data Lake Raw JSON columna JSONB — src/app/api/account/publications/sync/batch/route.js
7. Detector de Faltantes Gap Analysis — inventory upload
8. Ciclo de Vida Proactivo Notas de Recepcion — dashboard inventario
9. Webhooks Push en Tiempo Real — src/app/api/webhooks/ml/route.js
10. Vercel Cron Job Auto-Refresh Tokens — src/app/api/cron/refresh-token/route.js
11. Mapeo Categorias Internas->MLV — src/lib/meli-categories.js
12. Resiliencia Rate Limits retry backoff exp — src/lib/meli.js meliGet()
13. Recovery Token Invalido invalid_grant — src/lib/meli-auth-helper.js

### Infraestructura (14-18)
14. MCP Server Connector — mcp-token-refresh/ + actualizar-token-mcp.bat
15. Webhooks Processor Auto-Sync — src/app/api/webhooks/ml/route.js
16. Frontend Auto-Refresh Token — meli-auth-helper.js getValidAccessToken()
17. Batch Token Refresher todas las cuentas — mcp-token-refresh/refresh-token.js
18. Task Scheduler Silencioso .bat — mcp-token-refresh/run-refresh-token.bat

### Publicacion Masiva (19-28)
19. Generador Excel Multi-Sheet para ML
20. Dashboard Banco de Imagenes — /dashboard/image-bank
21. Sync Inteligente Smart Skip
22. Mapeo Hibrido GOLDEN IA + historial 18k pubs
23. Inyeccion Inteligente Atributos Tecnicos
24. Exportacion Masiva con Banco de Imagenes
25. Subida por Lotes Chunked 7MB+ 27k+ filas
26. Motor Auditoria Alto Rendimiento Set O(1)
27. Interoperabilidad Mapeos via Excel
28. Exportacion Masiva Vista Plana y Auditoria

### Inteligencia Competitiva (29-31)
29. Listing Sniper V3 — src/lib/sniper-scoring.js + src/lib/sniper-helpers.js
30. Dashboard Inteligencia Mercado Dark Premium — src/app/dashboard/intelligence/ + src/components/intelligence/
31. Snapshots Mercado Batch Tracking — supabase/migration_sniper_2026-05-06.sql

---

## 4. Sprint 6 En Progreso

### Contexto tecnico heredado (REUTILIZAR siempre)
- meliGet() → USAR SIEMPRE para llamadas ML. Tiene retry + backoff. NO crear fetches propios.
- Playwright evasion Akamai → Patron validado Sprint 5. User-Agent real + --disable-blink-features=AutomationControlled
- Exportador Integraly → SheetJS client-side en handleDownloadIntegraly(). Seguir mismo patron.
- Cache JSON local → Skill 3. Patron para bandeja de aprobacion de imagenes.
- /dashboard/intelligence → Listing Sniper V3 YA EXISTE. Optimizer es EXTENSION con IA + exportacion. NO reescribir.

### Estado de componentes Sprint 6

| Archivo | Estado | Notas |
|---|---|---|
| /api/images/hunt/route.js | Investigación Bloqueada | DuckDuckGo y Yahoo devuelven solo miniaturas baja resolución o bloquean headless. Se evaluará buscar alternativas (API de pago, Google Custom Search o Scraper APIs). |
| /api/images/process/route.js | Funcional | Sharp 1500x1500, fondo blanco, JPEG 95%. OK. |
| /api/images/export-zip/route.js | Creado con bug | TransformStream duplicado. Fix pendiente. |
| /api/images/sandbox/route.js | TODO | Listar y eliminar de /public/hunter-sandbox/ |
| /dashboard/images/hunter/page.js | TODO | UI 3 zonas: busqueda batch, grid, bandeja. |
| /api/tools/optimizer/analyze/route.js | TODO | Nuestra pub + Top 5 ML + LLM = JSON dictamen. |
| /api/tools/optimizer/export/route.js | TODO | XLSX formato Integraly con mejoras aceptadas. |
| /dashboard/optimizer/page.js | TODO | 3 paneles: mis pubs, dictamen IA, competidores. |

### Variable de entorno recomendada
GROQ_API_KEY=gsk_...   ← RECOMENDADA para Listing Optimizer (Motor Llama 3 70B/8B, súper rápido y gratuito).
Alternativa: OPENAI_API_KEY o Google Gemini.

### Fixes Críticos y Limitaciones (Sesión Actual)
- **Bloqueo Anubis (Seller Spy) — RESUELTO**: ML activa un PoW JS Challenge en las URLs de listado web (`listado.mercadolibre.com.ve/_CustId_`), bloqueando Playwright headless. **FIX DEFINITIVO**: Se eliminó Playwright del `seller/route.js` y se reemplazó por `GET /sites/MLV/search?seller_id={id}`, el endpoint oficial de API JSON que NO pasa por la capa web donde vive Anubis. El multiget de enriquecimiento y el guardado en Supabase se mantienen intactos.
- **Supabase Null Data Bug**: Se corrigió el layout.js que crasheaba cuando Supabase devolvía `data: null` (por timeouts o caídas de red), reemplazando `{ data: accounts = [] }` por `const accounts = data || []`.
- **IPv6 Timeout**: Node 18+ prioriza IPv6, lo que a veces causa timeouts (`ENOTFOUND`) conectando a la API de Supabase en Windows locales. Se recomienda revivir el proyecto en Supabase Dashboard o correr Node con `--dns-result-order=ipv4first`.
- **Falso Positivo Facturación ML**: Si una cuenta es suspendida por deuda antigua, la API de facturación del mes actual reporta $0, engañando al ERP. Se parchó `AccountOverview.js` y `meli.js` para leer `profile.status.sell.allow` y `codes: ['debt']`, forzando la alerta roja real.

### Nomenclatura de imagenes PROFIT (CRITICO — NO cambiar)
SKU-0.jpg · SKU-1.jpg · SKU-2.jpg · SKU-3.jpg
Almacenamiento temporal: /public/hunter-sandbox/
Dimensiones: 1500x1500px · Fondo blanco puro · JPEG 95%
Fuentes: Amazon, eBay, Walmart, RockAuto, ML Mexico, ML Brasil, MLV

---

## 5. Roadmap Futuro (Priorizado)

### ALTA — Bajo esfuerzo, alto impacto
- [ ] Panel de Ventas en Vivo — polling 30s desde webhook orders_v2
- [ ] Alerta de Stock Critico — available_qty < umbral configurable
- [ ] Detector Publicacion Pausada por ML — webhook items detecta pausa automatica
- [ ] COMPLETAR Sprint 6 — Image Hunter UI (requiere proxy o Google API) + Listing Optimizer IA

### MEDIA — Esfuerzo moderado, gran valor
- [ ] Tracker de Precio Historico — tabla price_history, grafica de lineas
- [ ] Alertas Preguntas Sin Responder — cron cada 2h, notify si >4h
- [ ] Rastreador Conversion Visitas->Ventas — sold_quantity/visits_count
- [ ] Sugerencia de Precios basada en Competencia

### ESTRATEGICA — Alto impacto
- [ ] Clonador de Publicaciones Entre Cuentas — uploadPicture() ya implementada en meli.js
- [ ] Auto-responder de Preguntas con IA — GPT-4 + POST /questions/{id}/answer
- [ ] Motor de Reglas de Negocio Trigger Engine — UI visual sin codigo

### FUTURA — Infraestructura
- [ ] Sync Bidireccional con Profit Plus — venta ML -> descontar stock SQL Server
- [ ] Migracion a TypeScript
- [ ] Background Sync Workers
- [ ] PMV-Core — Pago Movil autonomo con IA y WhatsApp

---

## 6. Referencia Tecnica

### Variables de Entorno
MELI_CLIENT_ID=2657663366318591
MELI_CLIENT_SECRET=VgPvucR8v97fp8ruCEfb2QOyeeAdvj73
MELI_SITE_ID=MLV
MELI_REDIRECT_URI=https://mercadolibre-erp.vercel.app/api/auth/callback
DATABASE_URL=postgresql://postgres:****@db.zqxesjcchykncxpekmbz.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://zqxesjcchykncxpekmbz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ****
CRON_SECRET=cWk9xB7mNpQr3vL5tYfGhJ8dKuE2zA1W
OPENAI_API_KEY=sk-...  (FALTANTE — agregar para Sprint 6)

### Tablas Supabase (2026-05-24)
meli_accounts · orders · order_items · products · questions · customers (Core)
ml_notifications · category_mappings (Sprint 0)
seller_spy_sessions · seller_spy_items (Sprint 1)
category_radar_snapshots · category_keywords (Sprints 2-4)
mlv_market_snapshots · mlv_competitive_analysis · mlv_position_history · competitor_image_refs (Sniper V3)

### Patrones de Evasion ML
PROBLEMA: ML activa Anubis PoW JS Challenge en URLs de listado web de competidores
SOLUCION DEFINITIVA: Usar endpoint API oficial `GET /sites/MLV/search?seller_id={id}&limit=50&offset=N`.
  → Es JSON puro. Anubis solo existe en la capa HTML/web. No necesita Playwright.
  → Con Authorization Bearer token propio mejora el rate limit.
  → Playwright se reserva SOLO para páginas de detalle individuales si se requiere.

PROBLEMA: Scraping directo Vercel = 403
SOLUCION: Playwright + User-Agent real + --disable-blink-features=AutomationControlled

PROBLEMA: Token expirado en endpoints
SOLUCION: getValidAccessToken() refresca automaticamente con margen 5 min

### Webhook IPs de MercadoLibre (Whitelist)
54.88.218.97 · 18.215.140.160 · 18.213.114.129 · 18.206.34.84

---
Ultima actualizacion: 2026-05-26 · Sprint 5 completado · Sprint 6 en construccion · Anubis RESUELTO via API search endpoint
