# 🧠 MEMORIA DE PROYECTO — MercadoLibre ERP Venezuela 2026

> **Fuente de verdad viva del repositorio.**
> Cualquier agente de IA (Cursor o Antigravity) debe consultar este documento **antes de iniciar** y actualizarlo al **finalizar cada bloque de trabajo**.
> No confíes en la memoria del chat: lo que no está en el código o en este documento, no existe.

---

## 🏗️ 1. Identidad y Arquitectura del Proyecto

- **Nombre:** MercadoLibre ERP Venezuela 2026
- **Dominio de Negocio:** Autopartes y Repuestos automotrices (18,000 – 43,000 SKUs de Profit Plus Administrativo).
- **Marketplace:** Mercado Libre Venezuela (`MLV`), moneda oficial de publicación `USD`.
- **Stack Tecnológico:**
  - **Frontend:** Next.js 14 (App Router, Tailwind CSS, Lucide Icons, SheetJS / xlsx).
  - **Backend:** Next.js Route Handlers (`src/app/api/...`), Server-Sent Events (SSE).
  - **Base de Datos:** Supabase (PostgreSQL, tablas: `products`, `oauth_accounts`, `category_mappings`, etc.).
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
- [ ] Conectar el catálogo de pesos (`catalogo_pesos_mercadoenvios_300g.xlsx`) directamente al payload de creación/actualización de publicaciones (`shipping.dimensions` / `attributes.PACKAGE_WEIGHT`).
- [ ] Auditoría de publicaciones activas con peso en 0 en Mercado Libre para actualizarles el peso vía API antes de generar envíos.
- [ ] Panel web para editar y crear nuevas reglas de mapeo de sublíneas visualmente.

---

## 🤝 6. Contrato de Handoff (Sesión Actual)

### Sesión 2026-09-29 (Continuación en la otra PC / Despliegue R630)
- **Objetivo Próximo:** Desplegar el ERP en el servidor Dell PowerEdge R630 bajo Coolify/Docker para eliminar la dependencia y límites de Vercel.
- **Preparativos Listos en el Repo:**
  1. `Dockerfile` multi-stage optimizado para Next.js 14 standalone creado.
  2. `next.config.mjs` configurado con `output: 'standalone'`.
  3. `.dockerignore` configurado para excluir dependencias y archivos innecesarios.
  4. Guías detalladas en `scripts/setup-coolify-r630.md` y `deploy/coolify/`.
- **Instrucción para la IA en la otra PC:**
  *Al abrir el repositorio en la otra PC (sea con Antigravity o Cursor), leer este archivo `memoria.md` y proceder a conectar el repositorio en Coolify (`http://192.168.1.88:8000` o IP del R630).*
