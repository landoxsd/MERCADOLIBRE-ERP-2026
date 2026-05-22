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

### Próxima Fase: Optimización & Expansión (Sniper V4)
- [ ] **Background Sync**: Migrar la sincronización masiva a Workers para evitar límites de tiempo en Vercel.
- [ ] **Análisis de Oportunidad**: Detectar productos con muchas visitas pero pocas ventas para sugerir cambios de precio.
- [ ] **IA Content Generator**: Usar el MCP de ML para generar descripciones y títulos que cumplan al 100% con las políticas vigentes.

---
*Última actualización: 2026-05-22 - Ampliación de grilla Sniper y exportación a Excel.*
