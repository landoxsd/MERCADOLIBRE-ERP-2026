---
name: meli_batch_publisher
description: Motor de publicación masiva directa por API oficial de Mercado Libre con soporte para Tienda Oficial, escaneo y subida de fotos locales, enriquecimiento con Gemini 3.6 Flash IA, inteligencia competitiva, catálogo vehicular y vista previa pre-flight (Publicador de Calidad v2).
---

# meli_batch_publisher

💡 Esta habilidad proporciona el conocimiento técnico y los procedimientos para ejecutar publicaciones masivas por lotes directamente contra la API oficial de Mercado Libre sin depender de plantillas Excel intermedias.

## Usage

Use esta habilidad cuando necesite:
- Publicar lotes de productos directamente desde el inventario de Profit Plus a Mercado Libre.
- Escanear carpetas de imágenes locales (`SKU.jpg`, `SKU-1.jpg`, etc.) y subirlas a `POST /pictures/items/upload`.
- Resolver fotos desde **Banco de Imágenes** (Supabase `image_bank`) antes que disco local.
- Inyectar el `official_store_id` y atributos obligatorios de la categoría.
- Enriquecer títulos SEO y descripciones con el pool Multi-Key de Google Gemini 3.6 Flash.
- Aplicar **inteligencia competitiva** (SERP + multiget del líder de ventas) antes de publicar.
- Insertar **foto de aplicación vehicular** en posición 2 desde `vehicle_catalog` / `sku_vehicle_fitment` (fotos en `{photosPath}/CARROS/` o `photosPath` apuntando directamente a CARROS).
- Mostrar **vista previa pre-flight** antes de confirmar el lote.
- **Mejorar publicaciones existentes** en lote desde el SEO Optimizer.
- Transmitir el progreso en tiempo real mediante Server-Sent Events (SSE).

## Arquitectura del Flujo v2

```
  [Excel Profit / Faltantes]
             │
             ▼
  [Vista Previa Pre-flight] ➔ POST /api/account/publications/publish-preview
             │
             ▼
  [Escáner de Fotos] ➔ Image Bank → Local → Placeholder
             │
             ▼
  [Foto Vehículo] ➔ vehicle_catalog + CARROS/ + injectVehiclePhoto (posición 2)
             │
             ▼
  [Mapeo de Categorías] ➔ category_mappings / domain_discovery
             │
             ▼
  [Intel Competitiva] ➔ analyzeCompetitorsForListing + mergeLeaderInsights
             │
             ▼
  [Validación Pre-flight] ➔ validatePublishItem (precio, fotos, título)
             │
             ▼
  [Atributos Requeridos] ➔ GET /categories/{id}/attributes + atributos del líder
             │
             ▼
  [Enriquecimiento Gemini] ➔ Descripciones y Compatibilidad
             │
             ▼
  [Creación de Publicación] ➔ POST /items + POST /items/{id}/description
             │
             ▼
  [Fitment ML + DB] ➔ setItemCompatibilities + product_compatibilities
             │
             ▼
  [Persistencia Supabase] ➔ products (photo_status, competitor_leader_id)
```

## Flujo de Mejora de Publicaciones Existentes

```
  [SEO Optimizer — Radar] ➔ Seleccionar publicaciones activas
             │
             ▼
  [Mejorar con Intel. Competitiva] ➔ POST /api/account/publications/improve-batch (SSE)
             │
             ▼
  Por cada meli_item_id:
    - GET multiget del ítem propio
    - analyzeCompetitorsForListing + mergeLeaderInsights
    - PUT título, atributos faltantes, precio (si cambio ≤20%)
             │
             ▼
  [Actualización Supabase] ➔ products.title, products.price
```

## Componentes Clave

### Backend API

| Ruta | Descripción |
|------|-------------|
| `publish-batch/route.js` | Lote SSE con intel competencia, fotos vehículo, pre-flight, maxDuration 300 |
| `publish-preview/route.js` | Vista previa del primer ítem sin publicar |
| `publish/route.js` | Publicación individual con paridad v2 (flags default true) |
| `improve-batch/route.js` | Mejora masiva de publicaciones existentes vía SSE |

### Librerías

| Archivo | Responsabilidad |
|---------|-----------------|
| `publish-helpers.js` | Fotos, categorías, atributos, SEO title, duplicados |
| `publication-quality-engine.js` | Intel competencia, merge líder, validatePublishItem, buildPublishPreview |
| `vehicle-catalog.js` | Fitment por SKU, foto aplicación (`CARROS/`), compatibilidades ML |

### UI

| Componente | Ubicación |
|------------|-----------|
| `MassPublisherModal.js` | `/dashboard/inventory` — 3 pasos: Configurar → Vista previa → Publicar |
| SEO Optimizer | `/dashboard/optimizer` — botón "Mejorar con Intel. Competitiva" |

### Flags de Publicación

```json
{
  "useCompetitorIntel": true,
  "injectVehiclePhotos": true,
  "usePlaceholderIfNoPhoto": true,
  "useAI": true,
  "skipDuplicates": true
}
```

### Pool de IA Gemini (`src/lib/gemini.js`)

- Round-Robin entre 4 API Keys (`GEMINI_API_KEY`, `_2`, `_3`, `_4`), alcanzando 60 peticiones/minuto gratuitas.
- Infiere compatibilidad vehicular (años, modelos, motores) y formatea texto plano para ML.

### Desktop CLI (`ML_Desktop_Publisher/publicar_api_directo.js`)

Script standalone con ejecutable `.bat` para publicar desde terminal en segundo plano.

## Migración de Base de Datos

Ejecutar `migration_vehicle_catalog_2026.sql` para tablas:
- `vehicle_catalog`
- `sku_vehicle_fitment`
- `product_compatibilities`

## Eventos SSE

### publish-batch
`start`, `competitor_intel`, `item_status`, `item_success`, `item_skipped`, `item_error`, `complete`

### improve-batch
`start`, `competitor_intel`, `item_status`, `item_improved`, `item_preview` (dry-run), `item_skipped`, `item_error`, `complete`

---

## 🔧 Mejoras de Ingeniería Inversa (Mercatech + Integraly `v2.2.0.6` — Octubre 2026)

### 1. Auto-Recorte y Maximización de Fotos (`CropWhiteSpace` + `EnlargeImage`)
Antes de subir las fotos locales de `/mnt/fotos` (`\\192.168.1.10\e\FOTOS`, formato `SKU-0.jpg`) a `POST /pictures/items/upload`:
- Usar `sharp(buffer).trim({ background: '#FFFFFF', threshold: 12 })` para recortar márgenes blancos sobrantes.
- Escalar el repuesto para que ocupe el **92%–95%** de un lienzo cuadrado blanco puro de `1500x1500` px (`JPEG 95%`), maximizando el tamaño visual de la miniatura en los listados de MLV.

### 2. Diccionario Maestro de Compatibilidades (`compatibilidades.json.gz` + Similitud de Coseno)
- Recurso extraído de Integraly en `c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY\2.2.0.6\compatibilidades.json.gz` (2.59 MB).
- Permite cruzar marca/modelo/año extraídos de la descripción de Profit Plus mediante tokens normalizados y Similitud de Coseno sobre embeddings para inyectar automáticamente `POST /items/{id}/compatibilities` y `/compatibilities/cards`.

### 3. Publicación de Combos y Kits Virtuales (`syncBoxProduct` + `FormOpenAISugerirKitsVirtuales`)
- Permite publicar Kits (ej. `Kit 4 Bujías`, `Par Amortiguadores Delanteros`, `Kit Tiempo`) compuestos por 1 o más SKUs hijos de Profit Plus (`RWC20_A`).
- El stock disponible del Kit se calcula sobre los almacenes `'01.01'`, `'01.02'`, `'01.03'` como:
  `MIN(FLOOR((stock_act - stock_com) / qty_requerida))`.

