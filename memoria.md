# 🧠 MEMORIA DE PROYECTO — MercadoLibre ERP Venezuela 2026

> **Fuente de verdad viva del repositorio.**
> Cualquier agente de IA (Cursor o Antigravity) debe consultar este documento **antes de iniciar** y actualizarlo al **finalizar cada bloque de trabajo**.
> No confíes en la memoria del chat: lo que no está en el código o en este documento, no existe.

---

## 🏗️ 1. Identidad y Arquitectura del Proyecto

- **Nombre:** MercadoLibre ERP Venezuela 2026
- **Dominio de Negocio:** Autopartes y Repuestos automotrices (18,000 – 43,000 SKUs de Profit Plus Administrativo).
- **Marketplace:** Mercado Libre Venezuela (`MLV`), moneda oficial de publicación `USD`.
- **Producción actual:** Dell PowerEdge R630 — Coolify CT 101 en `http://192.168.1.58:3001` (UI Coolify `:8000`).
- **Stack Tecnológico:**
  - **Frontend:** Next.js 14 (App Router, CSS modules / CSS puro, Lucide Icons, SheetJS / xlsx).
  - **Backend:** Next.js Route Handlers (`src/app/api/...`), Server-Sent Events (SSE).
  - **Base de Datos App:** PostgreSQL local R630 (`192.168.1.58:5432`) — tablas `products`, `orphan_proposals`, cuentas OAuth, etc. (cliente admin + `pgPool` en `src/lib/supabase-admin.js`).
  - **ERP origen:** Profit Plus SQL Server `192.168.1.10:1433` / `RWC20_A` — **solo lectura**.
  - **Fotos:** red `\\192.168.1.10\e\FOTOS` → en contenedor debe montarse `/mnt/fotos` (pendiente infra).
  - **IA:** Google Gemini 3.6 Flash (`src/lib/gemini.js`) con pool round-robin de 4 API Keys (60 RPM).
  - **Scraping (Opcional):** Microservicio Python FastAPI en `scrapling-service` (Scrapling + Camoufox).

---

## 📦 2. Estado de Módulos y Qué Está Hecho

### ✅ Core & Publicación Masiva
1. **Publicador Masivo Directo por API (Sprint 8):**
   - **Archivo Endpoint:** [`src/app/api/account/publications/publish-batch/route.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/app/api/account/publications/publish-batch/route.js)
   - **Componente UI:** [`src/components/inventory/MassPublisherModal.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/components/inventory/MassPublisherModal.js)
   - **Motor de Calidad Pre-Flight:** [`src/lib/publication-quality-engine.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/lib/publication-quality-engine.js) (validación de títulos, fotos, compatibilidad y atributos antes de publicar).
   - **Catálogo y Fitment Vehicular:** [`src/lib/vehicle-catalog.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/lib/vehicle-catalog.js) y [`supabase/migration_vehicle_catalog_2026.sql`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/supabase/migration_vehicle_catalog_2026.sql).
   - **Preview e Inspección de Lotes:** [`src/app/api/account/publications/publish-preview/route.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/app/api/account/publications/publish-preview/route.js) y [`improve-batch/route.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/app/api/account/publications/improve-batch/route.js).
   - **Script CLI Consola:** [`ML_Desktop_Publisher/publicar_api_directo.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/ML_Desktop_Publisher/publicar_api_directo.js) y [`PUBLICAR_DIRECTO_API.bat`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/ML_Desktop_Publisher/PUBLICAR_DIRECTO_API.bat).
   - **Funcionalidad:** Escanea carpeta local de fotos en disco (`{SKU}.jpg`), sube imágenes por `multipart/form-data` a ML, inyecta `official_store_id`, atributos técnicos obligatorios, enriquece con Gemini IA y sincroniza en Supabase vía SSE streaming.
2. **Pool de IA Gemini Multi-Key:**
   - **Archivo:** [`src/lib/gemini.js`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/src/lib/gemini.js)
   - Rota automáticamente entre `GEMINI_API_KEY`, `_2`, `_3`, `_4` ante errores 429 para garantizar 60 peticiones/minuto gratuitas.
3. **Mapeo de Categorías de Autopartes MLV:**
   - **Archivo Local:** [`sublineas_categorizadas_mercadolibre.xlsx`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/sublineas_categorizadas_mercadolibre.xlsx) y [`.erp_settings.json`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/.erp_settings.json)
   - **Árbol de Categorías Oficial:** [`autoparts_leaf_categories.json`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/autoparts_leaf_categories.json) (2,211 categorías hoja de repuestos descargadas de MLV).
   - **Base de Datos:** 569 sublíneas de Profit Plus categorizadas y sincronizadas en la tabla `category_mappings` de Supabase.
4. **Catálogo de Marcas:**
   - **Archivo:** [`listado_marcas_profit.xlsx`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/listado_marcas_profit.xlsx) con 514 marcas analizadas a partir de 43,195 artículos.
5. **Catálogo de Pesos para Mercado Envíos (Tolerancia ±300g):**
   - **Archivo:** [`catalogo_pesos_mercadoenvios_300g.xlsx`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/catalogo_pesos_mercadoenvios_300g.xlsx)
   - 13,629 SKUs con peso real medido de balanza en Profit Plus.
   - 29,566 SKUs con peso estimado por sublínea.
   - **REGLA DE AUDITORÍA VISUAL (.09):** Todos los pesos estimados (no reales) **terminan obligatoriamente en `.09` o `.X9`** (ejemplo: si el cálculo da `0.30 kg`, se fija en `0.29 kg`; si da `1.00 kg`, se fija en `0.99 kg`). Los pesos reales mantienen sus decimales exactos. Esto permite identificar al instante en Mercado Libre o en reportes qué productos aún no han pasado por balanza física.

### ✅ Inteligencia Competitiva
- **Seller Spy:** `/dashboard/spy` (Auditoría de inventario de competidores usando API oficial `GET /sites/MLV/search?seller_id={id}`).
- **Radar de Categorías:** `/dashboard/radar` (Análisis de nichos y métricas de facturación).
- **Top 20 Ganadores:** `/dashboard/radar/[category_id]` (Productos líderes por ventas).
- **Keywords Inverso:** `/dashboard/keywords` (Extracción de términos de búsqueda de competidores).
- **Listing Sniper V3:** `/dashboard/intelligence` y `src/lib/sniper-scoring.js`.

---

## 🛠️ 3. Módulos Core Reutilizables (NO REINVENTAR)

| Módulo / Función | Archivo | Responsabilidad |
|---|---|---|
| `meliGet()` | `src/lib/meli.js` | Consultas GET a ML con retry y backoff exponencial para evitar bloqueos. |
| `getValidAccessToken()` | `src/lib/meli-auth-helper.js` | Obtención y auto-refresh de tokens OAuth2 de ML desde Supabase. |
| `supabaseAdmin` | `src/lib/supabase-admin.js` | Cliente Supabase con Service Role para operaciones backend. |
| `generateWithGemini()` | `src/lib/gemini.js` | Llamadas a Gemini 3.6 Flash con rotación automática entre 4 API keys. |
| `enrichAutopartListing()`| `src/lib/gemini.js` | Generación de fichas técnicas, títulos SEO y compatibilidad vehicular. |

---

## 🧪 4. Cómo Probar el Proyecto

### 1. Iniciar el Servidor de Desarrollo
```bash
npm run dev
# Abrir: http://localhost:3000
```

### 2. Probar el Publicador Masivo desde la Web
1. Ir a `http://localhost:3000/dashboard/inventory`.
2. Cargar un archivo Excel de Profit Plus (ej. `AMORTIGUADORES07052026.xlsx`).
3. En la sección "Faltantes", pulsar **"🚀 Publicar Todo vía API"** o **"🚀 Publicar Sublínea vía API"**.
4. Confirmar la ruta de fotos en disco y pulsar "Iniciar Publicación Masiva".

### 3. Probar el Publicador Masivo desde Terminal (Desktop)
1. Colocar un archivo de prueba en `ML_Desktop_Publisher/Input_Profit/`.
2. Ejecutar:
   ```cmd
   ML_Desktop_Publisher\PUBLICAR_DIRECTO_API.bat
   ```
3. Revisar el reporte generado en `ML_Desktop_Publisher/Output/`.

### 4. Probar la Conexión con Gemini AI
```bash
node -e "const { generateWithGemini } = require('./src/lib/gemini.js'); generateWithGemini('Responde OK').then(console.log);"
```

---

## 📋 5. Pendientes y Roadmap Futuro
- [ ] **INFRA URGENTE:** Montar share CIFS de fotos `\\192.168.1.10\e\FOTOS` en Dell R630 como `/mnt/fotos` (cifs-utils, solo lectura) y bind-mount en Coolify app `mercadolibre-erp-2026` → contenedor `/mnt/fotos`. El código ya lee `/mnt/fotos` (`missing-service.js`, `api/profit/photos`).
- [ ] Conectar el catálogo de pesos (`catalogo_pesos_mercadoenvios_300g.xlsx`) directamente al payload de creación/actualización de publicaciones (`shipping.dimensions` / `attributes.PACKAGE_WEIGHT`).
- [ ] Auditoría de publicaciones activas con peso en 0 en Mercado Libre para actualizarles el peso vía API antes de generar envíos.
- [ ] Panel web para editar y crear nuevas reglas de mapeo de sublíneas visualmente.

---

## 🤝 6. Contrato de Handoff (Sesión Actual)

### Sesión 2026-10-16 (Consolidación Ingeniería Inversa REA: Mercatech + Integraly `v2.2.0.6` → Cursor & Antigravity)
Se completó la ingeniería inversa forense mediante el servidor MCP de **REA (`morluto/rea`)** de las dos plataformas externas que operaban en Corporación R.W.C. y se inyectó todo el conocimiento en reglas de Cursor (`.cursor/rules/*.mdc`) y Skills (`.agents/skills/` y `.clineskills/`):

1. **Mercatech Sync (`c:\DEVELOPER\INGENIERIA INVERSA\mercatech\REPORTE_INGENIERIA_INVERSA_MERCATECH.md`):**
   - **Fórmula exacta de stock vendible en `RWC20_A`:** `SUM(stock_act) - SUM(stock_com)` en `st_almac WITH (NOLOCK)` filtrando exclusivamente `co_alma IN ('01.01', '01.02', '01.03')` y `art.tipo = 'V'`.
   - **Trazabilidad de pedidos ML en Profit Plus (`READ-ONLY`):** Órdenes registradas bajo `co_cli = 'ML-999'`, donde `rif = idml` (ID orden ML), `campo3 = ordercode`, `campo6 = nickname` y `campo8 = tasa_cambio`.
   - **Combos / Cajas (`syncBoxProduct` + JWT `Combo`):** Stock calculado como `MIN(FLOOR(stock_disponible_hijo / qty_requerida))`.
2. **Integraly Excel Add-In `v2.2.0.5` y `v2.2.0.6` (`c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY\REPORTE_INGENIERIA_INVERSA_v2_2_0_6.md`):**
   - **Stock en User Products (UP) & Multi-Warehouse:** Lectura de `GET /user-products/{id}/stock`, captura del header `x-version` y actualización vía `PUT /user-products/{id}/stock/type/seller_warehouse` con fallback automático a `PUT /items/{id}`.
   - **Compatibilidades Vehiculares Offline + IA:** Diccionario comprimido `c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY\2.2.0.6\compatibilidades.json.gz` (2.59 MB) + matching por Similitud de Coseno hacia `/items/{id}/compatibilities`.
   - **Pre-procesamiento de Fotos (`CropWhiteSpace` + `EnlargeImage`):** Recorte automático de márgenes blancos (`sharp.trim()`) y escalado al 92%–95% del lienzo de `1500x1500` px antes de subir a ML.
   - **Novedades `v2.2.0.6`:**
     - `FormListadoVentas`: Auditoría financiera neta (`Bruto - sale_fee - shipping_cost - taxes = Neto a Recibir`) + cruce con publicidad (`PADS`).
     - `discount_meli_boost_amount`: Descuentos co-financiados por Mercado Libre en `/seller-promotions`.
     - `PxQ B2B %`: Precios Mayoristas por Cantidad con validación de hasta 5 tramos monótonos crecientes (**obligatorio antes del 27/10/2026**).
3. **Reglas de Cursor Creadas/Actualizadas (`.cursor/rules/`):**
   - `.cursor/rules/main.mdc` (Reglas maestras `alwaysApply: true` + prohibición estricta de tocar programas de Mercatech en producción)
   - `.cursor/rules/profit-mercatech.mdc` (Reglas SQL `RWC20_A` `READ-ONLY` + almacenes `01.01..01.03` + `ML-999`)
   - `.cursor/rules/meli-integraly-advanced.mdc` (User Products `x-version`, `PxQ B2B %`, Boost, `CropWhiteSpace`, `compatibilidades.json.gz`)
4. **Mejoras Aplicadas en Código (`MERCADOLIBRE 18042026 - copia`):**
   - **Conexión en vivo a `\\192.168.1.10\e\FOTOS` (39,123 fotos):** Actualizados `missing-service.js`, `api/profit/photos/route.js`, `publish-helpers.js` (`resolveEffectivePhotosDir`), `.erp_settings.json`, `MassPublisherModal.js`, `missing/page.js` e `inventory/page.js` para priorizar `\\192.168.1.10\e\FOTOS` (y `/mnt/fotos` en R630) sobre `C:\Users\ORLANDO\Pictures\FOTOS`.
   - **Fórmula de Stock Oficial Mercatech en `missing-service.js` y `orphan-service.js`:** Ahora filtra `co_alma IN ('01.01', '01.02', '01.03')`, `a.tipo = 'V'` y calcula `SUM(stock_act - stock_com)` en modo `READ-ONLY` (`WITH (NOLOCK)`).
   - **Auto-Recorte de Bordes Blancos (`CropWhiteSpace` + `EnlargeImage`) en `publish-helpers.js`:** Incorporado `optimizeAutopartPhotoBuffer(rawBuffer)` con `sharp.trim()` + escalado a `1380x1380` sobre lienzo `1500x1500` blanco puro antes de subir fotos a `POST /pictures/items/upload`.

---

### Sesión 2026-10-07 (Handoff Antigravity → Cursor) — HEAD `769831f`
- **Producción:** Dell PowerEdge R630 — app Coolify CT 101 en `192.168.1.58:3001` · Coolify UI `http://192.168.1.58:8000`.
- **PostgreSQL local R630:** `192.168.1.58:5432/postgres` (fuente de `products`, `orphan_proposals`, cuentas OAuth).
- **Profit Plus:** SQL Server `192.168.1.10:1433` / DB `RWC20_A` — **SOLO LECTURA** (`WITH (NOLOCK)`). Nunca escribir.

#### ✅ Resuelto en código (no rehacer)
1. **`VEHICLE_TYPE` MLV:** valor fijo `{ value_id: "11377043", value_name: "Carro/Camioneta" }` en `src/lib/publish-helpers.js` (`inferDefaultAttributeValue` / `buildDynamicAttributes`). Antes fallaba con `"Auto/Camioneta"`.
2. **Tienda Oficial World Cars:** `getOfficialStoreId()` en `src/lib/meli.js` consulta `/users/{user_id}/brands`; fallback `official_store_id = 71674`.
3. **MassPublisherModal CSS puro:** `src/components/inventory/MassPublisherModal.css` (el proyecto no usa Tailwind en este modal).
4. **Fotos naming:** `{SKU}-0.jpg` … `{SKU}-n.jpg`. Sin match exacto/equivalencias → placeholder Tienda Oficial (caso SKU `8043` documentado: existen `38043-*` / `ES-80431-*` pero no `8043-0.jpg`).
5. **Módulo Huérfanos/Descontinuados (aprobación humana obligatoria):**
   - Motor: `src/modules/profit/orphan-service.js` (bidireccional Profit ↔ ML).
   - APIs: `GET /api/profit/orphans`, `POST .../approve`, `POST .../reject`.
   - UI: `/dashboard/orphans` + link en Sidebar y cabecera de `/dashboard/missing`.
   - Tabla PG: `orphan_proposals`. Aprobar actualiza `SELLER_SKU`, precio, stock y reactiva en ML.
6. **Módulo Faltantes por sublínea:** `/dashboard/missing` + `src/modules/profit/missing-service.js` (lotes, equivalencias/OEM, fotos, export SEO/RWC 2 hojas).

#### 🔜 Siguiente acción recomendada
1. En R630: instalar `cifs-utils`, montar `//192.168.1.10/e/FOTOS` → `/mnt/fotos` (**credenciales fuera del repo**; no commitear password).
2. Coolify → Storages → Bind Mount Host `/mnt/fotos` → Contenedor `/mnt/fotos`.
3. Probar publicación/faltantes leyendo fotos reales desde el contenedor.

#### ⚠️ Archivos calientes (un escritor a la vez)
`publish-helpers.js`, `meli.js`, `MassPublisherModal.*`, `orphan-service.js`, `missing-service.js`, páginas `orphans` / `missing`.

### Archivo — Sesión 2026-09-29 (R630 / Coolify)
- Despliegue Docker/Coolify ya operativo en `192.168.1.58`. Preparativos históricos: `Dockerfile`, `next.config.mjs` standalone, `deploy/coolify/`, `scripts/setup-coolify-r630.md`.

