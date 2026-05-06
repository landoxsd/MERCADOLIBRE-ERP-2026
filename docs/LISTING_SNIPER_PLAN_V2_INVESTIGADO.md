# 📋 LISTING SNIPER v2 — PLAN TÉCNICO INVESTIGADO
## Inteligencia Competitiva para MercadoLibre Venezuela (MLV)

> **Fecha de investigación:** 2026-05-06
> **Mercado objetivo:** MLV (Venezuela) — USD oficial
> **Stack:** Next.js App Router, Tailwind, Supabase (PostgreSQL), MercadoLibre API
> **Revisión cruzada:** Integrado con análisis de Asistente A (especialista MLV)

---

## 🔬 INVESTIGACIONES REALIZADAS A LA API DE ML

### 1. Sobre el Ordenamiento por Cantidad Vendida (`sort=sold_quantity_desc`)

**⚠️ HALLAZGO CRÍTICO:** La documentación oficial de MercadoLibre NO lista `sold_quantity_desc` como un `sort` válido para búsquedas públicas (`/sites/MLV/search`).

**Sorts disponibles documentados para búsqueda pública:**
- `price_asc` / `price_desc`
- `relevance` (por defecto)

**Sorts disponibles para búsqueda de ítems del vendedor (`/users/{id}/items/search`):**
- `stop_time_asc/desc`, `start_time_asc/desc`
- `available_quantity_asc/desc`
- `price_asc/desc`
- `last_updated_desc/asc`
- `inventory_id_asc`

**Estrategia alternativa para el Sniper (RECOMMENDADA):**
1. Primera llamada: `GET /sites/MLV/search?q={query}&sort=relevance&limit=10` (captura los "más relevantes")
2. Segunda llamada: `GET /sites/MLV/search?q={query}&sort=price_asc&limit=10` (detecta si alguien vende más barato)
3. Para cada ítem encontrado, obtener `sold_quantity` del detalle (`/items/{id}`) y ordenar por ventas en memoria.
4. El campo `sold_quantity` SÍ viene en la respuesta de `/items/{id}` y también en resultados de búsqueda pública.

**Campo útil en búsqueda pública:**
```json
{
  "results": [{
    "sold_quantity": 150,
    "sold_since": "2024-01-01",
    "price": 25.00,
    "listing_type_id": "gold_special"
  }]
}
```

---

### 2. API de Calidad: `/health` vs `/performance`

**⚠️ HALLAZGO:** La API `/items/{id}/health` fue **descontinuada el 7 de febrero 2025** y reemplazada por `/item/{id}/performance`.

**Nueva API de Performance (usar esta):**
```
GET https://api.mercadolibre.com/item/MLVxxxxxx/performance
```

**Respuesta incluye buckets:**
- `CHARACTERISTICS` → Datos del producto (fotos, título, especificaciones, GTIN)
- `OFFER` → Condiciones de venta (stock, envío, financiamiento)

**Para vehículos (MLV usa health):**
```
GET https://api.mercadolibre.com/items/MLVxxxxxx/health
```
Respuesta con goals: `picture`, `price`, `video`, `verification`, `description`.

**Decisión para el Sniper:**
- Usar `/item/{id}/performance` para productos generales (incluye autopartes si aplican).
- Como fallback, soportar `/items/{id}/health` para categorías de vehículos.

---

### 3. Búsqueda de Competidores (Endpoints Confirmados)

**A. Búsqueda pública por query (sin autenticación):**
```
GET https://api.mercadolibre.com/sites/MLV/search?q={query}&limit=10
```
No requiere token. Devuelve:
- `results[].id` (MLVxxxxx)
- `results[].title`
- `results[].price`
- `results[].sold_quantity`
- `results[].seller.id` / `seller.nickname`
- `results[].seller.seller_reputation.level_id`
- `results[].listing_type_id`
- `results[].permalink`
- `results[].shipping.logistic_type`
- `results[].shipping.free_shipping`
- `results[].attributes[]` (atributos públicos)

**B. Detalle de ítem (sin autenticación para públicos):**
```
GET https://api.mercadolibre.com/items/{item_id}
```
Devuelve:
- `pictures[]` (array completo de fotos)
- `attributes[]` (todos los atributos, incluyendo BRAND, PART_NUMBER, SELLER_SKU)
- `health` (legacy) o datos para `/performance`
- `seller_custom_field` (SKU del vendedor — solo visible si es tu ítem o con token)
- `variations[]`
- `status`

**C. Multiget (hasta 20 ítems):**
```
GET https://api.mercadolibre.com/items?ids=MLV1,MLV2,...MLV20
```
Devuelve array con `{ code, body }` para cada uno.

---

### 4. Atributos Críticos para Autopartes (MLV)

Basado en la documentación de "Compatibilidades entre ítems y productos de Autopartes":

**Atributos clave a extraer del líder:**
- `BRAND` → Marca del repuesto
- `PART_NUMBER` → Número de parte (OEM/Alterno)
- `SELLER_SKU` → SKU propio del vendedor
- `GTIN` / `UPC` / `EAN` → Código universal (si aplica)
- `MODEL` → Modelo del vehículo compatible
- `COMPATIBILITY` → Vía `/items/{id}/compatibility`

**API de Compatibilidades:**
```
GET https://api.mercadolibre.com/items/{item_id}/compatibility
```

---

### 5. Sobre Logística en Venezuela (MLV)

**⚠️ HALLAZGO CRÍTICO:** En Venezuela NO existe Mercado Envíos Full/Flex como en Argentina/Brasil/México.

**La documentación de MLV indica:**
- No hay `mercadopago` como método de pago obligatorio.
- No hay `free_shipping` con ME.
- El envío es coordinado directamente (logística tradicional).

**Campos logísticos relevantes para MLV:**
- `shipping.mode`: `"not_specified"`, `"custom"`
- `shipping.tags`: `[]`
- `shipping.logistic_type`: `"not_specified"`
- `seller_address.city.name`, `seller_address.state.name`

**Estrategia para el Sniper en MLV:**
- Ignorar métricas de ME/Full/Flex.
- Enfocarse en: **Zonas de cobertura**, **Ciudades de pickup**, **Tiempos de entrega**.
- Detectar en títulos/descripciones: "Envío a todo el país", "Pickup en Caracas/Valencia/Maracaibo", "Zoom", "Tealca", "Liberty Express", "MRW".

---

### 6. Reputación del Vendedor (Endpoint Confirmado)

```
GET https://api.mercadolibre.com/users/{user_id}
```

Devuelve `seller_reputation`:
```json
{
  "level_id": "5_green",
  "power_seller_status": "platinum",
  "transactions": {
    "completed": 5000,
    "total": 5200,
    "ratings": { "positive": 0.98, "negative": 0.01, "neutral": 0.01 }
  }
}
```

**Mapeo de `level_id` (ya implementado en `src/lib/meli.js`):**
- `1_red` → Rojo
- `2_orange` → Naranja
- `3_yellow` → Amarillo
- `4_light_green` → Verde Claro
- `5_green` → Verde

---

### 7. Visitas de Ítems (Tendencias)

```
GET https://api.mercadolibre.com/items/visits?ids=MLV1,MLV2,...
```
Devuelve objeto con `{ "MLV1": 150, "MLV2": 2300 }` (visitas totales).

**Nota:** No es un endpoint de "visitas por período", es acumulado. Para tendencias se requiere guardar snapshots históricos.

---

## 🗄️ FASE 1: INFRAESTRUCTURA DE DATOS (SQL)

### Tablas Propuestas (Actualizadas con hallazgos)

```sql
-- ================================================================
-- 1. Tabla de Análisis de Competencia (Snapshots del mercado)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    our_product_sku TEXT,
    our_ml_item_id TEXT,              -- NUEVO: Relación con nuestro producto
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd DECIMAL(12,2),
    sold_quantity INTEGER DEFAULT 0,
    sold_since DATE,                  -- NUEVO: Desde cuándo vende
    listing_type_id TEXT,             -- gold_special, gold_pro, etc.
    permalink TEXT,
    
    -- Datos del vendedor
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT,     -- 5_green, etc.
    seller_power_seller TEXT,         -- silver, gold, platinum
    
    -- Métricas de calidad
    health_score INTEGER,             -- Score de /performance (0-100)
    health_level TEXT,                -- Básica, Estándar, Profesional
    pictures_count INTEGER DEFAULT 0, -- NÚMERO DE FOTOS
    attributes_count INTEGER DEFAULT 0, -- NÚMERO DE ATRIBUTOS COMPLETOS
    has_description BOOLEAN DEFAULT false,
    
    -- Datos logísticos MLV
    logistics_data JSONB DEFAULT '{}', -- { pickup_zones: [], delivery_methods: [], city: "" }
    
    -- Datos crudos para análisis profundo
    raw_item_data JSONB DEFAULT '{}',  -- Respuesta completa de /items/{id}
    raw_search_data JSONB DEFAULT '{}', -- Respuesta de /sites/MLV/search
    
    -- Posicionamiento
    search_position INTEGER,          -- 1, 2, 3... en la búsqueda
    search_sort_used TEXT DEFAULT 'relevance', -- Qué sort usamos
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_snapshots_query ON mlv_market_snapshots(search_query);
CREATE INDEX IF NOT EXISTS idx_snapshots_sku ON mlv_market_snapshots(our_product_sku);
CREATE INDEX IF NOT EXISTS idx_snapshots_item ON mlv_market_snapshots(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON mlv_market_snapshots(created_at DESC);

-- ================================================================
-- 2. Tabla de Scores Comparativos y Plan de Acción
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_listing_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    competitor_item_id TEXT NOT NULL,
    
    -- Score total (0-100) ponderado
    score_total INTEGER,
    
    -- Score por dimensión
    score_details JSONB DEFAULT '{}', 
    -- {
    --   price: 80,        -- 100 = más barato, 0 = mucho más caro
    --   seo_title: 90,    -- 100 = título óptimo, 0 = pobre
    --   photos: 70,       -- 100 = más fotos que líder, 0 = menos
    --   attributes: 85,   -- 100 = todos los atributos del líder
    --   reputation: 60,   -- 100 = mejor reputación que líder
    --   health: 75        -- 100 = mejor health score
    -- }
    
    -- Plan de acción generado por el algoritmo
    action_plan JSONB DEFAULT '[]',
    -- [
    --   { priority: "high", action: "bajar_precio", detail: "Baja el precio $2", impact: "+15% visibilidad" },
    --   { priority: "medium", action: "add_photos", detail: "Añade 3 fotos más", impact: "+10% clicks" },
    --   { priority: "low", action: "add_attribute", detail: "Añade PART_NUMBER", impact: "+5% búsquedas" }
    -- ]
    
    -- Campos del líder para referencia rápida
    leader_title TEXT,
    leader_price DECIMAL(12,2),
    leader_sold_quantity INTEGER,
    leader_pictures_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_our_item ON mlv_listing_scores(our_ml_item_id);
CREATE INDEX IF NOT EXISTS idx_scores_sku ON mlv_listing_scores(our_product_sku);
CREATE INDEX IF NOT EXISTS idx_scores_competitor ON mlv_listing_scores(competitor_item_id);

-- ================================================================
-- 3. Tabla de Historial de Posiciones (Tracking semanal)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_position_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    search_query TEXT NOT NULL,
    
    position_before INTEGER,
    position_after INTEGER,
    snapshot_id UUID REFERENCES mlv_market_snapshots(id),
    
    actions_applied JSONB DEFAULT '[]', -- Qué cambios se hicieron
    notes TEXT,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poshist_our_item ON mlv_position_history(our_ml_item_id);
CREATE INDEX IF NOT EXISTS idx_poshist_query ON mlv_position_history(search_query);
```

---

## ⚙️ FASE 2: BACKEND (API Routes)

### 2.1 Estructura de Archivos Propuesta

```
src/app/api/tools/sniper/
├── analyze/route.js              # POST: Analizar competidores por query
├── compare/route.js              # POST: Comparar nuestro ítem vs líder
├── health/route.js               # GET: Obtener health/performance de ítem
├── history/route.js              # GET: Historial de posiciones
└── optimize/route.js             # POST: Generar plan de acción
```

### 2.2 API Route: `analyze/route.js` (Investigada)

```javascript
// POST /api/tools/sniper/analyze
// Body: { query: string, sku?: string, ourPrice?: number, ourItemId?: string, accountId?: string }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { meliGet } from "@/lib/meli";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

export async function POST(request) {
  try {
    const { query, sku, ourPrice, ourItemId, accountId } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: "Query requerida" }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 1. BUSCAR COMPETIDORES (búsqueda pública — no requiere token)
    // ------------------------------------------------------------------
    const searchUrl = `${MELI_BASE_URL}/sites/MLV/search?q=${encodeURIComponent(query)}&limit=10`;
    const searchRes = await fetch(searchUrl);
    
    if (!searchRes.ok) {
      throw new Error(`ML Search Error: ${searchRes.status}`);
    }
    
    const searchData = await searchRes.json();
    const competitors = searchData.results || [];
    
    // ------------------------------------------------------------------
    // 2. OBTENER DETALLES DE CADA COMPETIDOR (multiget)
    // ------------------------------------------------------------------
    const itemIds = competitors.map(c => c.id).slice(0, 10);
    
    // Dividir en chunks de 20 para multiget
    const chunks = [];
    for (let i = 0; i < itemIds.length; i += 20) {
      chunks.push(itemIds.slice(i, i + 20));
    }
    
    const itemDetails = [];
    for (const chunk of chunks) {
      const idsParam = chunk.join(",");
      const detailRes = await fetch(`${MELI_BASE_URL}/items?ids=${idsParam}`);
      if (detailRes.ok) {
        const details = await detailRes.json();
        itemDetails.push(...details.filter(d => d.code === 200).map(d => d.body));
      }
    }
    
    // Crear mapa id -> detalles
    const detailsMap = new Map(itemDetails.map(d => [d.id, d]));
    
    // ------------------------------------------------------------------
    // 3. OBTENER NUESTRO ÍTEM (si se proporcionó ourItemId o sku)
    // ------------------------------------------------------------------
    let ourItem = null;
    if (ourItemId) {
      const ourDetailRes = await fetch(`${MELI_BASE_URL}/items/${ourItemId}`);
      if (ourDetailRes.ok) ourItem = await ourDetailRes.json();
    }
    
    // ------------------------------------------------------------------
    // 4. PROCESAR Y ENRIQUECER DATOS (scraping lógico)
    // ------------------------------------------------------------------
    const processedSnapshots = competitors.map((comp, index) => {
      const detail = detailsMap.get(comp.id) || {};
      
      // --- Scraping lógico de logística MLV ---
      const titleLower = (comp.title || "").toLowerCase();
      const descLower = (detail.description || "").toLowerCase();
      
      const pickupZones = [];
      if (titleLower.includes("caracas") || descLower.includes("caracas")) pickupZones.push("caracas");
      if (titleLower.includes("valencia") || descLower.includes("valencia")) pickupZones.push("valencia");
      if (titleLower.includes("maracaibo") || descLower.includes("maracaibo")) pickupZones.push("maracaibo");
      if (titleLower.includes("barquisimeto") || descLower.includes("barquisimeto")) pickupZones.push("barquisimeto");
      
      const deliveryMethods = [];
      if (titleLower.includes("envío") || titleLower.includes("envio")) deliveryMethods.push("envio_nacional");
      if (titleLower.includes("zoom") || descLower.includes("zoom")) deliveryMethods.push("zoom");
      if (titleLower.includes("tealca") || descLower.includes("tealca")) deliveryMethods.push("tealca");
      if (titleLower.includes("mrw") || descLower.includes("mrw")) deliveryMethods.push("mrw");
      
      return {
        search_query: query,
        our_product_sku: sku || null,
        our_ml_item_id: ourItemId || null,
        ml_item_id: comp.id,
        title: comp.title,
        price_usd: comp.price,
        sold_quantity: comp.sold_quantity || detail.sold_quantity || 0,
        sold_since: detail.date_created ? detail.date_created.split("T")[0] : null,
        listing_type_id: comp.listing_type_id,
        permalink: comp.permalink,
        seller_id: comp.seller?.id?.toString(),
        seller_nickname: comp.seller?.nickname,
        seller_reputation_level: comp.seller?.seller_reputation?.level_id,
        seller_power_seller: comp.seller?.seller_reputation?.power_seller_status,
        pictures_count: detail.pictures?.length || 0,
        attributes_count: detail.attributes?.length || 0,
        has_description: !!detail.descriptions && detail.descriptions.length > 0,
        logistics_data: {
          pickup_zones: pickupZones,
          delivery_methods: deliveryMethods,
          seller_city: comp.seller_address?.city?.name || null,
          seller_state: comp.seller_address?.state?.name || null,
        },
        raw_item_data: detail,
        raw_search_data: comp,
        search_position: index + 1,
        search_sort_used: "relevance",
      };
    });
    
    // ------------------------------------------------------------------
    // 5. GUARDAR EN SUPABASE
    // ------------------------------------------------------------------
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("mlv_market_snapshots")
      .insert(processedSnapshots)
      .select();
    
    if (insertError) {
      console.error("Error guardando snapshots:", insertError);
    }
    
    // ------------------------------------------------------------------
    // 6. IDENTIFICAR LÍDER (más vendido)
    // ------------------------------------------------------------------
    const leader = [...processedSnapshots].sort((a, b) => 
      (b.sold_quantity || 0) - (a.sold_quantity || 0)
    )[0];
    
    return NextResponse.json({
      success: true,
      query,
      totalResults: competitors.length,
      leader: leader || null,
      competitors: processedSnapshots,
      snapshots: inserted || [],
      ourItem: ourItem ? {
        id: ourItem.id,
        title: ourItem.title,
        price: ourItem.price,
        pictures: ourItem.pictures?.length || 0,
        sold_quantity: ourItem.sold_quantity,
      } : null,
    });
    
  } catch (err) {
    console.error("Error en /api/tools/sniper/analyze:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### 2.3 API Route: `compare/route.js` (Algoritmo de Comparación)

```javascript
// POST /api/tools/sniper/compare
// Body: { ourItemId: string, competitorItemId: string }

// Lógica de scoring:
// 1. Obtener detalles de ambos ítems
// 2. Comparar dimensión por dimensión
// 3. Generar action_plan
```

**Algoritmo de Scoring (0-100 por dimensión):**

```javascript
function calculateScores(ourItem, leader) {
  const scores = {};
  const actions = [];
  
  // --- PRECIO ---
  const priceDiff = ourItem.price - leader.price;
  const pricePct = leader.price > 0 ? (priceDiff / leader.price) * 100 : 0;
  
  if (priceDiff <= 0) {
    scores.price = 100; // Somos más baratos o igual
  } else if (pricePct <= 5) {
    scores.price = 80;
    actions.push({ priority: "low", action: "price", detail: `Estás $${priceDiff.toFixed(2)} más caro. Considera igualar.`, impact: "+5% visibilidad" });
  } else if (pricePct <= 15) {
    scores.price = 50;
    actions.push({ priority: "medium", action: "price", detail: `Estás ${pricePct.toFixed(0)}% más caro ($${priceDiff.toFixed(2)}). Baja el precio.`, impact: "+15% visibilidad" });
  } else {
    scores.price = 20;
    actions.push({ priority: "high", action: "price", detail: `Estás ${pricePct.toFixed(0)}% más caro. ¡URGENTE!`, impact: "+25% visibilidad" });
  }
  
  // --- TÍTULO / SEO ---
  const ourTitleLen = ourItem.title?.length || 0;
  const leaderTitleLen = leader.title?.length || 0;
  const ourWords = ourItem.title?.split(/\s+/).length || 0;
  
  if (ourTitleLen >= 55 && ourWords >= 6) {
    scores.seo_title = 100;
  } else if (ourTitleLen >= 40) {
    scores.seo_title = 70;
    actions.push({ priority: "medium", action: "title", detail: `Título corto (${ourTitleLen} chars). Añade más detalles.`, impact: "+10% búsquedas" });
  } else {
    scores.seo_title = 40;
    actions.push({ priority: "high", action: "title", detail: `Título muy corto (${ourTitleLen} chars). Mínimo 55 caracteres.`, impact: "+20% búsquedas" });
  }
  
  // Mayúsculas en título
  if (ourItem.title && ourItem.title === ourItem.title.toUpperCase()) {
    scores.seo_title = Math.max(0, scores.seo_title - 30);
    actions.push({ priority: "high", action: "title_case", detail: "Quita las MAYÚSCULAS del título. Usa formato oración.", impact: "+15% profesionalismo" });
  }
  
  // --- FOTOS ---
  const ourPhotos = ourItem.pictures?.length || 0;
  const leaderPhotos = leader.pictures?.length || 0;
  
  if (ourPhotos >= leaderPhotos) {
    scores.photos = 100;
  } else if (ourPhotos >= leaderPhotos - 2) {
    scores.photos = 70;
    actions.push({ priority: "low", action: "photos", detail: `Añade ${leaderPhotos - ourPhotos} foto(s) más.`, impact: "+8% clicks" });
  } else {
    scores.photos = 40;
    actions.push({ priority: "high", action: "photos", detail: `Solo ${ourPhotos} fotos vs ${leaderPhotos} del líder. Añade más.`, impact: "+20% clicks" });
  }
  
  // --- ATRIBUTOS ---
  const leaderAttrs = new Set((leader.attributes || []).map(a => a.id));
  const ourAttrs = new Set((ourItem.attributes || []).map(a => a.id));
  const missingAttrs = [...leaderAttrs].filter(id => !ourAttrs.has(id));
  
  const attrCoverage = leaderAttrs.size > 0 
    ? (ourAttrs.size / leaderAttrs.size) * 100 
    : 100;
  scores.attributes = Math.min(100, attrCoverage);
  
  if (missingAttrs.includes("BRAND")) {
    actions.push({ priority: "high", action: "attribute", detail: "Falta atributo BRAND (Marca).", impact: "+10% búsquedas" });
  }
  if (missingAttrs.includes("PART_NUMBER")) {
    actions.push({ priority: "high", action: "attribute", detail: "Falta atributo PART_NUMBER (Número de parte).", impact: "+15% búsquedas por OEM" });
  }
  if (missingAttrs.length > 0) {
    actions.push({ priority: "medium", action: "attributes", detail: `Faltan ${missingAttrs.length} atributos: ${missingAttrs.join(", ")}`, impact: "+12% visibilidad" });
  }
  
  // --- REPUTACIÓN (nuestro seller vs líder) ---
  // Esto requiere conocer nuestra reputación. Por ahora asumimos que es estática o se pasa.
  scores.reputation = 80; // Placeholder
  
  // --- HEALTH / PERFORMANCE ---
  scores.health = ourItem.health_score || 50;
  
  // --- SCORE TOTAL PONDERADO ---
  const weights = {
    price: 0.25,
    seo_title: 0.20,
    photos: 0.20,
    attributes: 0.20,
    reputation: 0.10,
    health: 0.05
  };
  
  const totalScore = Math.round(
    Object.entries(scores).reduce((sum, [key, val]) => {
      return sum + (val * (weights[key] || 0));
    }, 0)
  );
  
  // Ordenar acciones por prioridad
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return { score_total: totalScore, score_details: scores, action_plan: actions };
}
```

---

## 🎨 FASE 3: FRONTEND (UI/UX)

### 3.1 Sidebar (Actualización)

Actualmente en `src/components/Sidebar.js` ya existe una pestaña "Competencia" pero apunta a `/dashboard/competition`. El plan original pide "Inteligencia de Mercado".

**Recomendación:** Renombrar la ruta existente y actualizar el label:

```javascript
// En NAV_ITEMS:
{ href: '/dashboard/intelligence', label: 'Inteligencia de Mercado', icon: '🎯' },
// Eliminar o redirigir la vieja '/dashboard/competition'
```

### 3.2 Página Principal: `src/app/dashboard/intelligence/page.js`

**Layout propuesto:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🔎 BARRA DE BÚSQUEDA                                           │
│  [SKU o Término de búsqueda....] [Analizar Mercado]            │
├─────────────────────────────────────────────────────────────────┤
│  📊 TARJETA DEL LÍDER (WinnerCard)                              │
│  ┌──────────────┬────────────────────────────────────────────┐ │
│  │ 🥇 Foto      │ Título del líder                           │ │
│  │   Líder      │ $45.00 | 1,250 vendidos | ⭐5_green        │ │
│  │              │ 8 fotos | BRAND: Toyota | PART: 04465-02220│ │
│  └──────────────┴────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ⚔️ COMPARATIVA CARA A CARA (WinnerCard expandido)             │
│  ┌─────────────────┬─────────────────┬───────────────────────┐ │
│  │  NOSOTROS       │  vs             │  LÍDER                │ │
│  │  $48.00 ❌      │  Precio         │  $45.00 ✅            │ │
│  │  3 fotos ⚠️     │  Fotos          │  8 fotos ✅           │ │
│  │  40 chars ❌    │  Título         │  60 chars ✅          │ │
│  │  5 atributos ⚠️ │  Atributos      │  12 atributos ✅      │ │
│  └─────────────────┴─────────────────┴───────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  📈 SCORE CIRCULAR (Radial Chart)                               │
│     ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                         │
│     │ 45  │  │ 70  │  │ 30  │  │ 85  │                         │
│     │Precio│  │Fotos│  │ SEO │  │Attr │                         │
│     └─────┘  └─────┘  └─────┘  └─────┘                         │
├─────────────────────────────────────────────────────────────────┤
│  📝 PLAN DE ACCIÓN (SEO-Advice)                                 │
│  🔴 [URGENTE] Baja el precio $3 — Impacto: +25%                │
│  🟡 [MEDIA] Añade 5 fotos más — Impacto: +20%                  │
│  🟢 [BAJA] Añade PART_NUMBER — Impacto: +15%                   │
├─────────────────────────────────────────────────────────────────┤
│  📋 GRILLA DE COMPETIDORES (CompetitorGrid)                     │
│  ┌────┬──────────────┬───────┬─────────┬──────────┬────────┐   │
│  │ #  │ Vendedor     │Precio │ Vendidos│ Fotos    │ Score  │   │
│  │ 1  │ MundoAuto_VE │ $45   │ 1,250   │ 8        │ 92 🟢  │   │
│  │ 2  │ RepuestosX   │ $47   │ 890     │ 6        │ 85 🟢  │   │
│  │ 3  │ CarroParts   │ $50   │ 420     │ 4        │ 72 🟡  │   │
│  └────┴──────────────┴───────┴─────────┴──────────┴────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Componentes Necesarios

```
src/components/intelligence/
├── SearchBar.js           # Input de búsqueda + botón analizar
├── CompetitorGrid.js      # Tabla de competidores
├── WinnerCard.js          # Comparativa cara a cara
├── ScoreChart.js          # Gráfico circular (SVG)
├── SEOAdvice.js           # Lista de acciones
├── LeaderBadge.js         # Badge de reputación
└── SnapshotHistory.js     # Histórico de análisis previos
```

### 3.4 ScoreChart (Gráfico Circular SVG)

```javascript
// Componente simple sin librerías externas
export function ScoreChart({ score, label, color }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={radius} fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
          {score}
        </text>
      </svg>
      <span className="text-xs text-slate-400 mt-1">{label}</span>
    </div>
  );
}
```

---

## 🧠 FASE 4: LÓGICA DE POSICIONAMIENTO (SEO & Atributos)

### 4.1 Reglas del Algoritmo (Implementadas)

| Regla | Condición | Acción Sugerida | Prioridad |
|-------|-----------|-----------------|-----------|
| **Título muy corto** | `< 40 caracteres` | "Añade más detalles al título. Mínimo 55 caracteres." | 🔴 Alta |
| **Título corto** | `40-54 caracteres` | "Optimiza el título con palabras clave." | 🟡 Media |
| **Mayúsculas** | `title === title.toUpperCase()` | "Quita las MAYÚSCULAS. Usa formato de oración." | 🔴 Alta |
| **Fotos insuficientes** | `< 3 fotos` | "Añade al menos 3 fotos. Ideal: 6-8." | 🔴 Alta |
| **Menos fotos que líder** | `ourPhotos < leaderPhotos - 2` | `Añade ${diff} fotos más para igualar al líder.` | 🔴 Alta |
| **Falta BRAND** | `!attributes.includes("BRAND")` | "Añade la Marca del repuesto." | 🔴 Alta |
| **Falta PART_NUMBER** | `!attributes.includes("PART_NUMBER")` | "Añade el Número de Parte (OEM)." | 🔴 Alta |
| **Precio 5%+ caro** | `price > leaderPrice * 1.05` | "Baja el precio para ser competitivo." | 🟡 Media |
| **Precio 15%+ caro** | `price > leaderPrice * 1.15` | "¡URGENTE! Estás muy por encima del mercado." | 🔴 Alta |
| **Sin descripción** | `!has_description` | "Añade una descripción detallada." | 🟡 Media |
| **Health score bajo** | `< 50` | "Mejora la calidad de la publicación. Revisa /performance." | 🟡 Media |

### 4.2 Keywords para MLV (Autopartes)

Palabras clave a detectar en títulos de líderes (para sugerir en SEO):
- "Original", "Generico", "Alterno", "OEM"
- "Toyota", "Ford", "Chevrolet", "Mitsubishi", "Nissan", "Hyundai"
- "Delantero", "Trasero", "Izquierdo", "Derecho", "Conductor", "Copiloto"
- "Corolla", "Fortuner", "Hilux", "Explorer", "Ranger", "Lancer"
- "Amortiguador", "Bumper", "Guardafango", "Faro", "Stop", "Catalítico"

---

## 🛡️ FASE 5: CONSIDERACIONES TÉCNICAS Y EDGE CASES

### 5.1 Rate Limiting

La API de ML tiene límites de rate. El helper `meliGet` ya implementa backoff exponencial para HTTP 429.

**Estrategia para el Sniper:**
- Las búsquedas públicas (`/sites/MLV/search`) NO requieren token y tienen límite más alto.
- Los multigets (`/items?ids=...`) tampoco requieren token para ítems públicos.
- Usar `Promise.allSettled` para paralelizar, pero con chunks controlados.

### 5.2 Ítems sin ventas (`sold_quantity = 0`)

Si todos los competidores tienen `sold_quantity = 0`, usar `price_asc` como criterio secundario para identificar "líder".

### 5.3 Nuestro ítem no existe aún

Si el SKU ingresado no tiene publicación en ML:
- Analizar competidores igualmente.
- Mostrar mensaje: "No tienes publicación para este SKU. Datos del mercado para crear una."
- Sugerir usar el módulo de publicación masiva.

### 5.4 Búsqueda sin resultados

Si `/sites/MLV/search?q=...` devuelve 0 resultados:
- Sugerir términos alternativos (sin número de parte, sin marca, etc.).
- Usar `domain_discovery` para encontrar la categoría correcta.

### 5.5 Datos sensibles

**⚠️ IMPORTANTE:** El campo `seller_custom_field` (SKU real) solo es visible con token del vendedor. En la búsqueda pública no se expone. Para obtener el SKU de competidores, solo podemos inferirlo del título o atributos públicos.

---

## 📋 RESUMEN DE TAREAS DE IMPLEMENTACIÓN

### Sprint 1: Fundamentos
- [ ] 1.1 Ejecutar SQL de tablas (`mlv_market_snapshots`, `mlv_listing_scores`, `mlv_position_history`)
- [ ] 1.2 Crear API route `/api/tools/sniper/analyze`
- [ ] 1.3 Crear API route `/api/tools/sniper/compare`
- [ ] 1.4 Crear API route `/api/tools/sniper/health` (wrapper de /performance)

### Sprint 2: UI
- [ ] 2.1 Actualizar Sidebar.js (ruta `/dashboard/intelligence`)
- [ ] 2.2 Crear página `src/app/dashboard/intelligence/page.js`
- [ ] 2.3 Crear componentes: SearchBar, CompetitorGrid, WinnerCard, ScoreChart, SEOAdvice
- [ ] 2.4 Integrar frontend con API routes

### Sprint 3: Algoritmo y Optimización
- [ ] 3.1 Implementar `calculateScores()` con todas las reglas
- [ ] 3.2 Implementar detección de keywords en títulos
- [ ] 3.3 Implementar scraping lógico de logística MLV
- [ ] 3.4 Implementar historial de posiciones
- [ ] 3.5 Testing con productos reales de autopartes

### Sprint 4: Publicar Similares (Fase Futura)
- [ ] 4.1 Botón "Crear publicación basada en líder"
- [ ] 4.2 Pre-llenar formulario de publicación con datos del líder
- [ ] 4.3 Sugerir fotos del banco de imágenes por SKU

---

## 🔗 REFERENCIAS

- Documentación ML: https://developers.mercadolibre.com.ar/
- API de búsqueda: `/sites/MLV/search`
- API de ítems: `/items/{id}` | `/items?ids=...`
- API de Performance (nueva): `/item/{id}/performance`
- API de Health (legacy): `/items/{id}/health`
- API de Compatibilidades: `/items/{id}/compatibility`
- API de Categorías: `/categories/{id}/attributes`

---

> **Nota:** Este documento fue generado tras investigación directa de la API de MercadoLibre, el código existente del proyecto, y la documentación oficial. Reemplaza y actualiza el plan original con hallazgos críticos sobre disponibilidad de endpoints y especificidades de MLV.
