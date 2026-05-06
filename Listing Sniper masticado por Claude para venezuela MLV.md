# 🎯 Listing Sniper — Enfocado 100% en MLV (Venezuela)

## Investigación Específica del Mercado Venezolano

---

## 📋 Índice

1. [Realidad del Mercado MLV](#realidad-mlv)
2. [Limitaciones Técnicas Específicas de Venezuela](#limitaciones)
3. [Adaptaciones del Sistema](#adaptaciones)
4. [Base de Datos Adaptada a MLV](#base-datos)
5. [Servicios Adaptados](#servicios)
6. [Manejo de Monedas (USD/VES/Petro)](#monedas)
7. [Categorías Calientes de MLV](#categorias)

---

## 1. Realidad del Mercado MLV {#realidad-mlv}

### 1.1 Contexto Crítico que Cambia TODO el Sistema

```
DIFERENCIAS MLV vs OTROS SITES DE ML:
══════════════════════════════════════════════════════════════

❌ LO QUE NO EXISTE EN MLV:
├── Mercado Full (Fulfillment)     → NO disponible en Venezuela
├── Mercado Flex                   → NO disponible en Venezuela
├── Mercado Envíos estándar        → LIMITADO / inestable
├── Mercado Pago (pagos)           → MUY limitado
├── Financiamiento en cuotas       → NO disponible
└── Publicidad Premium (ML Ads)    → Disponibilidad limitada

✅ LO QUE SÍ FUNCIONA EN MLV:
├── Listing Types: free, bronze, silver, gold, gold_special, gold_pro
├── Envío: Acuerdo entre comprador/vendedor (pickup, delivery propio)
├── Pago: Efectivo, Transferencia, Zelle, Binance, Pago Móvil
├── Categorías activas con miles de publicaciones
├── API de búsqueda y consulta de items completamente funcional
└── Reputación de vendedor (sistema de estrellas/colores)

⚠️ REALIDADES DEL MERCADO:
├── Precios en USD (dolarización de facto desde 2019)
├── Algunos vendedores ponen precio en Bs. (genera confusión)
├── Logística 100% manual (el vendedor coordina la entrega)
├── Zonas de despacho son el factor logístico real
├── WhatsApp es el canal de cierre de ventas más usado
└── Las fotos malas son la norma → ENORME oportunidad
```

### 1.2 Factores de Ranking REALES en MLV

```
PESO REAL DEL ALGORITMO MLV:
(Basado en ingeniería inversa del mercado venezolano)

╔══════════════════════════════════════════════════╗
║  Factor                        Peso Estimado     ║
╠══════════════════════════════════════════════════╣
║  Tasa de Conversión (CVR)           28%          ║
║  Relevancia del Título (SEO)        25%          ║
║  Reputación del Vendedor            20%          ║
║  Completitud de Ficha Técnica       15%          ║
║  Tipo de Publicación (Gold/Silver)  12%          ║
╚══════════════════════════════════════════════════╝

NOTA: Sin Full/Flex, la logística NO es factor.
El precio Y las fotos son los drivers de conversión.

FACTORES REALES DE CONVERSIÓN EN MLV:
├── 🥇 Precio competitivo en USD        → Factor #1
├── 🥈 Fotos de calidad (fondo blanco)  → Factor #2
├── 🥉 Disponibilidad de zona/pickup    → Factor #3
├── 4️⃣  Respuesta rápida del vendedor   → Factor #4
└── 5️⃣  Descripción con WhatsApp        → Factor #5 (controversial)
```

### 1.3 Tipos de Publicación Disponibles en MLV

```
LISTING TYPES EN MLV Y SU IMPACTO:
══════════════════════════════════════════════════════

gold_pro      → Máxima visibilidad, posición privilegiada
               Costo: % de venta más alto
               Duración: 60 días

gold_special  → Alta visibilidad (el más usado por líderes)
               Costo: % intermedio
               Duración: 60 días

gold          → Buena visibilidad
               Duración: 60 días

silver        → Visibilidad media
               Duración: 60 días

bronze        → Visibilidad básica
               Duración: 60 días

free          → Sin costo, mínima visibilidad
               Límite: pocas publicaciones gratuitas
               Duración: 60 días

ESTRATEGIA MLV:
Si el líder tiene gold_special → nosotros necesitamos gold_special o gold_pro
```

---

## 2. Limitaciones Técnicas Específicas de Venezuela {#limitaciones}

### 2.1 Comportamiento de la API para MLV

```
ENDPOINTS CONFIRMADOS PARA MLV:
══════════════════════════════════════════════════════════════

✅ FUNCIONA:
GET  https://api.mercadolibre.com/sites/MLV/search?q={query}
GET  https://api.mercadolibre.com/items/{MLV_item_id}
GET  https://api.mercadolibre.com/items/{id}/description
GET  https://api.mercadolibre.com/items?ids={id1,id2}
GET  https://api.mercadolibre.com/categories/{cat_id}
GET  https://api.mercadolibre.com/categories/{cat_id}/attributes
GET  https://api.mercadolibre.com/sites/MLV/listing_types
GET  https://api.mercadolibre.com/users/{seller_id}
GET  https://api.mercadolibre.com/users/{id}/items/search
GET  https://api.mercadolibre.com/sites/MLV/categories
GET  https://api.mercadolibre.com/sites/MLV/category_predictor/predict?title={t}

⚠️ LIMITADO EN MLV:
GET  /sites/MLV/trends        → Datos escasos
GET  /items/{id}/shipping     → Sin datos (no hay ME2)
POST /items                   → Requiere cuenta verificada en MLV

❌ NO APLICA EN MLV:
     /shipments/*             → No hay Mercado Envíos real
     /fulfillment/*           → No disponible
     /proximities/*           → No disponible

PARÁMETROS DE BÚSQUEDA ÚTILES PARA MLV:
?q={query}
&sort=sold_quantity_desc      → Los más vendidos primero (CLAVE)
&sort=price_asc               → Más baratos primero
&sort=relevance               → Default de ML
&limit=50                     → Máximo permitido
&offset=0                     → Paginación
&condition=new                → Solo nuevos
&category={cat_id}            → Filtrar por categoría
&price={min}-{max}            → Rango de precio
```

### 2.2 Rate Limits de la API de ML

```
RATE LIMITS A RESPETAR:
══════════════════════════════════════════════════════

Sin autenticación:  → No recomendado, bloqueado rápido
Con token válido:
├── Requests por segundo:  ~100/segundo
├── Requests por hora:     ~200,000
├── Batch items:           Hasta 20 IDs por request
└── Recomendación:         200ms entre requests individuales

ESTRATEGIA DE RATE LIMITING EN NUESTRO SISTEMA:
├── Cache agresivo en Redis (TTL: 4 horas)
├── Queue jobs para análisis masivos
├── Batch requests cuando sea posible
└── Exponential backoff en errores 429
```

---

## 3. Adaptaciones del Sistema para MLV {#adaptaciones}

### 3.1 Nuevo Modelo de Score para MLV

```
SCORECARD MLV — SIN LOGÍSTICA FULL/FLEX:
══════════════════════════════════════════════════════════

DIMENSIÓN              PESO    QUÉ SE EVALÚA
─────────────────────────────────────────────────────────
Precio Competitivo      28%    Vs promedio del Top 5
Título SEO              25%    Palabras clave, longitud, estructura
Calidad Visual          20%    Nº fotos, calidad, fondo blanco
Reputación Vendedor     15%    Nivel ML, ventas completadas
Tipo Publicación        12%    Gold Pro > Gold Special > Gold...
─────────────────────────────────────────────────────────
TOTAL                  100%

BONUS (no en el peso principal, sí en recomendaciones):
├── +5pts  Descripción con más de 300 palabras
├── +5pts  Ficha técnica al 100% de atributos
├── +3pts  Tiene video
└── +2pts  Responde en < 1 hora (reputación histórica)
```

### 3.2 Factores de Logística en MLV (Lo que sí existe)

```
LOGÍSTICA REAL EN MLV — CÓMO LA MEDIMOS:
══════════════════════════════════════════════════════════

En Venezuela, la "logística" es lo que el vendedor
describe en su publicación. Buscamos en la descripción
y atributos:

SEÑALES DE BUENA LOGÍSTICA (scraping de descripción):
├── "Entrega en el día"         → Señal positiva fuerte
├── "Envío a todo el país"      → Señal positiva
├── "Retiro en tienda"          → Neutral
├── "Pickup en [zona popular]"  → Neutral
├── "Despachamos por MRW"       → Señal positiva
├── "Encomiendas Zoom"          → Señal positiva
└── "Solo Caracas"              → Señal negativa (limita mercado)

TRANSPORTISTAS CONOCIDOS EN MLV:
├── MRW
├── Zoom
├── Tealca
├── Domesa
├── Delivery propio
└── Moto delivery
```

---

## 4. Base de Datos Adaptada a MLV {#base-datos}

```sql
-- ============================================================
-- MIGRACIÓN: listing_sniper_mlv
-- Sistema adaptado 100% a la realidad de MLV
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLA PRINCIPAL: Snapshots de competidores en MLV
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_competitor_snapshots (
    id                      BIGSERIAL PRIMARY KEY,

    -- ── Contexto de la búsqueda ──────────────────────────────
    search_query            VARCHAR(255)    NOT NULL,
    search_date             DATE            NOT NULL DEFAULT CURRENT_DATE,
    our_product_sku         VARCHAR(100),           -- SKU de Profit Plus

    -- ── Identificación del item ──────────────────────────────
    ml_item_id              VARCHAR(25)     NOT NULL,  -- Formato: MLV123456789
    ml_permalink            TEXT,                      -- URL directa a la pub
    category_id             VARCHAR(20),               -- MLV1055 = Baterías, etc.
    category_name           VARCHAR(150),

    -- ── Datos del vendedor ───────────────────────────────────
    ml_seller_id            BIGINT,
    seller_nickname         VARCHAR(100),
    seller_level_id         VARCHAR(30),    -- '5_green', '4_light_green', etc.
    seller_completed_sales  INTEGER DEFAULT 0,
    seller_canceled_sales   INTEGER DEFAULT 0,
    seller_response_rate    DECIMAL(5,2),   -- % de respuesta
    seller_is_store         BOOLEAN DEFAULT false,

    -- ── Datos económicos (MLV usa USD de facto) ──────────────
    price_usd               DECIMAL(12,2),  -- Precio en USD
    price_ves               DECIMAL(20,2),  -- Precio en Bolívares (si aplica)
    currency_id             VARCHAR(5),     -- 'USD' o 'VES'
    original_price          DECIMAL(12,2),  -- Si tiene descuento
    discount_percentage     DECIMAL(5,2),   -- % de descuento mostrado

    -- ── Métricas de ventas ───────────────────────────────────
    sold_quantity           INTEGER DEFAULT 0,
    available_quantity      INTEGER DEFAULT 0,

    -- ── Tipo de publicación (factor de posicionamiento) ──────
    listing_type_id         VARCHAR(30),    -- 'gold_special', 'gold_pro', etc.
    listing_type_label      VARCHAR(50),    -- Etiqueta legible
    condition               VARCHAR(10)     DEFAULT 'new',

    -- ── Logística MLV (sin Full/Flex) ────────────────────────
    -- En MLV la logística es manual, la detectamos del texto
    ships_nationwide        BOOLEAN DEFAULT false,  -- ¿Envía a todo el país?
    ships_to_caracas        BOOLEAN DEFAULT false,
    uses_mrw                BOOLEAN DEFAULT false,
    uses_zoom               BOOLEAN DEFAULT false,
    uses_tealca             BOOLEAN DEFAULT false,
    uses_own_delivery       BOOLEAN DEFAULT false,
    has_pickup_point        BOOLEAN DEFAULT false,
    pickup_locations        TEXT,           -- "Las Mercedes, Chacao, Altamira"
    free_shipping_text      BOOLEAN DEFAULT false, -- Dice "envío gratis" en desc

    -- ── Calidad de contenido ─────────────────────────────────
    picture_count           INTEGER DEFAULT 0,
    has_video               BOOLEAN DEFAULT false,
    has_description         BOOLEAN DEFAULT false,
    description_word_count  INTEGER DEFAULT 0,
    attribute_count         INTEGER DEFAULT 0,
    attribute_fill_rate     DECIMAL(5,2),   -- % de atributos completados

    -- ── Análisis de fotos ────────────────────────────────────
    estimated_photo_quality VARCHAR(10),    -- 'high', 'medium', 'low'
    -- (basado en dimensiones de las URLs del CDN de ML)

    -- ── Posición en búsqueda ─────────────────────────────────
    search_position         INTEGER,        -- 1 = líder
    search_sort_used        VARCHAR(30),    -- 'sold_quantity_desc'

    -- ── Datos raw para procesamiento ─────────────────────────
    raw_item_json           JSONB,          -- El JSON completo del item
    raw_attributes          JSONB,          -- Array de atributos
    raw_pictures            JSONB,          -- Array de pictures
    description_text        TEXT,           -- Texto de la descripción

    -- ── Control ──────────────────────────────────────────────
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW(),

    -- Un item solo se guarda una vez por día por búsqueda
    UNIQUE(ml_item_id, search_date, search_query)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: Análisis de títulos SEO para MLV
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_title_analysis (
    id                      BIGSERIAL PRIMARY KEY,
    search_query            VARCHAR(255),
    analysis_date           DATE DEFAULT CURRENT_DATE,
    our_product_sku         VARCHAR(100),

    -- Palabras clave extraídas de los top 10
    keywords_json           JSONB,
    /*
    Formato:
    [
      {
        "word": "batería",
        "frequency": 9,
        "weighted_score": 87,
        "positions": [1, 2, 3],
        "in_leader": true,
        "avg_title_position": 1.2
      }
    ]
    */

    -- Nuestro título actual
    our_current_title       VARCHAR(255),
    our_current_score       INTEGER,        -- 0-100

    -- Título sugerido por el sistema
    suggested_title_v1      VARCHAR(60),    -- Basado en algoritmo
    suggested_title_v2      VARCHAR(60),    -- Mejorado con GPT-4
    suggested_score_v1      INTEGER,
    suggested_score_v2      INTEGER,

    -- Estadísticas de los títulos analizados
    avg_title_length        INTEGER,
    max_title_length        INTEGER,
    leader_title            VARCHAR(255),
    leader_title_length     INTEGER,

    created_at              TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: ScoreCard de nuestras publicaciones vs competencia
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_listing_scores (
    id                      BIGSERIAL PRIMARY KEY,

    -- Nuestro item
    our_ml_item_id          VARCHAR(25),
    our_product_sku         VARCHAR(100),

    -- El competidor con quien comparamos
    competitor_snapshot_id  BIGINT REFERENCES mlv_competitor_snapshots(id),
    competitor_item_id      VARCHAR(25),
    competitor_position     INTEGER,        -- Posición del competidor (#1, #2...)

    analysis_date           TIMESTAMP DEFAULT NOW(),

    -- ── Scores por dimensión (0-100) ─────────────────────────
    score_price             INTEGER,        -- 28% del total
    score_title             INTEGER,        -- 25% del total
    score_pictures          INTEGER,        -- 20% del total
    score_reputation        INTEGER,        -- 15% del total
    score_listing_type      INTEGER,        -- 12% del total

    -- Score total ponderado (sin Full/Flex)
    total_score             INTEGER,
    grade                   VARCHAR(5),     -- 'A+', 'A', 'B', 'C', 'D', 'F'

    -- ── Datos de la comparación ──────────────────────────────
    our_price               DECIMAL(12,2),
    competitor_price        DECIMAL(12,2),
    price_diff_pct          DECIMAL(6,2),   -- % diferencia

    our_picture_count       INTEGER,
    competitor_picture_count INTEGER,

    -- ── Diagnósticos ─────────────────────────────────────────
    alerts_json             JSONB,
    action_plan_json        JSONB,

    -- ── Seguimiento ──────────────────────────────────────────
    action_taken            VARCHAR(100),
    action_taken_at         TIMESTAMP,
    score_after_action      INTEGER,        -- Para medir mejora

    created_at              TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: Biblioteca de imágenes de competidores
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_competitor_images (
    id                      BIGSERIAL PRIMARY KEY,
    snapshot_id             BIGINT REFERENCES mlv_competitor_snapshots(id),
    ml_item_id              VARCHAR(25),

    -- Datos de la imagen de ML
    ml_picture_id           VARCHAR(50),
    original_url            TEXT,           -- URL del CDN de ML
    -- Formato: https://http2.mlstatic.com/D_NQ_NP_{id}-{size}.webp

    -- Calidad estimada (de la URL del CDN podemos saber el tamaño)
    url_size_hint           VARCHAR(10),    -- 'O' (original), 'V' (grande), etc.
    is_main_picture         BOOLEAN DEFAULT false,  -- La foto principal

    -- Si decidimos descargar la imagen
    is_downloaded           BOOLEAN DEFAULT false,
    local_filename          VARCHAR(255),
    download_status         VARCHAR(20),    -- 'pending', 'done', 'error'

    position_in_listing     INTEGER,        -- Orden en la publicación

    created_at              TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: Histórico de precios del mercado MLV
-- Para detectar tendencias y bajadas de precio
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_price_history (
    id                      BIGSERIAL PRIMARY KEY,
    ml_item_id              VARCHAR(25)     NOT NULL,
    seller_id               BIGINT,
    recorded_date           DATE            NOT NULL DEFAULT CURRENT_DATE,
    price_usd               DECIMAL(12,2),
    price_ves               DECIMAL(20,2),
    currency_id             VARCHAR(5),
    available_quantity      INTEGER,
    sold_quantity           INTEGER,

    UNIQUE(ml_item_id, recorded_date)
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: Alertas de cambios del mercado
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_market_alerts (
    id                      BIGSERIAL PRIMARY KEY,
    our_product_sku         VARCHAR(100),
    alert_type              VARCHAR(50),
    /*
    Tipos:
    - 'price_drop'        → El líder bajó su precio
    - 'new_competitor'    → Entró un competidor nuevo al Top 5
    - 'stock_out'         → El líder se quedó sin stock
    - 'price_increase'    → El líder subió precio (oportunidad)
    - 'listing_removed'   → El líder retiró su publicación
    */
    severity                VARCHAR(10),    -- 'high', 'medium', 'low'
    message                 TEXT,
    details_json            JSONB,
    ml_item_id              VARCHAR(25),    -- El item que generó la alerta
    is_read                 BOOLEAN DEFAULT false,
    created_at              TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: Categorías principales de MLV (caché local)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE mlv_categories_cache (
    id                      VARCHAR(20)     PRIMARY KEY,  -- 'MLV1055'
    name                    VARCHAR(200),
    parent_id               VARCHAR(20),
    path_from_root          JSONB,
    total_items_in_category INTEGER,
    attributes_json         JSONB,          -- Atributos requeridos/opcionales
    last_synced             TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES PARA PERFORMANCE
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_mlv_snap_sku       ON mlv_competitor_snapshots(our_product_sku);
CREATE INDEX idx_mlv_snap_date      ON mlv_competitor_snapshots(search_date DESC);
CREATE INDEX idx_mlv_snap_position  ON mlv_competitor_snapshots(search_position);
CREATE INDEX idx_mlv_snap_sold      ON mlv_competitor_snapshots(sold_quantity DESC);
CREATE INDEX idx_mlv_snap_price     ON mlv_competitor_snapshots(price_usd);
CREATE INDEX idx_mlv_snap_cat       ON mlv_competitor_snapshots(category_id);
CREATE INDEX idx_mlv_snap_seller    ON mlv_competitor_snapshots(ml_seller_id);
CREATE INDEX idx_mlv_snap_attrs     ON mlv_competitor_snapshots USING GIN(raw_attributes);
CREATE INDEX idx_mlv_snap_raw       ON mlv_competitor_snapshots USING GIN(raw_item_json);
CREATE INDEX idx_mlv_price_hist     ON mlv_price_history(ml_item_id, recorded_date DESC);
CREATE INDEX idx_mlv_alerts_sku     ON mlv_market_alerts(our_product_sku, is_read);
CREATE INDEX idx_mlv_scores_item    ON mlv_listing_scores(our_ml_item_id);
```

---

## 5. Servicios Adaptados para MLV {#servicios}

### 5.1 MarketSpy Service — Versión MLV

```php
<?php

namespace App\Services\ListingSniper;

use Illuminate\Support\Facades\{Http, Cache, Log};
use App\Models\MlvCompetitorSnapshot;
use App\Models\MlvPriceHistory;
use App\Models\MlvMarketAlert;

class MlvMarketSpyService
{
    // ─────────────────────────────────────────────────────────
    // CONFIGURACIÓN ESPECÍFICA MLV
    // ─────────────────────────────────────────────────────────
    private const SITE_ID       = 'MLV';
    private const BASE_URL      = 'https://api.mercadolibre.com';
    private const CACHE_TTL     = 14400;    // 4 horas
    private const RATE_DELAY_MS = 250;      // 250ms entre requests
    private const TOP_RESULTS   = 10;
    private const BATCH_SIZE    = 20;       // Máximo de ML para multi-get

    // Transportistas conocidos en Venezuela
    private const VEN_CARRIERS = [
        'mrw'      => ['mrw'],
        'zoom'     => ['zoom'],
        'tealca'   => ['tealca'],
        'domesa'   => ['domesa'],
        'delivery' => ['delivery', 'moto', 'mensajería', 'mensajero'],
    ];

    public function __construct(
        private readonly string $accessToken
    ) {}

    // ─────────────────────────────────────────────────────────
    // MÉTODO PRINCIPAL
    // ─────────────────────────────────────────────────────────
    public function analyzeMarket(
        string  $query,
        ?string $ourSku      = null,
        string  $sortBy      = 'sold_quantity_desc',
        ?string $categoryId  = null,
        ?float  $minPrice    = null,
        ?float  $maxPrice    = null
    ): array {
        $cacheKey = $this->buildCacheKey($query, $sortBy, $categoryId);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use (
            $query, $ourSku, $sortBy, $categoryId, $minPrice, $maxPrice
        ) {
            Log::info("[MLV MarketSpy] Analizando: '{$query}'", [
                'sku'  => $ourSku,
                'sort' => $sortBy,
            ]);

            // 1. Buscar top items en MLV
            $searchResults = $this->searchMlv(
                $query, $sortBy, $categoryId, $minPrice, $maxPrice
            );

            if (empty($searchResults['results'])) {
                return [
                    'success'     => false,
                    'error'       => 'No se encontraron resultados en MLV',
                    'query'       => $query,
                    'total_found' => 0,
                ];
            }

            $totalAvailable = $searchResults['paging']['total'] ?? 0;
            $items          = $searchResults['results'];
            $itemIds        = array_column($items, 'id');

            // 2. Obtener detalles completos (batch)
            $itemDetails = $this->getItemsBatch($itemIds);

            // 3. Obtener descripciones
            $descriptions = $this->getDescriptions($itemIds);

            // 4. Obtener datos de vendedores (para reputación)
            $sellerIds  = array_unique(array_filter(
                array_column($itemDetails, 'seller_id')
            ));
            $sellersMap = $this->getSellersData($sellerIds);

            // 5. Construir snapshots completos
            $snapshots = [];
            foreach ($itemDetails as $index => $item) {

                $seller      = $sellersMap[$item['seller_id'] ?? 0] ?? [];
                $description = $descriptions[$item['id']]           ?? '';

                $snapshot = $this->buildMlvSnapshot(
                    item:        $item,
                    seller:      $seller,
                    description: $description,
                    position:    $index + 1,
                    query:       $query,
                    sortBy:      $sortBy,
                    ourSku:      $ourSku,
                );

                // Persistir
                $this->persistSnapshot($snapshot);

                // Detectar cambios de precio (generar alertas)
                $this->detectPriceChanges($snapshot, $ourSku);

                $snapshots[] = $snapshot;
            }

            return $this->buildMarketReport($snapshots, $query, $totalAvailable);
        });
    }

    // ─────────────────────────────────────────────────────────
    // BÚSQUEDA EN MLV
    // ─────────────────────────────────────────────────────────
    private function searchMlv(
        string  $query,
        string  $sort,
        ?string $categoryId,
        ?float  $minPrice,
        ?float  $maxPrice
    ): array {
        $params = [
            'q'     => $query,
            'sort'  => $sort,
            'limit' => self::TOP_RESULTS,
        ];

        if ($categoryId) $params['category'] = $categoryId;

        // En MLV los precios son USD de facto
        if ($minPrice || $maxPrice) {
            $params['price'] = ($minPrice ?? '*') . '-' . ($maxPrice ?? '*');
        }

        $response = Http::withToken($this->accessToken)
            ->timeout(20)
            ->get(self::BASE_URL . '/sites/' . self::SITE_ID . '/search', $params);

        if (!$response->successful()) {
            Log::error('[MLV MarketSpy] Error en búsqueda', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            return ['results' => [], 'paging' => ['total' => 0]];
        }

        return $response->json();
    }

    // ─────────────────────────────────────────────────────────
    // BATCH DE ITEMS (hasta 20 por llamada)
    // ─────────────────────────────────────────────────────────
    private function getItemsBatch(array $itemIds): array
    {
        $results = [];
        $chunks  = array_chunk($itemIds, self::BATCH_SIZE);

        foreach ($chunks as $chunk) {
            usleep(self::RATE_DELAY_MS * 1000);

            $response = Http::withToken($this->accessToken)
                ->timeout(25)
                ->get(self::BASE_URL . '/items', [
                    'ids' => implode(',', $chunk),
                ]);

            if (!$response->successful()) continue;

            foreach ($response->json() as $wrapper) {
                if (($wrapper['code'] ?? 0) === 200) {
                    $results[] = $wrapper['body'];
                }
            }
        }

        return $results;
    }

    // ─────────────────────────────────────────────────────────
    // OBTENER DESCRIPCIONES
    // ─────────────────────────────────────────────────────────
    private function getDescriptions(array $itemIds): array
    {
        $descriptions = [];

        foreach ($itemIds as $itemId) {
            usleep(self::RATE_DELAY_MS * 1000);

            $cacheKey = "mlv_desc:{$itemId}";

            $text = Cache::remember($cacheKey, self::CACHE_TTL * 2, function () use ($itemId) {
                $r = Http::withToken($this->accessToken)
                    ->timeout(10)
                    ->get(self::BASE_URL . "/items/{$itemId}/description");

                return $r->successful() ? ($r->json('plain_text') ?? '') : '';
            });

            $descriptions[$itemId] = $text;
        }

        return $descriptions;
    }

    // ─────────────────────────────────────────────────────────
    // DATOS DE VENDEDORES
    // ─────────────────────────────────────────────────────────
    private function getSellersData(array $sellerIds): array
    {
        $sellers = [];

        foreach ($sellerIds as $sellerId) {
            if (!$sellerId) continue;
            usleep(self::RATE_DELAY_MS * 1000);

            $cacheKey = "mlv_seller:{$sellerId}";

            $data = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($sellerId) {
                $r = Http::withToken($this->accessToken)
                    ->timeout(10)
                    ->get(self::BASE_URL . "/users/{$sellerId}");

                return $r->successful() ? $r->json() : [];
            });

            if ($data) $sellers[$sellerId] = $data;
        }

        return $sellers;
    }

    // ─────────────────────────────────────────────────────────
    // CONSTRUIR SNAPSHOT MLV
    // ─────────────────────────────────────────────────────────
    private function buildMlvSnapshot(
        array   $item,
        array   $seller,
        string  $description,
        int     $position,
        string  $query,
        string  $sortBy,
        ?string $ourSku
    ): array {
        $pictures   = $item['pictures']   ?? [];
        $attributes = $item['attributes'] ?? [];
        $rep        = $seller['seller_reputation'] ?? [];
        $trans      = $rep['transactions']         ?? [];

        // ── Extraer info de logística del texto de descripción ──
        $logisticsInfo = $this->extractLogisticsFromText(
            $description . ' ' . ($item['title'] ?? '')
        );

        // ── Detectar moneda real ─────────────────────────────────
        // En MLV muchos ponen VES pero el precio efectivo es USD
        $currencyId = $item['currency_id'] ?? 'USD';
        $priceUsd   = $currencyId === 'USD' ? ($item['price'] ?? 0) : null;
        $priceVes   = $currencyId !== 'USD' ? ($item['price'] ?? 0) : null;

        // ── Estimar calidad de fotos por URL ────────────────────
        $photoQuality = $this->estimatePhotoQuality($pictures);

        return [
            // Contexto
            'search_query'            => $query,
            'search_sort_used'        => $sortBy,
            'our_product_sku'         => $ourSku,
            'search_position'         => $position,

            // Item
            'ml_item_id'              => $item['id'],
            'ml_permalink'            => $item['permalink'] ?? null,
            'category_id'             => $item['category_id'] ?? null,

            // Vendedor
            'ml_seller_id'            => $item['seller_id']  ?? ($seller['id'] ?? null),
            'seller_nickname'         => $seller['nickname'] ?? null,
            'seller_level_id'         => $rep['level_id']    ?? null,
            'seller_completed_sales'  => $trans['completed'] ?? 0,
            'seller_canceled_sales'   => $trans['canceled']  ?? 0,
            'seller_response_rate'    => $seller['status']['sell']['allow'] ?? null,
            'seller_is_store'         => !empty($seller['is_brand_official']),

            // Precios
            'price_usd'               => $priceUsd,
            'price_ves'               => $priceVes,
            'currency_id'             => $currencyId,
            'original_price'          => $item['original_price'] ?? null,
            'discount_percentage'     => $this->calcDiscount($item),

            // Ventas
            'sold_quantity'           => $item['sold_quantity']    ?? 0,
            'available_quantity'      => $item['available_quantity'] ?? 0,

            // Tipo de publicación
            'listing_type_id'         => $item['listing_type_id'] ?? null,
            'listing_type_label'      => $this->formatListingType($item['listing_type_id'] ?? ''),
            'condition'               => $item['condition'] ?? 'new',

            // Logística MLV
            'ships_nationwide'        => $logisticsInfo['nationwide'],
            'ships_to_caracas'        => $logisticsInfo['caracas'],
            'uses_mrw'                => $logisticsInfo['mrw'],
            'uses_zoom'               => $logisticsInfo['zoom'],
            'uses_tealca'             => $logisticsInfo['tealca'],
            'uses_own_delivery'       => $logisticsInfo['own_delivery'],
            'has_pickup_point'        => $logisticsInfo['has_pickup'],
            'pickup_locations'        => $logisticsInfo['pickup_text'],
            'free_shipping_text'      => $logisticsInfo['free_shipping'],

            // Contenido
            'picture_count'           => count($pictures),
            'has_video'               => in_array('has_video', $item['tags'] ?? []),
            'has_description'         => strlen(trim($description)) > 20,
            'description_word_count'  => str_word_count($description),
            'attribute_count'         => count($attributes),
            'attribute_fill_rate'     => $this->calcAttributeFillRate($attributes),
            'estimated_photo_quality' => $photoQuality,

            // Raw data
            'raw_item_json'           => json_encode($item),
            'raw_attributes'          => json_encode($attributes),
            'raw_pictures'            => json_encode($pictures),
            'description_text'        => $description,

            // Título
            'title'                   => $item['title'] ?? null,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // EXTRACTOR DE LOGÍSTICA DEL TEXTO (específico MLV)
    // ─────────────────────────────────────────────────────────
    private function extractLogisticsFromText(string $text): array
    {
        $text = mb_strtolower($text);

        // Zonas de Caracas más buscadas
        $caracasZones = [
            'caracas', 'altamira', 'chacao', 'las mercedes',
            'bello monte', 'el rosal', 'los palos grandes',
            'la castellana', 'sabana grande', 'el hatillo',
            'baruta', 'petare', 'catia', 'la candelaria',
        ];

        $pickupZones = [];
        foreach ($caracasZones as $zone) {
            if (str_contains($text, $zone)) {
                $pickupZones[] = ucwords($zone);
            }
        }

        return [
            'nationwide'    => str_contains($text, 'todo el pa') // "todo el país"
                            || str_contains($text, 'nivel nacional')
                            || str_contains($text, 'a nivel nac'),
            'caracas'       => !empty($pickupZones)
                            || str_contains($text, 'caracas'),
            'mrw'           => str_contains($text, 'mrw'),
            'zoom'          => str_contains($text, 'zoom'),
            'tealca'        => str_contains($text, 'tealca'),
            'domesa'        => str_contains($text, 'domesa'),
            'own_delivery'  => str_contains($text, 'delivery')
                            || str_contains($text, 'moto')
                            || str_contains($text, 'mensajer'),
            'has_pickup'    => str_contains($text, 'retiro')
                            || str_contains($text, 'pickup')
                            || str_contains($text, 'local')
                            || str_contains($text, 'tienda'),
            'free_shipping' => str_contains($text, 'envío gratis')
                            || str_contains($text, 'envio gratis')
                            || str_contains($text, 'sin costo de envío'),
            'pickup_text'   => implode(', ', $pickupZones),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // ESTIMADOR DE CALIDAD DE FOTOS
    // ML usa sufijos en las URLs para indicar el tamaño
    // ─────────────────────────────────────────────────────────
    private function estimatePhotoQuality(array $pictures): string
    {
        if (empty($pictures)) return 'none';

        $mainPicUrl = $pictures[0]['secure_url'] ?? $pictures[0]['url'] ?? '';

        /*
        Sufijos del CDN de ML:
        -O.jpg  = Original (máxima calidad)
        -V.jpg  = Grande (~1200px)
        -Z.jpg  = Mediana (~600px)
        -G.jpg  = Pequeña
        -E.jpg  = Thumbnail
        */

        return match(true) {
            str_contains($mainPicUrl, '-O.') => 'high',
            str_contains($mainPicUrl, '-V.') => 'high',
            str_contains($mainPicUrl, '-Z.') => 'medium',
            str_contains($mainPicUrl, '-G.') => 'low',
            default                          => 'unknown',
        };
    }

    // ─────────────────────────────────────────────────────────
    // REPORTE FINAL DEL MERCADO
    // ─────────────────────────────────────────────────────────
    private function buildMarketReport(array $snapshots, string $query, int $total): array
    {
        if (empty($snapshots)) return ['success' => false];

        $pricesUsd   = array_filter(array_column($snapshots, 'price_usd'));
        $soldQtys    = array_column($snapshots, 'sold_quantity');
        $pictureCnts = array_column($snapshots, 'picture_count');
        $attrCounts  = array_column($snapshots, 'attribute_count');
        $leader      = $snapshots[0];

        // Estadísticas de logística
        $shipsNation  = count(array_filter($snapshots, fn($s) => $s['ships_nationwide']));
        $useMrw       = count(array_filter($snapshots, fn($s) => $s['uses_mrw']));
        $useZoom      = count(array_filter($snapshots, fn($s) => $s['uses_zoom']));
        $hasPickup    = count(array_filter($snapshots, fn($s) => $s['has_pickup_point']));

        return [
            'success'       => true,
            'query'         => $query,
            'analyzed_at'   => now()->toIso8601String(),
            'total_in_ml'   => $total,
            'analyzed_count'=> count($snapshots),

            // El líder actual del mercado
            'leader' => [
                'ml_item_id'        => $leader['ml_item_id'],
                'title'             => $leader['title'],
                'price_usd'         => $leader['price_usd'],
                'sold_quantity'     => $leader['sold_quantity'],
                'seller_nickname'   => $leader['seller_nickname'],
                'seller_level'      => $leader['seller_level_id'],
                'listing_type'      => $leader['listing_type_label'],
                'picture_count'     => $leader['picture_count'],
                'has_video'         => $leader['has_video'],
                'attribute_count'   => $leader['attribute_count'],
                'ships_nationwide'  => $leader['ships_nationwide'],
                'permalink'         => $leader['ml_permalink'],
                // Logística del líder
                'logistics'         => [
                    'mrw'          => $leader['uses_mrw'],
                    'zoom'         => $leader['uses_zoom'],
                    'tealca'       => $leader['uses_tealca'],
                    'own_delivery' => $leader['uses_own_delivery'],
                    'has_pickup'   => $leader['has_pickup_point'],
                    'nationwide'   => $leader['ships_nationwide'],
                ],
            ],

            // Estadísticas del mercado venezolano
            'market_stats' => [
                // Precios
                'avg_price_usd'     => !empty($pricesUsd)
                    ? round(array_sum($pricesUsd) / count($pricesUsd), 2)
                    : 0,
                'min_price_usd'     => !empty($pricesUsd) ? min($pricesUsd) : 0,
                'max_price_usd'     => !empty($pricesUsd) ? max($pricesUsd) : 0,
                'median_price_usd'  => !empty($pricesUsd)
                    ? $this->median($pricesUsd)
                    : 0,

                // Ventas
                'top_seller_qty'    => max($soldQtys),
                'avg_sold_qty'      => round(array_sum($soldQtys) / count($soldQtys)),

                // Contenido
                'avg_pictures'      => round(array_sum($pictureCnts) / count($pictureCnts), 1),
                'max_pictures'      => max($pictureCnts),
                'avg_attributes'    => round(array_sum($attrCounts) / count($attrCounts), 1),

                // Logística MLV
                'logistics_stats'   => [
                    'ships_nationwide_pct' => round(($shipsNation / count($snapshots)) * 100),
                    'use_mrw_pct'          => round(($useMrw / count($snapshots)) * 100),
                    'use_zoom_pct'         => round(($useZoom / count($snapshots)) * 100),
                    'have_pickup_pct'      => round(($hasPickup / count($snapshots)) * 100),
                ],

                // Tipos de publicación predominantes
                'listing_types'     => $this->countListingTypes($snapshots),
            ],

            'competitors' => $snapshots,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DETECTAR CAMBIOS DE PRECIO Y GENERAR ALERTAS
    // ─────────────────────────────────────────────────────────
    private function detectPriceChanges(array $snapshot, ?string $ourSku): void
    {
        if (!$ourSku || !$snapshot['price_usd']) return;

        $yesterday = MlvPriceHistory::where('ml_item_id', $snapshot['ml_item_id'])
            ->where('recorded_date', now()->subDay()->toDateString())
            ->first();

        // Guardar precio de hoy
        MlvPriceHistory::updateOrCreate(
            [
                'ml_item_id'    => $snapshot['ml_item_id'],
                'recorded_date' => now()->toDateString(),
            ],
            [
                'seller_id'         => $snapshot['ml_seller_id'],
                'price_usd'         => $snapshot['price_usd'],
                'price_ves'         => $snapshot['price_ves'],
                'currency_id'       => $snapshot['currency_id'],
                'available_quantity'=> $snapshot['available_quantity'],
                'sold_quantity'     => $snapshot['sold_quantity'],
            ]
        );

        if (!$yesterday) return;

        $prevPrice = $yesterday->price_usd;
        $currPrice = $snapshot['price_usd'];

        if (!$prevPrice || !$currPrice) return;

        $changePct = (($currPrice - $prevPrice) / $prevPrice) * 100;

        // Solo alertar si el cambio es >= 5%
        if (abs($changePct) < 5) return;

        $alertType = $changePct < 0 ? 'price_drop' : 'price_increase';
        $severity  = abs($changePct) >= 15 ? 'high' : (abs($changePct) >= 8 ? 'medium' : 'low');

        MlvMarketAlert::create([
            'our_product_sku' => $ourSku,
            'alert_type'      => $alertType,
            'severity'        => $severity,
            'ml_item_id'      => $snapshot['ml_item_id'],
            'message'         => match($alertType) {
                'price_drop'     => "El competidor {$snapshot['seller_nickname']} bajó su precio "
                                  . round(abs($changePct), 1) . "% (de \${$prevPrice} a \${$currPrice})",
                'price_increase' => "El competidor {$snapshot['seller_nickname']} subió su precio "
                                  . round($changePct, 1) . "% — oportunidad de precio",
            },
            'details_json' => json_encode([
                'previous_price' => $prevPrice,
                'current_price'  => $currPrice,
                'change_pct'     => round($changePct, 2),
                'seller'         => $snapshot['seller_nickname'],
            ]),
        ]);
    }

    // ─────────────────────────────────────────────────────────
    // PERSISTENCIA
    // ─────────────────────────────────────────────────────────
    private function persistSnapshot(array $data): void
    {
        try {
            MlvCompetitorSnapshot::updateOrCreate(
                [
                    'ml_item_id'   => $data['ml_item_id'],
                    'search_date'  => now()->toDateString(),
                    'search_query' => $data['search_query'],
                ],
                $data
            );
        } catch (\Exception $e) {
            Log::warning('[MLV MarketSpy] Error al persistir snapshot: ' . $e->getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    private function buildCacheKey(string $query, string $sort, ?string $cat): string
    {
        return 'mlv_market:' . md5("{$query}|{$sort}|{$cat}");
    }

    private function formatListingType(string $type): string
    {
        return match($type) {
            'gold_pro'     => '⭐ Gold Pro',
            'gold_special' => '🥇 Gold Special',
            'gold'         => '🥈 Gold',
            'silver'       => '🥉 Silver',
            'bronze'       => '🔶 Bronze',
            'free'         => '🆓 Gratuita',
            default        => '❓ Desconocido',
        };
    }

    private function calcDiscount(array $item): ?float
    {
        $original = $item['original_price'] ?? null;
        $current  = $item['price']          ?? 0;

        if (!$original || $original <= 0 || $current <= 0) return null;

        return round((($original - $current) / $original) * 100, 1);
    }

    private function calcAttributeFillRate(array $attributes): float
    {
        if (empty($attributes)) return 0;

        $filled = count(array_filter($attributes, fn($a) => !empty($a['value_name'])));

        return round(($filled / count($attributes)) * 100, 1);
    }

    private function countListingTypes(array $snapshots): array
    {
        $counts = [];
        foreach ($snapshots as $s) {
            $type = $s['listing_type_id'] ?? 'unknown';
            $counts[$type] = ($counts[$type] ?? 0) + 1;
        }
        arsort($counts);
        return $counts;
    }

    private function median(array $values): float
    {
        sort($values);
        $n = count($values);
        return $n % 2 === 0
            ? ($values[$n/2 - 1] + $values[$n/2]) / 2
            : $values[intdiv($n, 2)];
    }
}
```

---

### 5.2 ScoreCard Service — Versión MLV (Sin Full/Flex)

```php
<?php

namespace App\Services\ListingSniper;

use App\Models\MlvListingScore;

class MlvScoreCardService
{
    // ─────────────────────────────────────────────────────────
    // PESOS ADAPTADOS A MLV (sin logística Full/Flex)
    // ─────────────────────────────────────────────────────────
    private array $weights = [
        'price'        => 28,   // El precio es el rey en MLV
        'title'        => 25,   // SEO del título
        'pictures'     => 20,   // Calidad visual
        'reputation'   => 15,   // Reputación del vendedor
        'listing_type' => 12,   // Gold Pro vs Free
    ];

    // Pesos del score de logística MLV (no entra en el total pero sí en alertas)
    private array $mlvLogisticsScore = [
        'ships_nationwide' => 30,
        'uses_mrw'         => 20,
        'uses_zoom'        => 20,
        'uses_tealca'      => 15,
        'own_delivery'     => 10,
        'has_pickup'       => 5,
    ];

    // ─────────────────────────────────────────────────────────
    // COMPARACIÓN PRINCIPAL
    // ─────────────────────────────────────────────────────────
    public function compare(array $ourItem, array $leaderSnapshot): array
    {
        $dimensions = [
            'price'        => $this->scorePrice($ourItem,       $leaderSnapshot),
            'title'        => $this->scoreTitle($ourItem,       $leaderSnapshot),
            'pictures'     => $this->scorePictures($ourItem,    $leaderSnapshot),
            'reputation'   => $this->scoreReputation($ourItem,  $leaderSnapshot),
            'listing_type' => $this->scoreListingType($ourItem, $leaderSnapshot),
            // Bonus/Info (no entra en score ponderado)
            'logistics'    => $this->scoreMlvLogistics($ourItem, $leaderSnapshot),
            'attributes'   => $this->scoreAttributes($ourItem,  $leaderSnapshot),
            'description'  => $this->scoreDescription($ourItem, $leaderSnapshot),
        ];

        $totalScore = $this->calculateWeighted($dimensions);
        $grade      = $this->getGrade($totalScore);
        $alerts     = $this->buildAlerts($ourItem, $leaderSnapshot, $dimensions);
        $actionPlan = $this->buildActionPlan($alerts);

        // Guardar el análisis
        MlvListingScore::create([
            'our_ml_item_id'        => $ourItem['id']                 ?? null,
            'our_product_sku'       => $ourItem['sku']                ?? null,
            'competitor_item_id'    => $leaderSnapshot['ml_item_id']  ?? null,
            'competitor_position'   => 1,
            'score_price'           => $dimensions['price']['score'],
            'score_title'           => $dimensions['title']['score'],
            'score_pictures'        => $dimensions['pictures']['score'],
            'score_reputation'      => $dimensions['reputation']['score'],
            'score_listing_type'    => $dimensions['listing_type']['score'],
            'total_score'           => $totalScore,
            'grade'                 => $grade['grade'],
            'our_price'             => $ourItem['price']              ?? null,
            'competitor_price'      => $leaderSnapshot['price_usd']   ?? null,
            'price_diff_pct'        => $dimensions['price']['diff_pct'] ?? 0,
            'alerts_json'           => json_encode($alerts),
            'action_plan_json'      => json_encode($actionPlan),
        ]);

        return [
            'total_score'    => $totalScore,
            'grade'          => $grade,
            'dimensions'     => $dimensions,
            'alerts'         => $alerts,
            'action_plan'    => $actionPlan,
            'market_context' => $this->buildMarketContext($ourItem, $leaderSnapshot),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE PRECIO — El más importante en MLV
    // ─────────────────────────────────────────────────────────
    private function scorePrice(array $our, array $leader): array
    {
        $ourPrice    = (float)($our['price']    ?? 0);
        $leaderPrice = (float)($leader['price_usd'] ?? 0);

        if ($leaderPrice <= 0) {
            return ['score' => 50, 'weight' => $this->weights['price'],
                    'diff_pct' => 0, 'status' => 'no_data'];
        }

        $diffPct = (($ourPrice - $leaderPrice) / $leaderPrice) * 100;

        // En MLV el comprador es muy sensible al precio
        $score = match(true) {
            $diffPct <= -10          => 100,  // Somos 10%+ más baratos → 🏆
            $diffPct > -10
                && $diffPct <= -3   => 90,   // Algo más baratos → excelente
            $diffPct > -3
                && $diffPct <= 3    => 75,   // Precio casi igual → bueno
            $diffPct > 3
                && $diffPct <= 8    => 55,   // Un poco más caro → aceptable
            $diffPct > 8
                && $diffPct <= 15   => 30,   // Más caro → problema
            $diffPct > 15
                && $diffPct <= 25   => 10,   // Muy caro → crítico
            default                 => 0,    // Fuera del mercado
        };

        $status = match(true) {
            $diffPct <= 0   => 'competitive',
            $diffPct <= 8   => 'acceptable',
            $diffPct <= 15  => 'expensive',
            default         => 'critical',
        };

        return [
            'score'         => $score,
            'weight'        => $this->weights['price'],
            'our_price'     => $ourPrice,
            'leader_price'  => $leaderPrice,
            'diff_pct'      => round($diffPct, 2),
            'diff_amount'   => round($ourPrice - $leaderPrice, 2),
            'status'        => $status,
            'currency'      => 'USD',  // MLV opera en USD de facto
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE TIPO DE PUBLICACIÓN — Específico MLV
    // ─────────────────────────────────────────────────────────
    private function scoreListingType(array $our, array $leader): array
    {
        // Jerarquía de tipos de publicación en MLV
        $hierarchy = [
            'gold_pro'     => 5,
            'gold_special' => 4,
            'gold'         => 3,
            'silver'       => 2,
            'bronze'       => 1,
            'free'         => 0,
        ];

        $ourType    = $our['listing_type_id']    ?? 'free';
        $leaderType = $leader['listing_type_id'] ?? 'gold_special';

        $ourLevel    = $hierarchy[$ourType]    ?? 0;
        $leaderLevel = $hierarchy[$leaderType] ?? 4;

        // Score basado en la diferencia de niveles
        $score = match(true) {
            $ourLevel >= $leaderLevel     => 100,   // Igual o mejor que el líder
            $ourLevel === $leaderLevel - 1 => 70,   // Un nivel abajo
            $ourLevel === $leaderLevel - 2 => 40,   // Dos niveles abajo
            $ourLevel === $leaderLevel - 3 => 20,   // Tres niveles abajo
            default                        => 5,    // Muy por debajo
        };

        return [
            'score'       => $score,
            'weight'      => $this->weights['listing_type'],
            'our_type'    => $ourType,
            'leader_type' => $leaderType,
            'our_level'   => $ourLevel,
            'leader_level'=> $leaderLevel,
            'our_label'   => $this->formatListingType($ourType),
            'leader_label'=> $this->formatListingType($leaderType),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE LOGÍSTICA MLV — Informativo, no entra en peso principal
    // ─────────────────────────────────────────────────────────
    private function scoreMlvLogistics(array $our, array $leader): array
    {
        // En MLV extraemos esto del item de ML del vendedor
        $ourShipping = $our['shipping'] ?? [];

        // Campos que podemos inferir de nuestro item de ML
        $ourNationwide = false; // Lo detectamos de nuestra descripción
        $ourMrw        = false;
        $ourZoom       = false;

        // Comparamos con el líder (que sí viene del snapshot)
        $leaderNationwide  = $leader['ships_nationwide']  ?? false;
        $leaderMrw         = $leader['uses_mrw']         ?? false;
        $leaderZoom        = $leader['uses_zoom']        ?? false;
        $leaderPickup      = $leader['has_pickup_point'] ?? false;

        // Score informativo de logística MLV
        $score = 0;
        if ($ourNationwide)  $score += 40;
        if ($ourMrw)         $score += 25;
        if ($ourZoom)        $score += 25;
        else                 $score += 10; // Mínimo por tener algo

        return [
            'score'              => $score,
            'weight'             => 0,      // No pondera en el total
            'is_informative'     => true,
            'leader_nationwide'  => $leaderNationwide,
            'leader_uses_mrw'    => $leaderMrw,
            'leader_uses_zoom'   => $leaderZoom,
            'leader_has_pickup'  => $leaderPickup,
            'leader_pickup_text' => $leader['pickup_locations'] ?? null,
            'note'               => 'MLV no tiene Full/Flex. La logística se gestiona manualmente.',
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE FOTOS — Crucial en MLV (la norma son fotos malas)
    // ─────────────────────────────────────────────────────────
    private function scorePictures(array $our, array $leader): array
    {
        $ourCount       = count($our['pictures']      ?? []);
        $leaderCount    = (int)($leader['picture_count'] ?? 0);
        $leaderHasVideo = (bool)($leader['has_video'] ?? false);
        $ourHasVideo    = in_array('has_video', $our['tags'] ?? []);

        // Score por cantidad vs el líder
        $qtyScore = match(true) {
            $ourCount >= $leaderCount + 2 => 50,    // Superamos al líder en fotos
            $ourCount === $leaderCount + 1 => 45,
            $ourCount === $leaderCount     => 40,
            $ourCount >= $leaderCount - 1  => 30,
            $ourCount >= $leaderCount - 3  => 20,
            default                        => 10,
        };

        // Score por mínimo de calidad en MLV
        // En MLV 5+ fotos ya te diferencia del 70% del mercado
        $minScore = match(true) {
            $ourCount >= 10 => 30,
            $ourCount >= 7  => 25,
            $ourCount >= 5  => 18,
            $ourCount >= 3  => 10,
            $ourCount >= 1  => 5,
            default         => 0,
        };

        // Bonus por video (raro en MLV → gran diferenciador)
        $videoScore = 0;
        if ($ourHasVideo && !$leaderHasVideo) $videoScore = 20;
        elseif ($ourHasVideo)                  $videoScore = 10;
        elseif ($leaderHasVideo && !$ourHasVideo) $videoScore = -5;

        $total = min(100, $qtyScore + $minScore + $videoScore);

        return [
            'score'             => max(0, $total),
            'weight'            => $this->weights['pictures'],
            'our_count'         => $ourCount,
            'leader_count'      => $leaderCount,
            'our_has_video'     => $ourHasVideo,
            'leader_has_video'  => $leaderHasVideo,
            'mlv_context'       => 'En MLV, tener 7+ fotos te diferencia del 70% del mercado',
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE REPUTACIÓN
    // ─────────────────────────────────────────────────────────
    private function scoreReputation(array $our, array $leader): array
    {
        $levelMap = [
            '5_green'       => 100,
            '4_light_green' => 80,
            '3_yellow'      => 55,
            '2_orange'      => 30,
            '1_red'         => 10,
            'new'           => 5,
        ];

        $ourLevelId    = $our['seller']['seller_reputation']['level_id'] ?? 'new';
        $leaderLevelId = $leader['seller_level_id'] ?? '5_green';

        $ourScore    = $levelMap[$ourLevelId]    ?? 5;
        $leaderScore = $levelMap[$leaderLevelId] ?? 100;

        // Score relativo: qué tan cerca estamos del líder
        $relativeScore = $leaderScore > 0
            ? min(100, intval(($ourScore / $leaderScore) * 100))
            : 100;

        return [
            'score'           => $relativeScore,
            'weight'          => $this->weights['reputation'],
            'our_level_id'    => $ourLevelId,
            'leader_level_id' => $leaderLevelId,
            'our_label'       => $this->formatReputation($ourLevelId),
            'leader_label'    => $this->formatReputation($leaderLevelId),
            'our_raw_score'   => $ourScore,
            'leader_raw_score'=> $leaderScore,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE TÍTULO
    // ─────────────────────────────────────────────────────────
    private function scoreTitle(array $our, array $leader): array
    {
        $ourTitle    = $our['title']   ?? '';
        $leaderTitle = $leader['title'] ?? '';

        $ourLen    = mb_strlen($ourTitle);
        $leaderLen = mb_strlen($leaderTitle);

        // Score de longitud
        $lengthScore = match(true) {
            $ourLen >= 55 && $ourLen <= 60 => 40,
            $ourLen >= 45 && $ourLen <= 60 => 35,
            $ourLen >= 35 && $ourLen <= 60 => 25,
            $ourLen > 60                   => 20,  // ML trunca
            $ourLen >= 20                  => 15,
            default                        => 5,
        };

        // Score comparativo vs el líder
        $compScore = 0;
        if ($ourLen >= $leaderLen)      $compScore = 30;
        elseif ($ourLen >= $leaderLen * 0.9) $compScore = 20;
        elseif ($ourLen >= $leaderLen * 0.7) $compScore = 10;

        // Penalización por mayúsculas incorrectas en MLV
        // Muchos vendedores VZ usan TODO EN MAYÚSCULAS
        $isCapsLock  = $ourTitle === mb_strtoupper($ourTitle);
        $capsScore   = $isCapsLock ? -10 : 20;

        // Penalización si tiene caracteres especiales raros
        $hasSpecial  = preg_match('/[!@#$%^&*(){}[\]|\\<>]/u', $ourTitle);
        $specialScore = $hasSpecial ? -10 : 10;

        $total = $lengthScore + $compScore + $capsScore + $specialScore;

        return [
            'score'        => min(100, max(0, $total)),
            'weight'       => $this->weights['title'],
            'our_title'    => $ourTitle,
            'leader_title' => $leaderTitle,
            'our_length'   => $ourLen,
            'leader_length'=> $leaderLen,
            'is_caps_lock' => $isCapsLock,
            'has_special'  => (bool)$hasSpecial,
            'ideal_length' => '55-60 caracteres',
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE ATRIBUTOS — Informativo
    // ─────────────────────────────────────────────────────────
    private function scoreAttributes(array $our, array $leader): array
    {
        $ourAttrs    = $our['attributes']  ?? [];
        $leaderAttrs = json_decode($leader['raw_attributes'] ?? '[]', true);

        $ourCount    = count($ourAttrs);
        $leaderCount = count($leaderAttrs);

        $ourIds    = array_column($ourAttrs,    'id');
        $leaderIds = array_column($leaderAttrs, 'id');
        $missing   = array_diff($leaderIds, $ourIds);

        $score = $leaderCount > 0
            ? min(100, intval(($ourCount / $leaderCount) * 100))
            : 100;

        // Atributos faltantes con sus valores del líder
        $leaderAttrMap   = array_column($leaderAttrs, null, 'id');
        $missingDetailed = [];
        foreach ($missing as $missingId) {
            if (isset($leaderAttrMap[$missingId])) {
                $missingDetailed[] = [
                    'id'          => $missingId,
                    'name'        => $leaderAttrMap[$missingId]['name']       ?? $missingId,
                    'leader_value'=> $leaderAttrMap[$missingId]['value_name'] ?? '?',
                ];
            }
        }

        return [
            'score'           => $score,
            'weight'          => 0,   // Informativo, no pondera en el total
            'our_count'       => $ourCount,
            'leader_count'    => $leaderCount,
            'missing_count'   => count($missing),
            'missing_attrs'   => array_slice($missingDetailed, 0, 8),
            'fill_rate'       => $leaderCount > 0
                ? round(($ourCount / $leaderCount) * 100, 1) . '%'
                : '100%',
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE DESCRIPCIÓN — Informativo
    // ─────────────────────────────────────────────────────────
    private function scoreDescription(array $our, array $leader): array
    {
        // Para nuestro item, la descripción vendrá de otro endpoint
        $ourWordCount    = $our['description_word_count'] ?? 0;
        $leaderWordCount = (int)($leader['description_word_count'] ?? 0);

        $score = match(true) {
            $ourWordCount >= 300  => 100,
            $ourWordCount >= 150  => 75,
            $ourWordCount >= 75   => 50,
            $ourWordCount >= 30   => 25,
            $ourWordCount > 0     => 10,
            default               => 0,
        };

        return [
            'score'              => $score,
            'weight'             => 0,  // Informativo
            'our_word_count'     => $ourWordCount,
            'leader_word_count'  => $leaderWordCount,
            'recommendation'     => $ourWordCount < 150
                ? 'Escribe una descripción de al menos 150 palabras con especificaciones técnicas'
                : null,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // ALERTAS ADAPTADAS A MLV
    // ─────────────────────────────────────────────────────────
    private function buildAlerts(array $our, array $leader, array $dimensions): array
    {
        $alerts = [];

        // ── Precio (crítico en MLV) ───────────────────────────
        $priceDiff = $dimensions['price']['diff_pct'] ?? 0;
        if ($priceDiff > 20) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Precio',
                'message' => "Tu precio está {$priceDiff}% por encima del líder. "
                           . "En Venezuela esto casi garantiza 0 ventas.",
                'action'  => "Reducir precio a máximo \${$dimensions['price']['leader_price']} USD "
                           . "o agregar valor diferencial justificado",
                'impact'  => 'critico',
            ];
        } elseif ($priceDiff > 10) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Precio',
                'message' => "Tu precio es {$priceDiff}% mayor al líder.",
                'action'  => "Ajustar precio o activar una promoción/descuento visible",
                'impact'  => 'muy_alto',
            ];
        } elseif ($priceDiff > 5) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Precio',
                'message' => "Precio {$priceDiff}% mayor al líder. Monitorear conversión.",
                'action'  => "Considera una pequeña reducción o agregar más fotos para justificarlo",
                'impact'  => 'medio',
            ];
        } elseif ($priceDiff <= -5) {
            $alerts[] = [
                'level'   => 'green',
                'icon'    => '🟢',
                'area'    => 'Precio',
                'message' => "¡Excelente! Tu precio es {$priceDiff}% más bajo que el líder.",
                'action'  => null,
                'impact'  => 'positivo',
            ];
        }

        // ── Tipo de publicación ───────────────────────────────
        $ourType    = $dimensions['listing_type']['our_type']    ?? 'free';
        $leaderType = $dimensions['listing_type']['leader_type'] ?? 'gold_special';

        if ($dimensions['listing_type']['score'] < 70) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Tipo de Publicación',
                'message' => "Tienes '{$this->formatListingType($ourType)}' pero el líder tiene '{$this->formatListingType($leaderType)}'.",
                'action'  => "Actualizar a Gold Special como mínimo para competir en visibilidad",
                'impact'  => 'muy_alto',
            ];
        }

        // ── Fotos ─────────────────────────────────────────────
        $ourPics    = $dimensions['pictures']['our_count']    ?? 0;
        $leaderPics = $dimensions['pictures']['leader_count'] ?? 0;

        if ($ourPics === 0) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Imágenes',
                'message' => "¡Sin fotos! Ningún comprador en Venezuela compra sin ver el producto.",
                'action'  => "Subir mínimo 5 fotos con fondo blanco, >1200px de resolución",
                'impact'  => 'critico',
            ];
        } elseif ($ourPics < $leaderPics) {
            $diff = $leaderPics - $ourPics;
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Imágenes',
                'message' => "Te faltan {$diff} foto(s) vs el líder ({$ourPics} vs {$leaderPics}).",
                'action'  => "Agregar {$diff} fotos más: ángulos, detalles, uso del producto",
                'impact'  => 'alto',
            ];
        } elseif ($ourPics >= $leaderPics + 2) {
            $alerts[] = [
                'level'   => 'green',
                'icon'    => '🟢',
                'area'    => 'Imágenes',
                'message' => "¡Superaste al líder en fotos! ({$ourPics} vs {$leaderPics})",
                'action'  => null,
                'impact'  => 'positivo',
            ];
        }

        // ── Video (gran diferenciador en MLV) ─────────────────
        $leaderHasVideo = $dimensions['pictures']['leader_has_video'] ?? false;
        $ourHasVideo    = $dimensions['pictures']['our_has_video']    ?? false;

        if (!$ourHasVideo) {
            $videoMsg = $leaderHasVideo
                ? "El líder tiene video y tú no. Los videos aumentan conversión ~20-25%."
                : "Ni tú ni el líder tienen video. ¡Enorme oportunidad de diferenciarte!";
            $alerts[] = [
                'level'   => $leaderHasVideo ? 'red' : 'yellow',
                'icon'    => $leaderHasVideo ? '🔴' : '🟡',
                'area'    => 'Video',
                'message' => $videoMsg,
                'action'  => "Grabar un video corto de 30-60 segundos mostrando el producto. "
                           . "Con el celular es suficiente si hay buena iluminación.",
                'impact'  => $leaderHasVideo ? 'alto' : 'medio',
            ];
        }

        // ── Reputación ────────────────────────────────────────
        if ($dimensions['reputation']['score'] < 40) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Reputación',
                'message' => "Tu reputación ({$dimensions['reputation']['our_label']}) "
                           . "es muy baja vs el líder ({$dimensions['reputation']['leader_label']}).",
                'action'  => "Completar ventas sin cancelaciones, responder rápido, "
                           . "pedir calificaciones a compradores anteriores",
                'impact'  => 'muy_alto',
            ];
        }

        // ── Título ────────────────────────────────────────────
        if ($dimensions['title']['is_caps_lock'] ?? false) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Título',
                'message' => "Título en MAYÚSCULAS completas. ML penaliza esto en el ranking.",
                'action'  => "Reescribir en formato normal: Primera Letra De Cada Palabra",
                'impact'  => 'alto',
            ];
        }

        if (($dimensions['title']['our_length'] ?? 0) < 35) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Título',
                'message' => "Título corto ({$dimensions['title']['our_length']} caracteres). "
                           . "El ideal es 55-60 caracteres.",
                'action'  => "Usar SEO Builder para extender el título con palabras clave del mercado",
                'impact'  => 'medio',
            ];
        }

        // ── Atributos ─────────────────────────────────────────
        $missingCount = $dimensions['attributes']['missing_count'] ?? 0;
        if ($missingCount > 0) {
            $missingNames = array_column(
                array_slice($dimensions['attributes']['missing_attrs'] ?? [], 0, 3),
                'name'
            );
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Ficha Técnica',
                'message' => "Faltan {$missingCount} atributos que el líder tiene completos.",
                'action'  => "Completar: " . implode(', ', $missingNames)
                           . ($missingCount > 3 ? " y " . ($missingCount - 3) . " más." : "."),
                'impact'  => 'medio',
            ];
        }

        // ── Logística MLV ─────────────────────────────────────
        $leaderNationwide = $dimensions['logistics']['leader_nationwide'] ?? false;
        if ($leaderNationwide) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Cobertura',
                'message' => "El líder anuncia envíos a todo el país. "
                           . "Expande tu cobertura geográfica para no perder ventas.",
                'action'  => "Mencionar en la descripción los estados donde haces envíos "
                           . "y los transportistas que usas (MRW, Zoom, Tealca)",
                'impact'  => 'medio',
            ];
        }

        // ── Descripción ───────────────────────────────────────
        if (($dimensions['description']['our_word_count'] ?? 0) < 75) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Descripción',
                'message' => "Descripción muy corta. Una buena descripción aumenta "
                           . "la confianza del comprador venezolano.",
                'action'  => "Escribir descripción detallada: especificaciones, "
                           . "compatibilidades, métodos de pago aceptados (Zelle, Binance, "
                           . "Pago Móvil), zonas de envío",
                'impact'  => 'medio',
            ];
        }

        // Ordenar: crítico → rojo → amarillo → verde
        $levelOrder = ['critico' => -1, 'red' => 0, 'yellow' => 1, 'green' => 2];
        usort($alerts, fn($a, $b) =>
            ($levelOrder[$a['level']] ?? 1) <=> ($levelOrder[$b['level']] ?? 1)
        );

        return $alerts;
    }

    // ─────────────────────────────────────────────────────────
    // PLAN DE ACCIÓN PRIORIZADO
    // ─────────────────────────────────────────────────────────
    private function buildActionPlan(array $alerts): array
    {
        $impactOrder = ['critico' => 0, 'muy_alto' => 1, 'alto' => 2, 'medio' => 3, 'bajo' => 4];

        $actionableAlerts = array_filter(
            $alerts,
            fn($a) => !empty($a['action']) && $a['level'] !== 'green'
        );

        usort($actionableAlerts, fn($a, $b) =>
            ($impactOrder[$a['impact']] ?? 5) <=> ($impactOrder[$b['impact']] ?? 5)
        );

        $plan = [];
        foreach (array_values($actionableAlerts) as $i => $alert) {
            $plan[] = [
                'step'        => $i + 1,
                'area'        => $alert['area'],
                'action'      => $alert['action'],
                'impact'      => $alert['impact'],
                'icon'        => $alert['icon'],
                'estimated_improvement' => $this->estimateImprovement($alert['impact']),
            ];
        }

        return $plan;
    }

    // ─────────────────────────────────────────────────────────
    // CONTEXTO DE MERCADO MLV
    // ─────────────────────────────────────────────────────────
    private function buildMarketContext(array $our, array $leader): array
    {
        return [
            'mlv_notes' => [
                'currency'  => 'Venezuela opera en USD de facto desde 2019',
                'logistics' => 'No existe Full/Flex. La logística es manual (MRW, Zoom, delivery propio)',
                'payments'  => 'Los compradores pagan por Zelle, Binance, Pago Móvil o efectivo USD',
                'photos'    => 'El estándar de fotos en MLV es bajo → tener 7+ fotos ya te destaca',
                'video'     => 'Los videos son muy raros en MLV → gran ventaja competitiva',
            ],
            'our_listing_type'   => $our['listing_type_id']    ?? 'unknown',
            'leader_listing_type'=> $leader['listing_type_id'] ?? 'unknown',
        ];
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    private function calculateWeighted(array $dimensions): int
    {
        $total = 0;
        foreach ($this->weights as $dim => $weight) {
            $score  = $dimensions[$dim]['score'] ?? 0;
            $total += ($score * $weight) / 100;
        }
        return (int) round($total);
    }

    private function getGrade(int $score): array
    {
        return match(true) {
            $score >= 90 => ['grade' => 'A+', 'label' => '🏆 Publicación Líder',      'color' => '#00C853'],
            $score >= 80 => ['grade' => 'A',  'label' => '💪 Muy Competitiva',        'color' => '#64DD17'],
            $score >= 70 => ['grade' => 'B',  'label' => '📈 Competitiva',            'color' => '#2196F3'],
            $score >= 60 => ['grade' => 'C',  'label' => '⚠️ Necesita Mejoras',       'color' => '#FFC107'],
            $score >= 40 => ['grade' => 'D',  'label' => '🔻 En Riesgo de Invisibilidad', 'color' => '#FF5722'],
            default      => ['grade' => 'F',  'label' => '🚨 Publicación Invisible',  'color' => '#D32F2F'],
        };
    }

    private function estimateImprovement(string $impact): string
    {
        return match($impact) {
            'critico'  => '+20-30 puntos al score',
            'muy_alto' => '+10-20 puntos al score',
            'alto'     => '+5-10 puntos al score',
            'medio'    => '+2-5 puntos al score',
            default    => '+1-2 puntos al score',
        };
    }

    private function formatListingType(string $type): string
    {
        return match($type) {
            'gold_pro'     => '⭐ Gold Pro',
            'gold_special' => '🥇 Gold Special',
            'gold'         => '🥈 Gold',
            'silver'       => '🥉 Silver',
            'bronze'       => '🔶 Bronze',
            'free'         => '🆓 Gratuita',
            default        => '❓ Desconocido',
        };
    }

    private function formatReputation(string $level): string
    {
        return match($level) {
            '5_green'       => '🟢 Nivel 5 — Excelente',
            '4_light_green' => '🟢 Nivel 4 — Muy Bueno',
            '3_yellow'      => '🟡 Nivel 3 — Bueno',
            '2_orange'      => '🟠 Nivel 2 — Regular',
            '1_red'         => '🔴 Nivel 1 — Malo',
            'new'           => '🆕 Nuevo vendedor',
            default         => '❓ Sin dato',
        ];
    }
}
```

---

## 6. Manejo de Monedas en MLV {#monedas}

```php
<?php

namespace App\Services\ListingSniper;

use Illuminate\Support\Facades\{Http, Cache};

class MlvCurrencyService
{
    // ─────────────────────────────────────────────────────────
    // En MLV los precios pueden estar en USD o VES
    // Necesitamos normalizar todo a USD para comparar
    // ─────────────────────────────────────────────────────────

    private const CACHE_TTL = 3600; // 1 hora para el tipo de cambio

    // Fuente de tipo de cambio: BCV o paralelo
    public function getExchangeRate(): float
    {
        return Cache::remember('mlv_exchange_rate_usd_ves', self::CACHE_TTL, function () {
            // Intentar obtener el tipo de cambio del BCV
            // En producción usar una API de tipo de cambio venezolana
            // Opciones: dolartoday, monitordolarvenezuela, etc.
            try {
                $response = Http::timeout(5)
                    ->get('https://pydolarve.org/api/v1/dollar?monitor=bcv');

                if ($response->successful()) {
                    return (float) $response->json('price', 36.0);
                }
            } catch (\Exception) {
                // Fallback al valor guardado en config
            }

            return (float) config('mlv.exchange_rate_fallback', 36.0);
        });
    }

    // Normalizar precio a USD
    public function normalizeToUsd(float $price, string $currencyId): float
    {
        if ($currencyId === 'USD') return $price;

        // VES a USD
        $rate = $this->getExchangeRate();
        return $rate > 0 ? round($price / $rate, 2) : $price;
    }

    // Detectar si un precio "en VES" es realmente muy bajo
    // (algunos vendedores ponen el precio sin actualizar)
    public function isPriceSuspicious(float $price, string $currencyId): bool
    {
        if ($currencyId !== 'VES') return false;

        $usdEquivalent = $this->normalizeToUsd($price, $currencyId);

        // Si el equivalente en USD es < $0.10 o > $100,000, es sospechoso
        return $usdEquivalent < 0.10 || $usdEquivalent > 100000;
    }
}
```

---

## 7. Categorías Calientes de MLV {#categorias}

```php
<?php

// config/mlv_categories.php
// Categorías de mayor movimiento en MLV
// (para el selector de búsqueda en el módulo)

return [
    'hot_categories' => [

        // ── Electrónica ──────────────────────────────────────
        'MLV1051' => [
            'name'     => 'Celulares y Telefonía',
            'emoji'    => '📱',
            'avg_daily_listings' => 'alto',
        ],
        'MLV1648' => [
            'name'     => 'Computación',
            'emoji'    => '💻',
            'avg_daily_listings' => 'alto',
        ],

        // ── Automotriz ───────────────────────────────────────
        'MLV1747' => [
            'name'     => 'Accesorios para Vehículos',
            'emoji'    => '🚗',
            'avg_daily_listings' => 'muy_alto',
        ],
        'MLV3697' => [
            'name'     => 'Baterías para Autos',
            'emoji'    => '🔋',
            'avg_daily_listings' => 'alto',
        ],

        // ── Hogar ─────────────────────────────────────────────
        'MLV1574' => [
            'name'     => 'Electrodomésticos',
            'emoji'    => '🏠',
            'avg_daily_listings' => 'alto',
        ],

        // ── Herramientas ─────────────────────────────────────
        'MLV1459' => [
            'name'     => 'Herramientas y Construcción',
            'emoji'    => '🔧',
            'avg_daily_listings' => 'medio',
        ],

        // ── Industria ─────────────────────────────────────────
        'MLV1499' => [
            'name'     => 'Industria y Oficina',
            'emoji'    => '🏭',
            'avg_daily_listings' => 'medio',
        ],
    ],

    // Palabras clave de alto volumen en MLV
    // (para sugerir queries de búsqueda al usuario)
    'high_volume_terms' => [
        'celular', 'laptop', 'batería', 'pantalla', 'cargador',
        'televisor', 'nevera', 'lavadora', 'aire acondicionado',
        'repuesto', 'aceite motor', 'filtro', 'llanta', 'rim',
        'panel solar', 'inversor', 'ups', 'regulador de voltaje',
    ],

    // Nota: Los IDs de categoría de MLV se verifican con:
    // GET https://api.mercadolibre.com/sites/MLV/categories
];
```

---

## 📊 Resumen Visual Final — Sistema MLV

```
╔═══════════════════════════════════════════════════════════════════╗
║           LISTING SNIPER — MERCADOLIBRE VENEZUELA (MLV)           ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  REALIDAD MLV que CAMBIA TODO:                                     ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━                                       ║
║  ❌ Sin Full/Flex  → El factor de logística NO aplica              ║
║  💵 Todo en USD   → Normalizar precios en VES                      ║
║  📦 Envíos manual → Detectar MRW/Zoom/Tealca del texto            ║
║  📸 Fotos escasas → 7+ fotos ya te destaca del 70%               ║
║  🎥 Sin videos    → Enorme oportunidad diferenciadora             ║
║                                                                    ║
║  PESOS DEL SCORE MLV:                                              ║
║  ━━━━━━━━━━━━━━━━━━━                                               ║
║  💰 Precio          28% ████████████████████████████              ║
║  🔤 Título SEO      25% █████████████████████████                 ║
║  📸 Fotos           20% ████████████████████                      ║
║  ⭐ Reputación      15% ███████████████                           ║
║  🏷️  Tipo Pub.       12% ████████████                              ║
║                                                                    ║
║  ALERTAS ESPECÍFICAS DE MLV:                                       ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━                                        ║
║  🔴 Precio > 10% del líder    → Ventas prácticamente 0            ║
║  🔴 Título en MAYÚSCULAS      → ML penaliza en ranking            ║
║  🔴 Menos de 3 fotos          → Desconfianza del comprador        ║
║  🟡 Sin MRW/Zoom en desc.     → Limita alcance geográfico         ║
║  🟡 Descripción < 75 palabras → Baja confianza del comprador      ║
║  🟢 Tiene video               → Diferenciador masivo en MLV       ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

> **🎯 Punto Clave**: En MLV no ganamos con logística (no existe Full). Ganamos con **precio competitivo + fotos de calidad + tipo de publicación Gold + descripción que transmita confianza** (métodos de pago, zonas de envío, garantía). Esos son los 4 pilares reales del mercado venezolano.