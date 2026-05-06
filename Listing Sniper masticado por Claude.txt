# 🎯 Listing Sniper - Plan Técnico Completo

## Investigación Previa y Arquitectura del Sistema

---

## 📋 Índice

1. [Investigación del Algoritmo ML](#investigación)
2. [Arquitectura del Sistema](#arquitectura)
3. [Estructura de Base de Datos](#base-de-datos)
4. [Plan de Implementación por Fases](#fases)
5. [Código Base de Cada Módulo](#código)
6. [Flujo de Datos Completo](#flujo)

---

## 1. Investigación del Algoritmo ML {#investigación}

### 1.1 Factores de Ranking Confirmados (Ingeniería Inversa)

```
PESO ESTIMADO DEL ALGORITMO ML:
├── Logística (Full/Flex)          → 30% del score
├── Tasa de Conversión (CVR)       → 25% del score
├── Relevancia del Título          → 20% del score
├── Reputación del Vendedor        → 15% del score
└── Completitud de Ficha Técnica   → 10% del score
```

### 1.2 Endpoints de la API de ML que Usaremos

```
ENDPOINTS IDENTIFICADOS (MLV = Venezuela):
│
├── BÚSQUEDA
│   └── GET /sites/MLV/search?q={query}&sort=sold_quantity_desc&limit=10
│
├── DETALLE DE ITEM
│   ├── GET /items/{item_id}
│   ├── GET /items/{item_id}/description
│   └── GET /items?ids={id1},{id2},{id3}  → Batch (hasta 20 items)
│
├── CATEGORÍAS Y ATRIBUTOS
│   ├── GET /categories/{category_id}/attributes
│   └── GET /sites/MLV/domain_discovery?q={query}
│
├── IMÁGENES
│   └── Las URLs vienen en el item, dominio: http://mco-s2-p.mlstatic.com
│
├── TENDENCIAS
│   └── GET /trends/MLV  (búsquedas trending)
│
└── PREDICTOR DE CATEGORÍA
    └── GET /sites/MLV/category_predictor/predict?title={title}
```

### 1.3 Estructura JSON de un Item Líder (Referencia)

```json
{
  "id": "MLV123456789",
  "title": "Batería de Auto 12v 60ah Full Energy Para Toyota Corolla",
  "price": 45.00,
  "sold_quantity": 342,
  "available_quantity": 150,
  "condition": "new",
  "listing_type_id": "gold_special",
  "shipping": {
    "free_shipping": true,
    "mode": "me2",
    "logistic_type": "fulfillment"
  },
  "seller": {
    "id": 12345,
    "nickname": "LIDER_STORE",
    "seller_reputation": {
      "level_id": "5_green",
      "transactions": { "completed": 1250 }
    }
  },
  "pictures": [
    { "id": "pic1", "url": "https://..." }
  ],
  "attributes": [
    { "id": "BRAND", "name": "Marca", "value_name": "Full Energy" },
    { "id": "MODEL", "name": "Modelo", "value_name": "FE-60" },
    { "id": "VOLTAGE", "name": "Voltaje", "value_name": "12 V" }
  ],
  "category_id": "MLV1234",
  "tags": ["good_seller", "immediate_payment"]
}
```

---

## 2. Arquitectura del Sistema {#arquitectura}

```
┌─────────────────────────────────────────────────────────────────┐
│                    LISTING SNIPER SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   FRONTEND   │    │   BACKEND    │    │  SERVICIOS EXT.  │   │
│  │  (Next.js)   │◄──►│  (Laravel)  │◄──►│                  │   │
│  │              │    │              │    │  ┌─────────────┐ │   │
│  │ • ScoreCard  │    │ • API Routes │    │  │  ML API v2  │ │   │
│  │ • Comparador │    │ • Jobs Queue │    │  └─────────────┘ │   │
│  │ • SEO Bldg   │    │ • Cache      │    │  ┌─────────────┐ │   │
│  │ • Img Viewer │    │ • Scheduler  │    │  │  OpenAI API │ │   │
│  └──────────────┘    └──────────────┘    │  └─────────────┘ │   │
│                            │             │  ┌─────────────┐ │   │
│                     ┌──────┴──────┐      │  │ Profit Plus │ │   │
│                     │  BASE DATOS │      │  │    Data     │ │   │
│                     │            │      │  └─────────────┘ │   │
│                     │ PostgreSQL  │      └──────────────────┘   │
│                     │   + Redis   │                              │
│                     └────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Módulos del Sistema

```
LISTING SNIPER
├── 📡 MarketSpy         → Búsqueda y extracción de competencia
├── 🏆 SEOBuilder        → Optimizador de títulos
├── 📋 FeatureCloner     → Clonador de características
├── ⚖️  TheBench          → Comparador de posicionamiento
├── 📸 ImageManager      → Gestor de imágenes
├── 🤖 AIWriter          → Redactor con GPT-4
└── 📊 ScoreCard         → Calificador de publicación (0-100)
```

---

## 3. Estructura de Base de Datos {#base-de-datos}

```sql
-- ============================================================
-- TABLA: competitor_snapshots
-- Guarda la "foto" del competidor en el momento del análisis
-- ============================================================
CREATE TABLE competitor_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    
    -- Contexto de búsqueda
    search_query        VARCHAR(255) NOT NULL,
    search_date         TIMESTAMP DEFAULT NOW(),
    
    -- Identificación del competidor
    ml_item_id          VARCHAR(20) NOT NULL,
    ml_seller_id        BIGINT,
    seller_nickname     VARCHAR(100),
    seller_level        VARCHAR(20),          -- '5_green', '4_light_green'
    
    -- Datos de la publicación
    title               VARCHAR(255),
    price               DECIMAL(12,2),
    currency_id         VARCHAR(5) DEFAULT 'USD',
    sold_quantity       INTEGER DEFAULT 0,
    available_quantity  INTEGER DEFAULT 0,
    listing_type        VARCHAR(30),          -- 'gold_special', 'gold_pro'
    condition           VARCHAR(10),          -- 'new', 'used'
    category_id         VARCHAR(20),
    
    -- Logística
    free_shipping       BOOLEAN DEFAULT false,
    logistic_type       VARCHAR(30),          -- 'fulfillment', 'cross_docking'
    
    -- Calidad de contenido
    picture_count       INTEGER DEFAULT 0,
    has_video           BOOLEAN DEFAULT false,
    has_description     BOOLEAN DEFAULT false,
    attribute_count     INTEGER DEFAULT 0,
    
    -- Posición en búsqueda
    search_position     INTEGER,
    
    -- Datos raw para análisis
    raw_attributes      JSONB,
    raw_pictures        JSONB,
    description_text    TEXT,
    
    -- Control
    our_product_sku     VARCHAR(100),        -- El SKU de Profit Plus que originó la búsqueda
    
    UNIQUE(ml_item_id, search_date::DATE)
);

-- ============================================================
-- TABLA: title_analysis
-- Análisis SEO de títulos de competidores
-- ============================================================
CREATE TABLE title_analysis (
    id                  BIGSERIAL PRIMARY KEY,
    snapshot_id         BIGINT REFERENCES competitor_snapshots(id),
    
    -- Palabras clave extraídas
    keywords            JSONB,              -- [{"word": "batería", "frequency": 8, "position": 1}]
    
    -- Título sugerido por el sistema
    suggested_title     VARCHAR(255),
    suggested_title_v2  VARCHAR(255),        -- Versión mejorada con GPT
    
    -- Score del título original vs sugerido
    original_score      INTEGER,             -- 0-100
    suggested_score     INTEGER,             -- 0-100
    
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLA: listing_scores
-- ScoreCard de nuestras publicaciones vs la competencia
-- ============================================================
CREATE TABLE listing_scores (
    id                  BIGSERIAL PRIMARY KEY,
    our_ml_item_id      VARCHAR(20),
    competitor_item_id  VARCHAR(20),
    analysis_date       TIMESTAMP DEFAULT NOW(),
    
    -- Scores por categoría (0-100 cada uno)
    score_title         INTEGER,
    score_pictures      INTEGER,
    score_attributes    INTEGER,
    score_price         INTEGER,
    score_logistics     INTEGER,
    score_reputation    INTEGER,
    
    -- Score total ponderado
    total_score         INTEGER,
    
    -- Diagnósticos detallados
    diagnostics         JSONB,
    /*
    Ejemplo de diagnostics:
    {
        "alerts": [
            {"level": "red", "message": "Tu precio es 18% mayor al líder"},
            {"level": "yellow", "message": "Faltan 4 atributos obligatorios"},
            {"level": "green", "message": "Título más descriptivo que el líder"}
        ],
        "recommendations": [
            "Activar envío Full para mejorar posición",
            "Agregar atributos: Voltaje, Amperaje, Polaridad"
        ]
    }
    */
    
    -- Acción tomada por el usuario
    action_taken        VARCHAR(50),         -- 'title_updated', 'price_adjusted', etc.
    action_date         TIMESTAMP
);

-- ============================================================
-- TABLA: image_library
-- Biblioteca de imágenes recolectadas de ML
-- ============================================================
CREATE TABLE image_library (
    id                  BIGSERIAL PRIMARY KEY,
    snapshot_id         BIGINT REFERENCES competitor_snapshots(id),
    
    ml_picture_id       VARCHAR(50),
    original_url        TEXT,
    local_path          TEXT,               -- Si la descargamos localmente
    
    -- Análisis de calidad
    width               INTEGER,
    height              INTEGER,
    has_white_bg        BOOLEAN,
    quality_score       INTEGER,            -- 0-100
    
    is_downloaded       BOOLEAN DEFAULT false,
    download_date       TIMESTAMP
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX idx_snapshots_sku      ON competitor_snapshots(our_product_sku);
CREATE INDEX idx_snapshots_date     ON competitor_snapshots(search_date);
CREATE INDEX idx_snapshots_sold     ON competitor_snapshots(sold_quantity DESC);
CREATE INDEX idx_scores_item        ON listing_scores(our_ml_item_id);
CREATE INDEX idx_snapshots_attrs    ON competitor_snapshots USING GIN(raw_attributes);
```

---

## 4. Plan de Implementación por Fases {#fases}

```
CRONOGRAMA DE DESARROLLO
════════════════════════════════════════════════════════════

FASE 1 — NÚCLEO (Semana 1-2)
┌─────────────────────────────────────────────────────────┐
│ ✅ MarketSpy: Búsqueda y extracción de datos            │
│ ✅ Base de datos: Tablas principales                    │
│ ✅ Cache con Redis (TTL: 4 horas por búsqueda)          │
│ ✅ Manejo de rate limiting de ML API                    │
└─────────────────────────────────────────────────────────┘

FASE 2 — INTELIGENCIA (Semana 3-4)
┌─────────────────────────────────────────────────────────┐
│ ✅ SEOBuilder: Análisis de palabras clave               │
│ ✅ FeatureCloner: Extracción y limpieza de atributos    │
│ ✅ ScoreCard: Sistema de puntuación 0-100               │
│ ✅ TheBench: Vista comparativa                          │
└─────────────────────────────────────────────────────────┘

FASE 3 — UI/UX (Semana 5-6)
┌─────────────────────────────────────────────────────────┐
│ ✅ Dashboard ScoreCard con semáforos                    │
│ ✅ Visualizador de imágenes de competencia              │
│ ✅ Panel de comparación lado a lado                     │
│ ✅ Exportar análisis a PDF/Excel                        │
└─────────────────────────────────────────────────────────┘

FASE 4 — IA (Semana 7-8)
┌─────────────────────────────────────────────────────────┐
│ ✅ Integración GPT-4 para copywriting                   │
│ ✅ Reescritura automática de descripciones              │
│ ✅ Sugerencias de precio basadas en mercado             │
│ ✅ Alertas automáticas cuando la competencia baja precio│
└─────────────────────────────────────────────────────────┘
```

---

## 5. Código Base de Cada Módulo {#código}

### 5.1 Servicio Principal: MarketSpy

```php
<?php

namespace App\Services\ListingSniper;

use App\Models\CompetitorSnapshot;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class MarketSpyService
{
    // ─────────────────────────────────────────────────────────
    // CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────
    private string $baseUrl    = 'https://api.mercadolibre.com';
    private string $site       = 'MLV';
    private int    $cacheTtl   = 14400;   // 4 horas en segundos
    private int    $rateDelay  = 200;     // ms entre requests
    private int    $topResults = 10;

    public function __construct(
        private readonly string $accessToken
    ) {}

    // ─────────────────────────────────────────────────────────
    // MÉTODO PRINCIPAL: Analizar mercado para un SKU/Query
    // ─────────────────────────────────────────────────────────
    public function analyzeMarket(string $query, string $ourSku = null): array
    {
        $cacheKey = "market_spy:{$this->site}:" . md5($query);

        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($query, $ourSku) {

            Log::info("MarketSpy: Analizando '{$query}'");

            // 1. Buscar los top items
            $searchResults = $this->searchTopItems($query);

            if (empty($searchResults)) {
                return ['error' => 'No se encontraron resultados', 'query' => $query];
            }

            // 2. Obtener detalle completo de cada item (batch)
            $itemIds      = array_column($searchResults, 'id');
            $itemDetails  = $this->getItemsBatch($itemIds);
            $descriptions = $this->getDescriptionsBatch($itemIds);

            // 3. Construir el snapshot de cada competidor
            $snapshots = [];
            foreach ($itemDetails as $index => $item) {
                $snapshot = $this->buildSnapshot(
                    item:        $item,
                    description: $descriptions[$item['id']] ?? null,
                    position:    $index + 1,
                    query:       $query,
                    ourSku:      $ourSku
                );

                // 4. Persistir en la base de datos
                CompetitorSnapshot::updateOrCreate(
                    [
                        'ml_item_id'  => $snapshot['ml_item_id'],
                        'search_date' => now()->toDateString(),
                    ],
                    $snapshot
                );

                $snapshots[] = $snapshot;
            }

            // 5. Construir resumen del mercado
            return $this->buildMarketSummary($snapshots, $query);
        });
    }

    // ─────────────────────────────────────────────────────────
    // BÚSQUEDA: Top items ordenados por más vendidos
    // ─────────────────────────────────────────────────────────
    private function searchTopItems(string $query): array
    {
        $response = Http::withToken($this->accessToken)
            ->timeout(15)
            ->get("{$this->baseUrl}/sites/{$this->site}/search", [
                'q'      => $query,
                'sort'   => 'sold_quantity_desc',
                'limit'  => $this->topResults,
                'offset' => 0,
            ]);

        if (!$response->successful()) {
            Log::error("MarketSpy Search Error: " . $response->body());
            return [];
        }

        return $response->json('results', []);
    }

    // ─────────────────────────────────────────────────────────
    // BATCH: Obtener múltiples items en una sola llamada
    // Aprovechamos el endpoint multi-get de ML (hasta 20 ids)
    // ─────────────────────────────────────────────────────────
    private function getItemsBatch(array $itemIds): array
    {
        // ML permite hasta 20 items por batch
        $chunks  = array_chunk($itemIds, 20);
        $results = [];

        foreach ($chunks as $chunk) {
            usleep($this->rateDelay * 1000); // Respetar rate limit

            $response = Http::withToken($this->accessToken)
                ->timeout(20)
                ->get("{$this->baseUrl}/items", [
                    'ids'        => implode(',', $chunk),
                    'attributes' => 'id,title,price,sold_quantity,available_quantity,'
                                  . 'condition,listing_type_id,shipping,seller,'
                                  . 'pictures,attributes,category_id,tags,'
                                  . 'health,permalink',
                ]);

            if ($response->successful()) {
                foreach ($response->json() as $itemWrapper) {
                    // El batch devuelve {code: 200, body: {...}}
                    if (($itemWrapper['code'] ?? 0) === 200) {
                        $results[] = $itemWrapper['body'];
                    }
                }
            }
        }

        return $results;
    }

    // ─────────────────────────────────────────────────────────
    // DESCRIPCIONES: Obtener en batch (una por una, son baratas)
    // ─────────────────────────────────────────────────────────
    private function getDescriptionsBatch(array $itemIds): array
    {
        $descriptions = [];

        foreach ($itemIds as $itemId) {
            usleep($this->rateDelay * 1000);

            $response = Http::withToken($this->accessToken)
                ->timeout(10)
                ->get("{$this->baseUrl}/items/{$itemId}/description");

            if ($response->successful()) {
                $descriptions[$itemId] = $response->json('plain_text', '');
            }
        }

        return $descriptions;
    }

    // ─────────────────────────────────────────────────────────
    // CONSTRUCTOR: Armar el objeto snapshot normalizado
    // ─────────────────────────────────────────────────────────
    private function buildSnapshot(
        array   $item,
        ?string $description,
        int     $position,
        string  $query,
        ?string $ourSku
    ): array {
        $shipping = $item['shipping'] ?? [];
        $seller   = $item['seller']   ?? [];
        $pictures = $item['pictures'] ?? [];
        $attrs    = $item['attributes'] ?? [];

        return [
            'search_query'      => $query,
            'our_product_sku'   => $ourSku,
            'ml_item_id'        => $item['id'],
            'ml_seller_id'      => $seller['id'] ?? null,
            'seller_nickname'   => $seller['nickname'] ?? null,
            'seller_level'      => $seller['seller_reputation']['level_id'] ?? null,

            'title'             => $item['title'] ?? null,
            'price'             => $item['price'] ?? 0,
            'currency_id'       => $item['currency_id'] ?? 'USD',
            'sold_quantity'     => $item['sold_quantity'] ?? 0,
            'available_quantity'=> $item['available_quantity'] ?? 0,
            'listing_type'      => $item['listing_type_id'] ?? null,
            'condition'         => $item['condition'] ?? 'new',
            'category_id'       => $item['category_id'] ?? null,

            'free_shipping'     => $shipping['free_shipping'] ?? false,
            'logistic_type'     => $shipping['logistic_type'] ?? 'not_specified',

            'picture_count'     => count($pictures),
            'has_video'         => in_array('has_video', $item['tags'] ?? []),
            'has_description'   => !empty($description),
            'attribute_count'   => count($attrs),

            'search_position'   => $position,

            'raw_attributes'    => json_encode($attrs),
            'raw_pictures'      => json_encode($pictures),
            'description_text'  => $description,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // RESUMEN: Calcular estadísticas del mercado
    // ─────────────────────────────────────────────────────────
    private function buildMarketSummary(array $snapshots, string $query): array
    {
        if (empty($snapshots)) {
            return [];
        }

        $prices       = array_column($snapshots, 'price');
        $soldQtys     = array_column($snapshots, 'sold_quantity');
        $pictureCnts  = array_column($snapshots, 'picture_count');
        $attrCounts   = array_column($snapshots, 'attribute_count');

        $leader = $snapshots[0]; // El #1 ya viene ordenado por ventas

        return [
            'query'        => $query,
            'analyzed_at'  => now()->toIso8601String(),
            'total_found'  => count($snapshots),

            // El líder indiscutible
            'leader' => [
                'item_id'        => $leader['ml_item_id'],
                'title'          => $leader['title'],
                'price'          => $leader['price'],
                'sold_quantity'  => $leader['sold_quantity'],
                'seller'         => $leader['seller_nickname'],
                'seller_level'   => $leader['seller_level'],
                'logistics'      => $leader['logistic_type'],
                'free_shipping'  => $leader['free_shipping'],
                'picture_count'  => $leader['picture_count'],
                'has_video'      => $leader['has_video'],
                'attribute_count'=> $leader['attribute_count'],
                'listing_type'   => $leader['listing_type'],
            ],

            // Estadísticas del mercado
            'market_stats' => [
                'avg_price'        => round(array_sum($prices) / count($prices), 2),
                'min_price'        => min($prices),
                'max_price'        => max($prices),
                'median_price'     => $this->calculateMedian($prices),
                'top_seller_qty'   => max($soldQtys),
                'avg_pictures'     => round(array_sum($pictureCnts) / count($pictureCnts), 1),
                'avg_attributes'   => round(array_sum($attrCounts) / count($attrCounts), 1),
                'pct_free_ship'    => $this->calculatePercentage($snapshots, 'free_shipping'),
                'pct_fulfillment'  => $this->calculatePercentageValue(
                                        $snapshots, 'logistic_type', 'fulfillment'
                                     ),
            ],

            // Todos los competidores para el comparador
            'competitors' => $snapshots,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    private function calculateMedian(array $values): float
    {
        sort($values);
        $count = count($values);
        $mid   = intdiv($count, 2);

        return $count % 2 === 0
            ? ($values[$mid - 1] + $values[$mid]) / 2
            : $values[$mid];
    }

    private function calculatePercentage(array $snapshots, string $field): float
    {
        $trueCount = count(array_filter($snapshots, fn($s) => $s[$field] === true));
        return round(($trueCount / count($snapshots)) * 100, 1);
    }

    private function calculatePercentageValue(array $snapshots, string $field, string $value): float
    {
        $matchCount = count(array_filter($snapshots, fn($s) => $s[$field] === $value));
        return round(($matchCount / count($snapshots)) * 100, 1);
    }
}
```

---

### 5.2 Servicio: SEOBuilder (Optimizador de Títulos)

```php
<?php

namespace App\Services\ListingSniper;

use App\Models\CompetitorSnapshot;
use App\Models\TitleAnalysis;

class SEOBuilderService
{
    // Palabras que NO aportan valor en ML (stop words de e-commerce)
    private array $stopWords = [
        'de', 'la', 'el', 'en', 'con', 'para', 'por', 'del', 'los', 'las',
        'un', 'una', 'y', 'o', 'a', 'al', 'se', 'su', 'sus', 'es', 'no',
        'si', 'que', 'como', 'mas', 'muy', 'ya', 'hasta', 'sin', 'sobre',
        // Palabras que ML penaliza (generan CTR bajo)
        'genérico', 'original', 'calidad', 'mejor', 'super', 'ultra', 'mega',
        'nuevo', 'oferta', 'especial', 'premium', // Estas reducen confianza
    ];

    // Estructura óptima de título según ML
    private array $titleStructure = [
        'product_type',   // Tipo de producto principal
        'brand',          // Marca
        'model',          // Modelo específico
        'year',           // Año o generación (si aplica)
        'key_attribute',  // Atributo diferenciador principal
        'compatibility',  // Compatible con... (si aplica)
    ];

    // ─────────────────────────────────────────────────────────
    // ANÁLISIS: Extraer palabras clave de múltiples títulos
    // ─────────────────────────────────────────────────────────
    public function analyzeCompetitorTitles(array $snapshots): array
    {
        $allWords     = [];
        $titleLengths = [];

        foreach ($snapshots as $snapshot) {
            $title = $snapshot['title'] ?? '';
            $titleLengths[] = strlen($title);

            // Tokenizar y limpiar
            $words = $this->tokenizeTitle($title);

            // Dar peso según la posición del competidor
            // El #1 tiene más peso que el #10
            $weight = max(1, 11 - $snapshot['search_position']);

            foreach ($words as $position => $word) {
                $word = strtolower($word);

                if (!isset($allWords[$word])) {
                    $allWords[$word] = [
                        'word'           => $word,
                        'frequency'      => 0,
                        'weighted_score' => 0,
                        'positions'      => [],
                        'in_leader'      => false,
                    ];
                }

                $allWords[$word]['frequency']++;
                $allWords[$word]['weighted_score'] += $weight;
                $allWords[$word]['positions'][] = $position;

                // ¿La usa el líder?
                if ($snapshot['search_position'] === 1) {
                    $allWords[$word]['in_leader'] = true;
                }
            }
        }

        // Ordenar por score ponderado
        usort($allWords, fn($a, $b) => $b['weighted_score'] <=> $a['weighted_score']);

        return [
            'keywords'          => array_values($allWords),
            'avg_title_length'  => round(array_sum($titleLengths) / count($titleLengths)),
            'max_title_length'  => max($titleLengths),
            'optimal_length'    => 60, // ML recomienda 60 caracteres
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SUGERENCIA: Construir el título ganador
    // ─────────────────────────────────────────────────────────
    public function suggestWinningTitle(
        string $ourCurrentTitle,
        array  $keywordAnalysis,
        array  $leaderData
    ): array {
        $keywords      = $keywordAnalysis['keywords'];
        $optimalLength = $keywordAnalysis['optimal_length'];

        // Filtrar las TOP keywords (las que usa el líder + alta frecuencia)
        $priorityKeywords = array_filter(
            $keywords,
            fn($k) => $k['in_leader'] || $k['frequency'] >= 3
        );

        // Score del título actual
        $currentScore = $this->scoreTitleQuality(
            $ourCurrentTitle,
            $keywords,
            $leaderData
        );

        // Construir el título sugerido respetando la estructura
        $suggestedTitle = $this->buildStructuredTitle(
            $leaderData,
            array_slice($priorityKeywords, 0, 15) // Top 15 palabras
        );

        // Score del título sugerido
        $suggestedScore = $this->scoreTitleQuality(
            $suggestedTitle,
            $keywords,
            $leaderData
        );

        return [
            'current_title'    => $ourCurrentTitle,
            'current_score'    => $currentScore,
            'suggested_title'  => $suggestedTitle,
            'suggested_score'  => $suggestedScore,
            'improvement'      => $suggestedScore - $currentScore,
            'char_count'       => strlen($suggestedTitle),
            'is_optimal_length'=> strlen($suggestedTitle) <= $optimalLength,
            'top_keywords'     => array_slice($priorityKeywords, 0, 10),
            'missing_keywords' => $this->findMissingKeywords($ourCurrentTitle, $priorityKeywords),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // SCORE: Calificar un título de 0 a 100
    // ─────────────────────────────────────────────────────────
    public function scoreTitleQuality(
        string $title,
        array  $keywords,
        array  $leaderData
    ): int {
        $score = 0;

        // ── Longitud óptima (20 puntos) ──────────────────────
        $length = strlen($title);
        if ($length >= 50 && $length <= 60)       $score += 20;
        elseif ($length >= 40 && $length <= 70)   $score += 15;
        elseif ($length >= 30 && $length <= 80)   $score += 10;
        else                                       $score += 5;

        // ── Palabras clave del Top 5 incluidas (40 puntos) ───
        $titleLower   = strtolower($title);
        $top5Keywords = array_slice(
            array_filter($keywords, fn($k) => $k['frequency'] >= 3),
            0, 10
        );

        $keywordMatches = 0;
        foreach ($top5Keywords as $kw) {
            if (str_contains($titleLower, $kw['word'])) {
                $keywordMatches++;
            }
        }

        $kwScore = min(40, intval(($keywordMatches / max(1, count($top5Keywords))) * 40));
        $score  += $kwScore;

        // ── El líder usa estas palabras (20 puntos) ──────────
        $leaderWords    = $this->tokenizeTitle($leaderData['title'] ?? '');
        $leaderMatches  = 0;
        foreach ($leaderWords as $lw) {
            if (str_contains($titleLower, strtolower($lw))) {
                $leaderMatches++;
            }
        }

        $leaderScore = min(20, intval(($leaderMatches / max(1, count($leaderWords))) * 20));
        $score      += $leaderScore;

        // ── Sin stop words dominantes (10 puntos) ────────────
        $stopWordCount = 0;
        $titleWords    = explode(' ', $titleLower);
        foreach ($titleWords as $word) {
            if (in_array($word, $this->stopWords)) $stopWordCount++;
        }

        $stopWordRatio = $stopWordCount / max(1, count($titleWords));
        if ($stopWordRatio <= 0.1)      $score += 10;
        elseif ($stopWordRatio <= 0.2)  $score += 5;

        // ── Mayúsculas correctas (10 puntos) ─────────────────
        // ML penaliza: TODO EN MAYÚSCULAS o todo en minúsculas
        $hasProperCase = $title !== strtoupper($title) && $title !== strtolower($title);
        if ($hasProperCase) $score += 10;

        return min(100, $score);
    }

    // ─────────────────────────────────────────────────────────
    // PRIVADOS
    // ─────────────────────────────────────────────────────────
    private function tokenizeTitle(string $title): array
    {
        // Quitar caracteres especiales y separar
        $clean = preg_replace('/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]/u', ' ', $title);
        $words = preg_split('/\s+/', trim($clean));

        // Filtrar stop words y palabras muy cortas
        return array_values(
            array_filter($words, fn($w) =>
                strlen($w) > 2 && !in_array(strtolower($w), $this->stopWords)
            )
        );
    }

    private function buildStructuredTitle(array $leaderData, array $keywords): string
    {
        // Extraer del líder: tipo de producto está al inicio de su título
        $leaderTitle = $leaderData['title'] ?? '';
        $leaderWords = explode(' ', $leaderTitle);
        $productType = implode(' ', array_slice($leaderWords, 0, 2));

        // Construir con la estructura óptima
        $parts   = [$productType];
        $current = strtolower($productType);

        foreach ($keywords as $kw) {
            $word = $kw['word'];
            // No repetir lo que ya incluimos
            if (!str_contains($current, $word) && strlen(implode(' ', $parts)) < 55) {
                $parts[] = ucfirst($word);
                $current .= ' ' . $word;
            }
        }

        $title = implode(' ', $parts);

        // Asegurar longitud máxima de ML (60 chars)
        if (strlen($title) > 60) {
            $title = substr($title, 0, 57) . '...';
        }

        return $title;
    }

    private function findMissingKeywords(string $ourTitle, array $priorityKeywords): array
    {
        $titleLower = strtolower($ourTitle);
        $missing    = [];

        foreach ($priorityKeywords as $kw) {
            if (!str_contains($titleLower, $kw['word'])) {
                $missing[] = [
                    'word'      => $kw['word'],
                    'frequency' => $kw['frequency'],
                    'in_leader' => $kw['in_leader'],
                ];
            }
        }

        return array_slice($missing, 0, 5); // Top 5 faltantes
    }
}
```

---

### 5.3 Servicio: ScoreCard (El Calificador)

```php
<?php

namespace App\Services\ListingSniper;

use App\Models\ListingScore;

class ScoreCardService
{
    // Pesos de cada dimensión (deben sumar 100)
    private array $weights = [
        'logistics'   => 30,
        'conversion'  => 25,
        'title'       => 20,
        'reputation'  => 15,
        'attributes'  => 10,
    ];

    // ─────────────────────────────────────────────────────────
    // ANÁLISIS COMPLETO: Nuestro item vs el Líder
    // ─────────────────────────────────────────────────────────
    public function compare(array $ourItem, array $leaderItem): array
    {
        $dimensions = [
            'logistics'  => $this->scoreLogistics($ourItem,  $leaderItem),
            'title'      => $this->scoreTitle($ourItem,      $leaderItem),
            'pictures'   => $this->scorePictures($ourItem,   $leaderItem),
            'price'      => $this->scorePrice($ourItem,      $leaderItem),
            'attributes' => $this->scoreAttributes($ourItem, $leaderItem),
            'reputation' => $this->scoreReputation($ourItem, $leaderItem),
        ];

        $totalScore  = $this->calculateWeightedScore($dimensions);
        $alerts      = $this->generateAlerts($ourItem, $leaderItem, $dimensions);
        $actions     = $this->generateActionPlan($alerts);

        // Persistir
        ListingScore::create([
            'our_ml_item_id'    => $ourItem['id']         ?? null,
            'competitor_item_id'=> $leaderItem['ml_item_id'] ?? null,
            'score_title'       => $dimensions['title']['score'],
            'score_pictures'    => $dimensions['pictures']['score'],
            'score_attributes'  => $dimensions['attributes']['score'],
            'score_price'       => $dimensions['price']['score'],
            'score_logistics'   => $dimensions['logistics']['score'],
            'score_reputation'  => $dimensions['reputation']['score'],
            'total_score'       => $totalScore,
            'diagnostics'       => json_encode([
                'alerts'          => $alerts,
                'recommendations' => $actions,
            ]),
        ]);

        return [
            'total_score' => $totalScore,
            'grade'       => $this->getGrade($totalScore),
            'dimensions'  => $dimensions,
            'alerts'      => $alerts,
            'action_plan' => $actions,
            'vs_leader'   => [
                'our_id'     => $ourItem['id'] ?? null,
                'leader_id'  => $leaderItem['ml_item_id'],
                'price_diff' => $this->priceDiff($ourItem, $leaderItem),
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Logística (el factor más importante)
    // ─────────────────────────────────────────────────────────
    private function scoreLogistics(array $our, array $leader): array
    {
        $score    = 0;
        $details  = [];

        // Full (Fulfillment) = máximo puntaje
        $ourLogistic    = $our['shipping']['logistic_type']    ?? 'not_specified';
        $leaderLogistic = $leader['logistic_type'] ?? 'not_specified';

        $logisticScore = match($ourLogistic) {
            'fulfillment'    => 100,
            'cross_docking'  => 75,
            'drop_off'       => 60,
            'xd_drop_off'    => 55,
            default          => 20,
        };

        $score = $logisticScore;

        // Bonus por envío gratis
        $ourFreeShip    = $our['shipping']['free_shipping']    ?? false;
        $leaderFreeShip = $leader['free_shipping'] ?? false;

        $details[] = [
            'metric'  => 'Tipo Logístico',
            'ours'    => $this->formatLogistic($ourLogistic),
            'leader'  => $this->formatLogistic($leaderLogistic),
            'status'  => $ourLogistic === $leaderLogistic ? 'equal'
                       : ($logisticScore >= 75 ? 'good' : 'bad'),
        ];

        $details[] = [
            'metric'  => 'Envío Gratis',
            'ours'    => $ourFreeShip ? '✅ Sí' : '❌ No',
            'leader'  => $leaderFreeShip ? '✅ Sí' : '❌ No',
            'status'  => ($ourFreeShip === $leaderFreeShip || $ourFreeShip) ? 'good' : 'bad',
        ];

        return [
            'score'    => $score,
            'weight'   => $this->weights['logistics'],
            'details'  => $details,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Fotos
    // ─────────────────────────────────────────────────────────
    private function scorePictures(array $our, array $leader): array
    {
        $ourCount    = count($our['pictures'] ?? []);
        $leaderCount = $leader['picture_count'] ?? 0;
        $leaderHasVideo = $leader['has_video'] ?? false;
        $ourHasVideo = $our['has_video'] ?? false;

        // Scoring
        $score = 0;

        // Fotos: comparado con el líder
        if ($ourCount >= $leaderCount + 1)      $score += 60; // Superamos al líder
        elseif ($ourCount === $leaderCount)      $score += 50;
        elseif ($ourCount >= $leaderCount - 2)   $score += 35;
        else                                     $score += max(10, intval(($ourCount / max(1,$leaderCount)) * 50));

        // Mínimo recomendado por ML
        if ($ourCount >= 8)  $score += 20;
        elseif ($ourCount >= 5)  $score += 10;

        // Video
        if ($ourHasVideo)                        $score += 20;
        elseif (!$ourHasVideo && $leaderHasVideo) $score -= 10;

        return [
            'score'   => min(100, max(0, $score)),
            'weight'  => 0, // No entra en el peso ponderado del total
            'details' => [
                ['metric' => 'Cantidad de Fotos', 'ours' => $ourCount, 'leader' => $leaderCount],
                ['metric' => 'Tiene Video',        'ours' => $ourHasVideo ? 'Sí' : 'No', 'leader' => $leaderHasVideo ? 'Sí' : 'No'],
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Precio
    // ─────────────────────────────────────────────────────────
    private function scorePrice(array $our, array $leader): array
    {
        $ourPrice    = $our['price']  ?? 0;
        $leaderPrice = $leader['price'] ?? 0;

        if ($leaderPrice == 0) {
            return ['score' => 50, 'weight' => 0, 'details' => [], 'diff_pct' => 0];
        }

        $diffPct = (($ourPrice - $leaderPrice) / $leaderPrice) * 100;
        $absDiff = abs($diffPct);

        $score = match(true) {
            $diffPct < -10     => 100,  // Somos significativamente más baratos 🏆
            $diffPct < 0       => 85,   // Somos más baratos
            $diffPct <= 5      => 70,   // Precio similar
            $diffPct <= 10     => 55,   // Un poco más caro
            $diffPct <= 15     => 35,   // Más caro (zona peligrosa)
            $diffPct <= 25     => 15,   // Muy caro vs el líder
            default            => 5,    // Precio fuera de mercado
        };

        return [
            'score'    => $score,
            'weight'   => 0,
            'diff_pct' => round($diffPct, 1),
            'our_price'    => $ourPrice,
            'leader_price' => $leaderPrice,
            'details'  => [[
                'metric' => 'Diferencia de Precio',
                'ours'   => "$ {$ourPrice}",
                'leader' => "$ {$leaderPrice}",
                'status' => $score >= 70 ? 'good' : ($score >= 40 ? 'warning' : 'bad'),
            ]],
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Atributos/Ficha Técnica
    // ─────────────────────────────────────────────────────────
    private function scoreAttributes(array $our, array $leader): array
    {
        $ourAttrs    = $our['attributes']  ?? [];
        $leaderAttrs = json_decode($leader['raw_attributes'] ?? '[]', true);

        $ourAttrIds    = array_column($ourAttrs,    'id');
        $leaderAttrIds = array_column($leaderAttrs, 'id');

        $missingAttrs  = array_diff($leaderAttrIds, $ourAttrIds);
        $extraAttrs    = array_diff($ourAttrIds,    $leaderAttrIds);

        $coverageRatio = count($leaderAttrIds) > 0
            ? (count($ourAttrIds) / count($leaderAttrIds))
            : 1;

        $score = min(100, intval($coverageRatio * 100));

        return [
            'score'           => $score,
            'weight'          => $this->weights['attributes'],
            'our_count'       => count($ourAttrs),
            'leader_count'    => count($leaderAttrs),
            'missing_attrs'   => $this->formatMissingAttrs($missingAttrs, $leaderAttrs),
            'extra_attrs'     => count($extraAttrs),
            'coverage'        => round($coverageRatio * 100, 1),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Título (usa SEOBuilderService)
    // ─────────────────────────────────────────────────────────
    private function scoreTitle(array $our, array $leader): array
    {
        $ourTitle    = $our['title']   ?? '';
        $leaderTitle = $leader['title'] ?? '';

        $ourLength    = strlen($ourTitle);
        $leaderLength = strlen($leaderTitle);

        // Comparación básica de longitud
        $lengthScore = match(true) {
            $ourLength >= 50 && $ourLength <= 60 => 100,
            $ourLength >= 40 && $ourLength <= 70 => 75,
            $ourLength >= 30 && $ourLength <= 80 => 50,
            default => 25,
        };

        return [
            'score'          => $lengthScore,
            'weight'         => $this->weights['title'],
            'our_length'     => $ourLength,
            'leader_length'  => $leaderLength,
            'our_title'      => $ourTitle,
            'leader_title'   => $leaderTitle,
        ];
    }

    // ─────────────────────────────────────────────────────────
    // DIMENSIÓN: Reputación del vendedor
    // ─────────────────────────────────────────────────────────
    private function scoreReputation(array $our, array $leader): array
    {
        $levelMap = [
            '5_green'       => 100,
            '4_light_green' => 80,
            '3_yellow'      => 60,
            '2_orange'      => 40,
            '1_red'         => 20,
            'new'           => 10,
        ];

        $ourLevel    = $our['seller']['seller_reputation']['level_id'] ?? 'new';
        $leaderLevel = $leader['seller_level'] ?? '5_green';

        $score = $levelMap[$ourLevel] ?? 10;

        return [
            'score'        => $score,
            'weight'       => $this->weights['reputation'],
            'our_level'    => $this->formatReputation($ourLevel),
            'leader_level' => $this->formatReputation($leaderLevel),
        ];
    }

    // ─────────────────────────────────────────────────────────
    // ALERTAS: Generar semáforo de problemas
    // ─────────────────────────────────────────────────────────
    private function generateAlerts(array $our, array $leader, array $dimensions): array
    {
        $alerts = [];

        // ── Logística ────────────────────────────────────────
        $logisticScore = $dimensions['logistics']['score'];
        if ($logisticScore < 40) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Logística',
                'message' => 'Sin Full/Flex activo. Este es el factor #1 de posicionamiento.',
                'action'  => 'Activar Mercado Envíos Full para este producto',
                'impact'  => 'muy_alto',
            ];
        }

        // ── Precio ───────────────────────────────────────────
        $priceDiff = $dimensions['price']['diff_pct'] ?? 0;
        if ($priceDiff > 15) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Precio',
                'message' => "Tu precio es {$priceDiff}% mayor que el líder.",
                'action'  => "Ajustar precio a $ {$dimensions['price']['leader_price']} o justificar el valor añadido",
                'impact'  => 'alto',
            ];
        } elseif ($priceDiff > 5) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Precio',
                'message' => "Tu precio es {$priceDiff}% mayor que el líder.",
                'action'  => 'Considera un ajuste de precio o activar cupones',
                'impact'  => 'medio',
            ];
        }

        // ── Fotos ────────────────────────────────────────────
        $ourPics    = count($our['pictures']  ?? []);
        $leaderPics = $leader['picture_count'] ?? 0;

        if ($ourPics < $leaderPics) {
            $diff = $leaderPics - $ourPics;
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Imágenes',
                'message' => "Te faltan {$diff} foto(s) vs el líder ({$ourPics} vs {$leaderPics}).",
                'action'  => 'Agregar más fotos de alta calidad (fondo blanco, >1200px)',
                'impact'  => 'alto',
            ];
        } elseif ($ourPics === $leaderPics) {
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Imágenes',
                'message' => "Mismo número de fotos que el líder. Podrías superarlo.",
                'action'  => 'Agregar 1-2 fotos más + un video del producto',
                'impact'  => 'medio',
            ];
        } else {
            $alerts[] = [
                'level'   => 'green',
                'icon'    => '🟢',
                'area'    => 'Imágenes',
                'message' => "Tienes más fotos que el líder. ¡Bien!",
                'action'  => null,
                'impact'  => 'positivo',
            ];
        }

        // ── Video ────────────────────────────────────────────
        $leaderHasVideo = $leader['has_video'] ?? false;
        $ourHasVideo    = $our['has_video']    ?? false;

        if ($leaderHasVideo && !$ourHasVideo) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Video',
                'message' => 'El líder tiene video y tú no. Los videos aumentan CVR 20%.',
                'action'  => 'Grabar y subir un video de 30-60 segundos del producto',
                'impact'  => 'alto',
            ];
        }

        // ── Atributos ────────────────────────────────────────
        $missingCount = count($dimensions['attributes']['missing_attrs'] ?? []);
        if ($missingCount > 0) {
            $missing = array_column(
                array_slice($dimensions['attributes']['missing_attrs'] ?? [], 0, 3),
                'name'
            );
            $alerts[] = [
                'level'   => 'yellow',
                'icon'    => '🟡',
                'area'    => 'Ficha Técnica',
                'message' => "Faltan {$missingCount} atributos que el líder sí tiene.",
                'action'  => 'Completar: ' . implode(', ', $missing),
                'impact'  => 'medio',
            ];
        }

        // ── Título ───────────────────────────────────────────
        $ourTitleLen    = strlen($our['title'] ?? '');
        $leaderTitleLen = strlen($leader['title'] ?? '');

        if ($ourTitleLen > $leaderTitleLen) {
            $alerts[] = [
                'level'   => 'green',
                'icon'    => '🟢',
                'area'    => 'Título',
                'message' => 'Tu título es más descriptivo que el líder.',
                'action'  => null,
                'impact'  => 'positivo',
            ];
        } elseif ($ourTitleLen < 40) {
            $alerts[] = [
                'level'   => 'red',
                'icon'    => '🔴',
                'area'    => 'Título',
                'message' => 'Título muy corto. ML necesita más palabras clave.',
                'action'  => 'Usar el SEO Builder para construir un título de 55-60 caracteres',
                'impact'  => 'alto',
            ];
        }

        // Ordenar: rojo → amarillo → verde
        usort($alerts, fn($a, $b) => [
            'red'    => 0,
            'yellow' => 1,
            'green'  => 2,
        ][$a['level']] <=> [
            'red'    => 0,
            'yellow' => 1,
            'green'  => 2,
        ][$b['level']]);

        return $alerts;
    }

    // ─────────────────────────────────────────────────────────
    // PLAN DE ACCIÓN: Ordenado por impacto
    // ─────────────────────────────────────────────────────────
    private function generateActionPlan(array $alerts): array
    {
        $impactOrder = ['muy_alto' => 0, 'alto' => 1, 'medio' => 2, 'bajo' => 3, 'positivo' => 4];

        $redAlerts = array_filter($alerts, fn($a) => $a['level'] === 'red');

        usort($redAlerts, fn($a, $b) =>
            ($impactOrder[$a['impact']] ?? 5) <=> ($impactOrder[$b['impact']] ?? 5)
        );

        $plan = [];
        $step = 1;

        foreach ($redAlerts as $alert) {
            if ($alert['action']) {
                $plan[] = [
                    'step'   => $step++,
                    'area'   => $alert['area'],
                    'action' => $alert['action'],
                    'impact' => $alert['impact'],
                ];
            }
        }

        return $plan;
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    private function calculateWeightedScore(array $dimensions): int
    {
        $total = 0;

        foreach ($this->weights as $dimension => $weight) {
            $score  = $dimensions[$dimension]['score'] ?? 0;
            $total += ($score * $weight) / 100;
        }

        return (int) round($total);
    }

    private function getGrade(int $score): array
    {
        return match(true) {
            $score >= 90 => ['grade' => 'A+', 'label' => 'Publicación Líder',   'color' => 'green'],
            $score >= 80 => ['grade' => 'A',  'label' => 'Muy Competitiva',     'color' => 'green'],
            $score >= 70 => ['grade' => 'B',  'label' => 'Competitiva',         'color' => 'blue'],
            $score >= 60 => ['grade' => 'C',  'label' => 'Necesita Mejoras',    'color' => 'yellow'],
            $score >= 40 => ['grade' => 'D',  'label' => 'En Riesgo',           'color' => 'orange'],
            default      => ['grade' => 'F',  'label' => 'Crítico',             'color' => 'red'],
        };
    }

    private function priceDiff(array $our, array $leader): array
    {
        $ourPrice    = $our['price']   ?? 0;
        $leaderPrice = $leader['price'] ?? 0;

        if ($leaderPrice == 0) return ['amount' => 0, 'percent' => 0, 'position' => 'equal'];

        $diff    = $ourPrice - $leaderPrice;
        $pct     = round(($diff / $leaderPrice) * 100, 1);
        $position= $diff > 0 ? 'above' : ($diff < 0 ? 'below' : 'equal');

        return compact('ourPrice', 'leaderPrice', 'diff', 'pct', 'position');
    }

    private function formatLogistic(string $type): string
    {
        return match($type) {
            'fulfillment'   => '⭐ Mercado Full',
            'cross_docking' => '📦 Flex',
            'drop_off'      => '🏪 Drop-off',
            default         => '⚠️ Básico',
        };
    }

    private function formatReputation(string $level): string
    {
        return match($level) {
            '5_green'       => '⭐ Nivel 5 (Verde)',
            '4_light_green' => '🟢 Nivel 4',
            '3_yellow'      => '🟡 Nivel 3',
            '2_orange'      => '🟠 Nivel 2',
            '1_red'         => '🔴 Nivel 1',
            default         => '🆕 Nuevo',
        };
    }

    private function formatMissingAttrs(array $missingIds, array $leaderAttrs): array
    {
        $leaderMap = array_column($leaderAttrs, null, 'id');
        $result    = [];

        foreach ($missingIds as $id) {
            if (isset($leaderMap[$id])) {
                $result[] = [
                    'id'    => $id,
                    'name'  => $leaderMap[$id]['name']       ?? $id,
                    'value' => $leaderMap[$id]['value_name'] ?? null,
                ];
            }
        }

        return $result;
    }
}
```

---

### 5.4 Controlador de la API

```php
<?php

namespace App\Http\Controllers\Api\Tools;

use App\Http\Controllers\Controller;
use App\Services\ListingSniper\MarketSpyService;
use App\Services\ListingSniper\SEOBuilderService;
use App\Services\ListingSniper\ScoreCardService;
use App\Services\MercadoLibre\AuthService as MLAuth;
use Illuminate\Http\{Request, JsonResponse};

class ListingSniperController extends Controller
{
    public function __construct(
        private readonly MarketSpyService  $marketSpy,
        private readonly SEOBuilderService $seoBuilder,
        private readonly ScoreCardService  $scoreCard,
        private readonly MLAuth            $mlAuth,
    ) {}

    // ─────────────────────────────────────────────────────────
    // POST /api/tools/competitor-search
    // Body: { query: "batería 12v 60ah", sku: "BAT-001" }
    // ─────────────────────────────────────────────────────────
    public function competitorSearch(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string|min:3|max:100',
            'sku'   => 'nullable|string|max:50',
        ]);

        try {
            $token  = $this->mlAuth->getValidToken();
            $result = $this->marketSpy->analyzeMarket(
                query:  $request->query,
                ourSku: $request->sku,
            );

            return response()->json([
                'success' => true,
                'data'    => $result,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al analizar el mercado: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────
    // POST /api/tools/seo-builder
    // Body: { query: "...", our_title: "...", our_sku: "..." }
    // ─────────────────────────────────────────────────────────
    public function seoBuilder(Request $request): JsonResponse
    {
        $request->validate([
            'query'     => 'required|string',
            'our_title' => 'required|string',
        ]);

        try {
            // Obtener snapshots de los competidores
            $token     = $this->mlAuth->getValidToken();
            $market    = $this->marketSpy->analyzeMarket($request->query);
            $snapshots = $market['competitors'] ?? [];

            if (empty($snapshots)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay datos de competidores para analizar',
                ], 404);
            }

            // Analizar títulos
            $keywordAnalysis = $this->seoBuilder->analyzeCompetitorTitles($snapshots);

            // Sugerir título ganador
            $suggestion = $this->seoBuilder->suggestWinningTitle(
                ourCurrentTitle: $request->our_title,
                keywordAnalysis: $keywordAnalysis,
                leaderData:      $market['leader'],
            );

            return response()->json([
                'success' => true,
                'data'    => [
                    'keyword_analysis' => $keywordAnalysis,
                    'title_suggestion' => $suggestion,
                    'market_summary'   => [
                        'competitors_analyzed' => count($snapshots),
                        'leader'               => $market['leader']['seller'],
                        'avg_price'            => $market['market_stats']['avg_price'],
                    ],
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────
    // POST /api/tools/scorecard
    // Body: { our_item_id: "MLV...", query: "..." }
    // ─────────────────────────────────────────────────────────
    public function scoreCard(Request $request): JsonResponse
    {
        $request->validate([
            'our_item_id' => 'required|string',
            'query'       => 'required|string',
        ]);

        try {
            $token = $this->mlAuth->getValidToken();

            // Obtener nuestro item de ML
            $ourItemResponse = \Http::withToken($token)
                ->get("https://api.mercadolibre.com/items/{$request->our_item_id}");

            if (!$ourItemResponse->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo obtener tu publicación de ML',
                ], 404);
            }

            $ourItem = $ourItemResponse->json();

            // Obtener el líder del mercado
            $market = $this->marketSpy->analyzeMarket($request->query);
            $leader = $market['leader']       ?? null;
            $snapshots = $market['competitors'] ?? [];

            if (!$leader) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró el líder del mercado',
                ], 404);
            }

            // El snapshot del líder tiene los datos que necesitamos
            $leaderSnapshot = $snapshots[0] ?? $leader;

            // Calcular el ScoreCard
            $scoreCard = $this->scoreCard->compare($ourItem, $leaderSnapshot);

            return response()->json([
                'success' => true,
                'data'    => $scoreCard,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────
    // GET /api/tools/feature-cloner/{itemId}
    // ─────────────────────────────────────────────────────────
    public function featureCloner(string $itemId): JsonResponse
    {
        try {
            $token = $this->mlAuth->getValidToken();

            // Obtener atributos y descripción del líder
            $itemResponse = \Http::withToken($token)
                ->get("https://api.mercadolibre.com/items/{$itemId}");

            $descResponse = \Http::withToken($token)
                ->get("https://api.mercadolibre.com/items/{$itemId}/description");

            if (!$itemResponse->successful()) {
                return response()->json(['success' => false, 'message' => 'Item no encontrado'], 404);
            }

            $item        = $itemResponse->json();
            $description = $descResponse->successful() ? $descResponse->json('plain_text', '') : '';

            // Limpiar la descripción de datos de contacto
            $cleanDescription = $this->sanitizeDescription($description);

            return response()->json([
                'success' => true,
                'data'    => [
                    'item_id'           => $itemId,
                    'title'             => $item['title'],
                    'category_id'       => $item['category_id'],
                    'attributes'        => $item['attributes'] ?? [],
                    'clean_description' => $cleanDescription,
                    'pictures'          => array_map(fn($p) => [
                        'id'  => $p['id'],
                        'url' => $p['url'],
                    ], $item['pictures'] ?? []),
                    'attribute_count'   => count($item['attributes'] ?? []),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // ─────────────────────────────────────────────────────────
    // HELPER: Limpiar descripción de datos sensibles
    // ─────────────────────────────────────────────────────────
    private function sanitizeDescription(string $text): string
    {
        $patterns = [
            // Teléfonos
            '/(\+58|0058|0\d{3})[\s\-]?\d{3}[\s\-]?\d{4}/i',
            // Emails
            '/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i',
            // Redes sociales
            '/@[a-zA-Z0-9_.]+/',
            '/\bwhatsapp\b/i',
            '/\binstagram\b/i',
            // URLs externas
            '/https?:\/\/(?!mercadolibre|mercadopago)[^\s]+/i',
            // Textos tipo "Llámanos"
            '/ll[aá]m[ae]nos?|cont[áa]ct[ae]nos?|escr[ií]benos?/i',
        ];

        $cleaned = preg_replace($patterns, '[DATO_ELIMINADO]', $text);

        // Limpiar marcadores residuales
        return preg_replace('/\[DATO_ELIMINADO\]\s*/i', '', $cleaned);
    }
}
```

---

### 5.5 Rutas de la API

```php
<?php
// routes/api.php

use App\Http\Controllers\Api\Tools\ListingSniperController;

Route::prefix('tools')->middleware(['auth:sanctum', 'ml.token.valid'])->group(function () {

    // 📡 Market Spy
    Route::post('competitor-search', [ListingSniperController::class, 'competitorSearch'])
         ->name('tools.competitor-search');

    // 🏆 SEO Builder
    Route::post('seo-builder', [ListingSniperController::class, 'seoBuilder'])
         ->name('tools.seo-builder');

    // ⚖️ ScoreCard / TheBench
    Route::post('scorecard', [ListingSniperController::class, 'scoreCard'])
         ->name('tools.scorecard');

    // 📋 Feature Cloner
    Route::get('feature-cloner/{itemId}', [ListingSniperController::class, 'featureCloner'])
         ->name('tools.feature-cloner')
         ->where('itemId', 'MLV[0-9]+');

    // Historial de análisis
    Route::get('analysis-history', [ListingSniperController::class, 'analysisHistory'])
         ->name('tools.analysis-history');
});
```

---

## 6. Flujo de Datos Completo {#flujo}

```
FLUJO: Usuario busca competencia para SKU "BAT-001"
══════════════════════════════════════════════════════════════════

  USUARIO
    │
    │  POST /api/tools/competitor-search
    │  { "query": "batería 12v 60ah toyota", "sku": "BAT-001" }
    │
    ▼
  ListingSniperController
    │
    ├─► Validar token ML (MLAuth)
    │
    └─► MarketSpyService::analyzeMarket()
          │
          ├─► Cache::get("market_spy:MLV:abc123")
          │     └── HIT? → Retornar data cacheada (sin llamar a ML)
          │
          ├─► MISS → ML API: GET /sites/MLV/search?q=...&sort=sold_quantity_desc
          │           └── Recibe: [id1, id2, ..., id10]
          │
          ├─► ML API: GET /items?ids=id1,id2,...,id10 (batch)
          │           └── Recibe: detalles completos de cada item
          │
          ├─► ML API: GET /items/id1/description (x10, con delay)
          │           └── Recibe: textos de descripción
          │
          ├─► buildSnapshot() x10
          │     └── Normaliza y estructura cada competidor
          │
          ├─► CompetitorSnapshot::updateOrCreate() x10
          │     └── Persiste en PostgreSQL
          │
          ├─► buildMarketSummary()
          │     ├── leader (el #1 por ventas)
          │     ├── market_stats (precios, fotos, atributos promedio)
          │     └── competitors (array de los 10)
          │
          └─► Cache::put() → Cachea por 4 horas
                │
                ▼
          RESPUESTA JSON al usuario:
          {
            "success": true,
            "data": {
              "leader": {
                "item_id": "MLV123",
                "title": "Batería 12V 60Ah...",
                "price": 45.00,
                "sold_quantity": 342,
                "logistics": "⭐ Mercado Full",
                "picture_count": 10,
                "has_video": true
              },
              "market_stats": {
                "avg_price": 47.50,
                "pct_fulfillment": 70,
                "avg_pictures": 7.3
              },
              "competitors": [...]
            }
          }

══════════════════════════════════════════════════════════════════

FLUJO: ScoreCard para nuestra publicación
══════════════════════════════════════════════════════════════════

  POST /api/tools/scorecard
  { "our_item_id": "MLV999", "query": "batería 12v 60ah" }
    │
    ├─► Obtener nuestro item de ML API
    ├─► Obtener líder via MarketSpy (cache hit probable)
    │
    └─► ScoreCardService::compare(ourItem, leaderSnapshot)
          │
          ├─► scoreLogistics()  → 20/100 ⚠️
          ├─► scoreTitle()      → 75/100 ✅
          ├─► scorePictures()   → 45/100 ⚠️
          ├─► scorePrice()      → 55/100 🟡
          ├─► scoreAttributes() → 60/100 🟡
          ├─► scoreReputation() → 80/100 ✅
          │
          ├─► calculateWeightedScore()
          │     └── (20×0.30)+(75×0.20)+(60×0.10)+(80×0.15)+(... = 52/100
          │
          ├─► generateAlerts()
          │     ├── 🔴 Sin Full activo (impacto: muy_alto)
          │     ├── 🔴 Te faltan 4 fotos vs el líder (impacto: alto)
          │     ├── 🟡 Precio 8% mayor al líder (impacto: medio)
          │     ├── 🟡 Faltan 3 atributos (impacto: medio)
          │     └── 🟢 Título más descriptivo que el líder
          │
          └─► generateActionPlan()
                ├── [1] Activar Mercado Full (muy_alto)
                ├── [2] Agregar 4 fotos más (alto)
                └── [3] Revisar precio vs mercado (medio)
```

---

## 🗺️ Resumen Visual del Sistema Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    📊 LISTING SNIPER DASHBOARD                       │
│                                                                       │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  🔍 MARKET SPY │  │  🏆 SEO BUILDER  │  │   ⚖️  THE BENCH      │  │
│  │                │  │                 │  │                      │  │
│  │ Búsqueda:      │  │ Título actual:  │  │ NUESTRA PUB | LÍDER  │  │
│  │ [___________]  │  │ "Bat Toyota..." │  │ ─────────────────    │  │
│  │                │  │ Score: 45/100   │  │ Precio: $50 | $45   │  │
│  │ Top 10:        │  │                 │  │ Fotos:   6  |  10   │  │
│  │ #1 MLV123 ⭐   │  │ Sugerido:       │  │ Full:   ❌  |  ✅   │  │
│  │ #2 MLV456      │  │ "Batería 12V    │  │ Video:  ❌  |  ✅   │  │
│  │ #3 MLV789      │  │  60Ah Full..."  │  │ Attrs: 12  |  18   │  │
│  │ ...            │  │ Score: 82/100   │  │                      │  │
│  │                │  │ +37 puntos 🚀   │  │ SCORE: 52/100 [D]   │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    🚨 PLAN DE ACCIÓN                          │    │
│  │                                                               │    │
│  │  [1] 🔴 Activar Mercado Full ──────── Impacto: MUY ALTO     │    │
│  │  [2] 🔴 Agregar 4 fotos más ──────── Impacto: ALTO          │    │
│  │  [3] 🟡 Ajustar precio a $45 ─────── Impacto: MEDIO         │    │
│  │  [4] 🟡 Completar 6 atributos ────── Impacto: MEDIO         │    │
│  │                          [APLICAR CAMBIOS] [EXPORTAR PDF]    │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

> **💡 Próximo Paso Inmediato**: Comenzar con la **Fase 1** — implementar `MarketSpyService` + las migraciones de BD + el endpoint `/api/tools/competitor-search`. Una vez que el núcleo esté extrayendo datos reales, el resto de los módulos se construyen sobre esa base.