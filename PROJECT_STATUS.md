# PROJECT STATUS

## Misión del Proyecto
Desarrollar un ERP/CRM web en Next.js (escalable a la nube) para la gestión multicuentas de Mercado Libre, incluyendo tracking de órdenes, estadísticas (EPC), y herramientas de automatización de mensajería (WhatsApp) post-venta.

## Fases y Estado Actual

### Fase Inicial - Esqueleto Core
- **Estado:** ✅ Completado
- **Commit:** `425cc38` - feat: Esqueleto Core
- **Tareas completadas:**
  - Schema Prisma (PostgreSQL): Modelos `MeliAccount`, `Order`, `OrderItem`, `Product`, `Question`, `Customer`
  - `src/lib/prisma.js` — Cliente singleton de base de datos
  - `src/lib/meli.js` — Cliente API ML (OAuth, refresh, llamadas autenticadas)
  - `src/app/api/auth/login/route.js` — Inicio de sesión normal + Delegar Login (tipo Integraly)
  - `src/app/api/auth/callback/route.js` — Intercepta el código OAuth, guarda cuenta en BD
  - `src/app/api/auth/accounts/route.js` — Lista de cuentas vinculadas (multicuenta)
  - `src/app/auth/page.js` — Página de login con UI premium
  - `src/app/dashboard/layout.js` — Layout con Sidebar lateral
  - `src/components/Sidebar.js` — Navegación colapsable multicuenta
  - CSS Vanilla Glassmorphism para Auth y Sidebar

### Fase Base de Datos - Migración a Nube
- **Estado:** ✅ Completado
- **Acciones:** 
  - Migración exitosa a **Supabase Cloud**.
  - Cambio de arquitectura: Se utiliza **Supabase JS Client** (via HTTPS) para evitar problemas de conectividad IPv6/IPv4 (bypass del error P1001 de Prisma).
  - Tablas creadas via CLI Management API: `meli_accounts`, `orders`, `order_items`, `products`, `questions`, `customers`.
  - Configuración de `src/lib/supabase-admin.js` como reemplazo de Prisma.

### Fase Dashboard - Métricas y Resumen
- **Estado:** ✅ Completado
- **Commit:** `cb827ec`
- **Tareas completadas:**
  - Endpoint `api/account/overview` con reputación, billing (deuda) y ventas.
  - Componente `AccountOverview` con visualización premium de métricas.

### Fase Inteligencia de Mercado - Listing Sniper (Audit Console)
## Módulos Activos
- **Listing Sniper V3**: Inteligencia competitiva y publicación masiva.
- **PMV-Core (NUEVO)**: Verificador de Pago Móvil autónomo con IA y WhatsApp.
- **Inventory Audit**: Sistema de auditoría de stock contra Profit Plus.
- **Estado:** ✅ Completado
- **Hitos:**
  - **Consola de Auditoría Pro**: Comparación de alta velocidad entre Profit Plus y Mercado Libre (18k+ ítems).
  - **Detección de Huérfanos con Inteligencia**: Extracción de ventas reales, visitas y salud de publicación (Live API).
  - **Acciones Tácticas Masivas**: Implementación de Pausado Masivo (Kill Switch) para limpieza de catálogo.
  - **Visualización Premium**: Dashboard con thumbnails, badges de rendimiento (Ventas 🔥) y stock real.
  - **Dashboard Competitivo (Sniper)**: Grilla de competidores ampliada a Top 25 con extracción de SKU, Marca, reposición dinámica, filtros multi-zona y exportación a Excel.

### 🚛 Logística y Mercado Envíos
- [x] Bypass de autenticación para portal externo (Sesión Dual)
- [x] Extracción automática de teléfonos y receptores
- [ ] Sincronización masiva de pesos desde /vendedor/productos
- [ ] Integración de notificaciones WhatsApp para órdenes incompletas

### Fase Conectividad Avanzada - Ecosistema MCP
- **Estado:** ✅ Completado
- **Acciones:**
  - **Supabase MCP**: Conexión directa del agente a la base de datos para diagnósticos SQL.
  - **Mercado Libre MCP**: Acceso a documentación y programación oficial de ML en tiempo real.
  - **Agent Skills (V2)**: Instalación de guías expertas de Postgres y Supabase para desarrollo seguro.

### 🚀 Fase Inteligencia Avanzada — Radar de Mercado (El Real Trends de Venezuela)
- **Estado:** ✅ Sprints 1-5 Completados — ¡Plan Maestro Radar de Mercado finalizado al 100%! 🎉
- **Objetivo:** Transformar el Listing Sniper en un sistema completo de Inteligencia de Mercado.
- **5 Sprints Planificados:**

| Sprint | Módulo | Estado |
|--------|--------|--------|
| 1 | **Seller Spy** — Rayos X de cuenta completa de competidor (toda la paginación, gráficos, cache, descarga) | ✅ Completado |
| 2 | **Radar de Categorías** — Semáforos de nichos 🔥📈⚖️📉 | ✅ Completado |
| 3 | **Top 20 Ganadores** — Billboard de productos que más dinero mueven por categoría | ✅ Completado |
| 4 | **Keywords Inverso** — Tabla heatmap + mapa de burbujas de conversión real | ✅ Completado |
| 5 | **Big Data Export** — Fusión de múltiples competidores → catálogo maestro | ✅ Completado |

- **Nuevas Tablas BD (Supabase):** `seller_spy_sessions`, `seller_spy_items`, `category_radar_snapshots`, `category_keywords`
- **Plan grabado en:** `FUTURE_IMPROVEMENTS.md` + artefacto `implementation_plan.md`

### Sniper V3 — Mejoras Recientes (2026-05-24 — Sprints 4 & 5 + Bypasses)
- **Estado:** ✅ Completado
- **Hitos:**
  - **Bypass Inteligente 403 (PolicyAgent)**: Implementación de resolución de `seller_id` en cascada mediante API de preguntas (`/questions/search`), Playwright title search list y scraping de perfiles oficiales, evadiendo bloqueos de IP y de scopes API.
  - **Rediseño Premium UI Seller Spy**: Reconstrucción de la landing `/dashboard/spy` con Glassmorphism real, inputs de cristal reactivo (`input-glass`) y tarjetas adaptativas de historial (`glass-card`), logrando una armonía estética al 100%.
  - **S5: Big Data Export**: Motor de combinación masiva deduplicada con inyección de orígenes y exportación dual (JSON y BOM CSV estructurado).
  - **S4: Keywords Inverso**: Dashboard de análisis de palabras clave con mapas de calor y mapa de burbujas dinámico.
  - **Atributos Dinámicos en Excel**: El CSV exportado incluye una columna por cada atributo detectado (Número de pieza, Marca, etc.), pivotado automáticamente.
  - **processSnapshot Robusto**: Ahora usa `detail.*` como fallback si `item.*` viene vacío (modo búsqueda directa por ID).
  - **Extracción de SKU y Marca:** Parseo de atributos PART_NUMBER, SKU, BRAND de la API.
  - **Top 25 y Reposición Dinámica:** Capacidad ampliada de 10 a 25 competidores con reposición automática.
  - **Exportación a Excel Enriquecida:** CSV BOM UTF-8 con atributos pivotados.

---
*Última actualización: 2026-05-24 — Sprint 5 (Big Data Export) completado. El Plan Maestro "Radar de Mercado" ha sido finalizado con éxito (5/5 Sprints).*
