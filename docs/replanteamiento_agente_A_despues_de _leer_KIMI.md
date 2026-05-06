Excelente investigación. Has validado y corregido varios puntos críticos de mi propuesta inicial, especialmente sobre la API de **Health vs Performance** (cambio reciente post-enero 2025) y la **disponibilidad de `sold_quantity`** en búsquedas públicas. 

Aquí tienes el **Plan Técnico Integrado y Corregido**, fusionando tu investigación de API con la arquitectura existente del proyecto:

---

## 🚨 CORRECCIONES CRÍTICAS RESPECTO AL PLAN ANTERIOR

### 1. API de Health/Performance (Actualización Post-Enero 2025)
Tienes razón: `/items/{id}/health` fue descontinuada. El endpoint válido ahora es:
```
GET /item/{id}/performance
```
**Buckets relevantes para el Sniper:**
- `CHARACTERISTICS`: Fotos, título, especificaciones, GTIN
- `OFFER`: Stock, condiciones de envío (aunque en MLV sea limitado)

### 2. Disponibilidad de `sold_quantity` en Búsqueda Pública
Corrijo mi error: **`sold_quantity` SÍ viene en `/sites/MLV/search`** dentro de cada resultado. No es necesario el multiget obligatorio para obtener este dato, aunque sí necesitamos el multiget para fotos y atributos completos.

**Optimización:** Podemos ordenar por `sold_quantity` en memoria después de la búsqueda, ya que la API no soporta `sort=sold_quantity_desc`.

### 3. No Duplicar `internal_inventory`
Correcto. Usaremos la tabla existente `internal_inventory` (SKU, OEM, costo, stock) en lugar de crear `our_inventory`.

---

## 🗄️ FASE 1: ESQUEMA SQL REFINADO (Integrado)

```sql
-- ================================================================
-- 1. SNAPSHOTS TEMPORALES (Con batching para análisis histórico)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_batch_id UUID NOT NULL, -- Agrupa análisis del mismo momento
    search_query TEXT NOT NULL,
    our_product_sku TEXT REFERENCES public.internal_inventory(sku),
    our_ml_item_id TEXT,
    
    -- Datos del competidor (públicos)
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd DECIMAL(12,2),
    available_quantity INTEGER, -- Stock declarado (puede ser referencial)
    sold_quantity INTEGER DEFAULT 0,
    sold_since DATE,
    condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
    listing_type_id TEXT,
    permalink TEXT,
    
    -- Vendedor
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT,
    seller_power_seller TEXT,
    
    -- Métricas de calidad (requieren llamadas adicionales)
    health_score INTEGER, -- De /performance o /health (legacy)
    health_level TEXT, -- Básica, Estándar, Profesional
    pictures_count INTEGER DEFAULT 0,
    attributes_count INTEGER DEFAULT 0,
    has_description BOOLEAN DEFAULT false,
    description_text TEXT, -- Scraping de /description (primeros 500 chars)
    
    -- Logística MLV específica (scraping lógico)
    logistics_data JSONB DEFAULT '{
        "pickup_zones": [],
        "delivery_methods": [],
        "seller_city": null,
        "seller_state": null,
        "local_pickup": false
    }',
    
    -- Datos crudos (para debug y análisis profundo)
    raw_api_response JSONB,
    
    -- Posicionamiento
    search_position INTEGER, -- Posición en el resultado de búsqueda
    search_sort_used TEXT DEFAULT 'relevance',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_snapshot_per_batch UNIQUE(snapshot_batch_id, ml_item_id)
);

CREATE INDEX idx_snapshots_batch ON mlv_market_snapshots(snapshot_batch_id);
CREATE INDEX idx_snapshots_query ON mlv_market_snapshots(search_query);
CREATE INDEX idx_snapshots_sku ON mlv_market_snapshots(our_product_sku);
CREATE INDEX idx_snapshots_created ON mlv_market_snapshots(created_at DESC);

-- ================================================================
-- 2. ANÁLISIS COMPARATIVO Y PLAN DE ACCIÓN
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_competitive_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_batch_id UUID NOT NULL,
    our_product_sku TEXT NOT NULL,
    our_ml_item_id TEXT,
    competitor_item_id TEXT NOT NULL,
    
    -- Scoring dimensional (0-100)
    score_total INTEGER,
    score_breakdown JSONB DEFAULT '{
        "price": 0,
        "seo_title": 0,
        "photos": 0,
        "attributes": 0,
        "logistics": 0,
        "health": 0,
        "reputation": 0
    }',
    
    -- Gaps específicos
    price_gap_percent DECIMAL(5,2),
    missing_attributes TEXT[],
    missing_photos_count INTEGER,
    title_issues TEXT[], -- ['too_short', 'all_caps', 'spam_words']
    
    -- Plan de acción enriquecido (estructura validada)
    action_plan JSONB DEFAULT '[]',
    /*
    [
        {
            "priority": "high|medium|low",
            "type": "price|content|attributes|logistics|seo",
            "action_code": "reduce_price|add_photos|fix_title|add_part_number|enable_pickup",
            "current_value": "48.00",
            "target_value": "44.10",
            "detail": "Baja el precio a $44.10 para igualar al líder -2%",
            "impact_estimate": "+15% visibilidad",
            "automated": false
        }
    ]
    */
    
    -- Referencias al líder
    leader_item_id TEXT,
    leader_price DECIMAL(12,2),
    leader_sold_quantity INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_batch ON mlv_competitive_analysis(snapshot_batch_id);
CREATE INDEX idx_analysis_sku ON mlv_competitive_analysis(our_product_sku);

-- ================================================================
-- 3. HISTORIAL DE POSICIONES (Tracking temporal)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_position_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    search_query TEXT NOT NULL,
    
    position_previous INTEGER,
    position_current INTEGER,
    snapshot_batch_id UUID REFERENCES public.mlv_market_snapshots(snapshot_batch_id),
    
    actions_applied JSONB, -- Qué cambios se hicieron entre mediciones
    market_context JSONB, -- Precio promedio del mercado, stock promedio, etc.
    
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================================
-- 4. IMÁGENES DE REFERENCIA (Para el feature de "buscar fotos")
-- ================================================================
CREATE TABLE IF NOT EXISTS public.competitor_image_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ml_item_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_order INTEGER,
    is_primary BOOLEAN DEFAULT false,
    analysis_metadata JSONB DEFAULT '{}', -- { 'has_part_number_visible': true, 'angle': 'frontal' }
    captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_img_refs_item ON competitor_image_refs(ml_item_id);
```

---

## ⚙️ FASE 2: BACKEND OPTIMIZADO

### Corrección Estratégica: Búsqueda por Relevancia + Ordenamiento Local

Como `sort=sold_quantity_desc` no existe, usamos esta estrategia híbrida:

```javascript
// src/app/api/tools/sniper/analyze/route.js
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getValidAccessToken } from '@/lib/meli-auth-helper';

const MLV_SITE_ID = 'MLV';
const MELI_API = 'https://api.mercadolibre.com';

export async function POST(request) {
    try {
        const { query, sku, ourItemId, categoryId } = await request.json();
        const batchId = crypto.randomUUID();
        
        // 1. BÚSQUEDA POR RELEVANCIA (captura lo que ML considera mejor)
        const searchUrl = `${MELI_API}/sites/${MLV_SITE_ID}/search?q=${encodeURIComponent(query)}&limit=20${categoryId ? `&category=${categoryId}` : ''}`;
        
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`ML Search failed: ${searchRes.status}`);
        const searchData = await searchRes.json();
        
        // 2. ORDENAMIENTO POR VENTAS EN MEMORIA (simulando sold_quantity_desc)
        const sortedResults = searchData.results.sort((a, b) => 
            (b.sold_quantity || 0) - (a.sold_quantity || 0)
        );
        
        // Tomar Top 10 por ventas
        const topCompetitors = sortedResults.slice(0, 10);
        
        // 3. MULTIGET PARA DETALLES ENRIQUECIDOS (fotos, atributos, descripción)
        const itemIds = topCompetitors.map(r => r.id);
        const itemDetails = await fetchItemsDetails(itemIds);
        
        // 4. OBTENER PERFORMANCE/HEALTH (nueva API)
        const healthData = await fetchHealthScores(itemIds);
        
        // 5. PROCESAMIENTO Y SCRAPING LÓGICO MLV
        const snapshots = await Promise.all(
            topCompetitors.map(async (item, index) => {
                const detail = itemDetails.get(item.id) || {};
                const health = healthData.get(item.id) || {};
                
                // Scraping de descripción para logística MLV
                const descText = await fetchItemDescription(item.id);
                
                return processSnapshot(item, detail, health, descText, {
                    batchId,
                    query,
                    sku,
                    ourItemId,
                    position: index + 1
                });
            })
        );
        
        // 6. PERSISTIR EN SUPABASE
        const { data: insertedSnapshots, error: snapError } = await supabaseAdmin
            .from('mlv_market_snapshots')
            .insert(snapshots)
            .select();
            
        if (snapError) throw snapError;
        
        // 7. SI TENEMOS ourItemId, GENERAR ANÁLISIS COMPARATIVO
        let analysis = null;
        if (ourItemId) {
            const ourItem = await fetchOurItemDetails(ourItemId);
            const leader = snapshots[0]; // El más vendido
            
            analysis = await generateCompetitiveAnalysis(ourItem, leader, snapshots, batchId);
            
            await supabaseAdmin
                .from('mlv_competitive_analysis')
                .insert(analysis);
        }
        
        return NextResponse.json({
            success: true,
            batch_id: batchId,
            query,
            leader: snapshots[0],
            competitors: snapshots,
            analysis,
            stats: {
                total_analyzed: snapshots.length,
                avg_price: snapshots.reduce((a, b) => a + b.price_usd, 0) / snapshots.length,
                max_sales: Math.max(...snapshots.map(s => s.sold_quantity))
            }
        });
        
    } catch (error) {
        console.error('Sniper Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper: Fetch descripción (para scraping de logística)
async function fetchItemDescription(itemId) {
    try {
        const res = await fetch(`${MELI_API}/items/${itemId}/description`);
        if (!res.ok) return '';
        const data = await res.json();
        return data.plain_text || '';
    } catch {
        return '';
    }
}

// Helper: Procesar snapshot con scraping MLV específico
function processSnapshot(item, detail, health, description, meta) {
    const titleLower = (item.title || '').toLowerCase();
    const descLower = description.toLowerCase();
    
    // Scraping de zonas de pickup (crítico para MLV)
    const pickupZones = [];
    const zoneKeywords = {
        'chacao': ['chacao', 'altamira', 'los palos grandes'],
        'sabana_grande': ['sabana grande', 'chacaito'],
        'los_cortijos': ['los cortijos', 'la california'],
        'valencia': ['valencia', 'naguanagua'],
        'maracaibo': ['maracaibo', '5 de julio']
    };
    
    Object.entries(zoneKeywords).forEach(([zone, keywords]) => {
        if (keywords.some(k => titleLower.includes(k) || descLower.includes(k))) {
            pickupZones.push(zone);
        }
    });
    
    // Detectar métodos de envío mencionados
    const deliveryMethods = [];
    if (descLower.includes('zoom')) deliveryMethods.push('zoom');
    if (descLower.includes('tealca')) deliveryMethods.push('tealca');
    if (descLower.includes('mrw')) deliveryMethods.push('mrw');
    if (descLower.includes('liberty express')) deliveryMethods.push('liberty_express');
    if (descLower.includes('envío nacional') || descLower.includes('envio nacional')) {
        deliveryMethods.push('envio_nacional');
    }
    
    // Detectar palabras spam en título (penalizadas por ML)
    const spamWords = [];
    const spamKeywords = ['remate', 'urgente', 'ultimo', '!!!!', 'oferton', 'aprovecha', 'unico'];
    spamKeywords.forEach(word => {
        if (titleLower.includes(word)) spamWords.push(word);
    });
    
    return {
        snapshot_batch_id: meta.batchId,
        search_query: meta.query,
        our_product_sku: meta.sku,
        our_ml_item_id: meta.ourItemId,
        
        ml_item_id: item.id,
        title: item.title,
        price_usd: item.price,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity || 0,
        sold_since: item.sold_since || null,
        condition: item.condition,
        listing_type_id: item.listing_type_id,
        permalink: item.permalink,
        
        seller_id: item.seller?.id?.toString(),
        seller_nickname: item.seller?.nickname,
        seller_reputation_level: item.seller?.seller_reputation?.level_id,
        seller_power_seller: item.seller?.seller_reputation?.power_seller_status,
        
        health_score: health.score,
        health_level: health.level,
        pictures_count: detail.pictures?.length || 0,
        attributes_count: detail.attributes?.length || 0,
        has_description: description.length > 100,
        description_text: description.substring(0, 500), // Guardar preview
        
        logistics_data: {
            pickup_zones: pickupZones,
            delivery_methods: deliveryMethods,
            seller_city: item.seller_address?.city?.name,
            seller_state: item.seller_address?.state?.name,
            local_pickup: item.shipping?.local_pick_up || false,
            spam_words_detected: spamWords
        },
        
        raw_api_response: detail,
        search_position: meta.position,
        search_sort_used: 'relevance_then_sales' // Indica que ordenamos manualmente
    };
}
```

---

## 🧠 FASE 3: ALGORITMO DE SCORING CONTEXTUAL (Fitment vs Price)

Tu investigación sobre atributos críticos (`PART_NUMBER`, `VEHICLE_MODEL`) es clave. Implementamos **dos modos de análisis**:

```javascript
// src/lib/sniper-scoring.js

export function calculateCompetitiveScore(ourItem, leader, allCompetitors, mode = 'auto') {
    // Detectar modo automáticamente
    if (mode === 'auto') {
        // Si la query incluye marca + modelo + año = modo fitment
        // Si la query incluye número de parte o es corta = modo price
        const query = leader.search_query?.toLowerCase() || '';
        const hasVehicleTerms = /\b(toyota|ford|chevrolet|corolla|hilux|201[0-9]|202[0-9])\b/.test(query);
        const hasPartNumber = /\b[0-9]{5,}\b/.test(query); // Números largos típicos de OEM
        
        mode = hasVehicleTerms && !hasPartNumber ? 'fitment' : 'price';
    }
    
    const weights = mode === 'fitment' ? {
        // Modo búsqueda por compatibilidad vehicular
        fitment: 0.35,        // Atributos BRAND, MODEL, PART_NUMBER
        seo_title: 0.20,      // Keywords de vehículo al inicio
        price: 0.15,          // Menos sensible a precio
        photos: 0.15,
        logistics: 0.10,      // Pickup zones
        reputation: 0.05
    } : {
        // Modo búsqueda por número de parte o genérica
        price: 0.30,          // Muy sensible a precio
        seo_title: 0.25,      // Número de parte visible
        photos: 0.20,
        fitment: 0.10,
        attributes: 0.10,     // GTIN, PART_NUMBER exacto
        reputation: 0.05
    };
    
    const scores = {};
    const actions = [];
    
    // 1. FITMENT (Compatibilidad)
    if (mode === 'fitment') {
        const requiredAttrs = ['BRAND', 'MODEL', 'PART_NUMBER'];
        const ourAttrs = new Set((ourItem.attributes || []).map(a => a.id));
        const leaderAttrs = new Set((leader.attributes || []).map(a => a.id));
        
        const missingCritical = requiredAttrs.filter(a => !ourAttrs.has(a) && leaderAttrs.has(a));
        const hasAllCritical = missingCritical.length === 0;
        
        scores.fitment = hasAllCritical ? 100 : Math.max(0, 100 - (missingCritical.length * 30));
        
        if (missingCritical.includes('BRAND')) {
            actions.push({
                priority: 'high',
                type: 'attributes',
                action_code: 'add_brand',
                detail: 'Añade atributo BRAND (Marca del vehículo)',
                impact_estimate: '+20% visibilidad en búsquedas por modelo'
            });
        }
        if (missingCritical.includes('PART_NUMBER')) {
            actions.push({
                priority: 'high',
                type: 'attributes',
                action_code: 'add_part_number',
                detail: `Añade el número de parte: ${leader.attributes?.find(a => a.id === 'PART_NUMBER')?.value_name || 'OEM'}`,
                impact_estimate: '+15% conversiones (búsquedas específicas)',
                current_value: 'No especificado',
                target_value: leader.attributes?.find(a => a.id === 'PART_NUMBER')?.value_name
            });
        }
    }
    
    // 2. PRECIO
    const priceDiff = ourItem.price - leader.price;
    const pricePct = leader.price > 0 ? (priceDiff / leader.price) * 100 : 0;
    
    if (priceDiff <= 0) {
        scores.price = 100;
    } else if (pricePct <= 5) {
        scores.price = 80;
        actions.push({
            priority: 'low',
            type: 'price',
            action_code: 'adjust_price',
            current_value: ourItem.price,
            target_value: leader.price,
            detail: `Estás $${priceDiff.toFixed(2)} más caro. Considera igualar para ganar Buy Box.`,
            impact_estimate: '+5% visibilidad'
        });
    } else if (pricePct <= 15) {
        scores.price = 50;
        actions.push({
            priority: 'medium',
            type: 'price',
            action_code: 'reduce_price',
            current_value: ourItem.price,
            target_value: parseFloat((leader.price * 0.98).toFixed(2)),
            detail: `Baja el precio un ${pricePct.toFixed(0)}% para ser competitivo`,
            impact_estimate: '+15% visibilidad'
        });
    } else {
        scores.price = 20;
        actions.push({
            priority: 'high',
            type: 'price',
            action_code: 'urgent_price_drop',
            current_value: ourItem.price,
            target_value: parseFloat((leader.price * 0.95).toFixed(2)),
            detail: `¡URGENTE! Estás ${pricePct.toFixed(0)}% más caro que el líder.`,
            impact_estimate: '+25% visibilidad, evita pérdida de posición'
        });
    }
    
    // 3. SEO TÍTULO
    let seoScore = 100;
    const ourTitle = ourItem.title || '';
    const leaderTitle = leader.title || '';
    
    // Longitud óptima MLV: 50-60 caracteres
    if (ourTitle.length < 40) {
        seoScore -= 30;
        actions.push({
            priority: 'high',
            type: 'seo',
            action_code: 'extend_title',
            detail: `Título muy corto (${ourTitle.length} chars). Añade especificaciones técnicas.`,
            current_value: ourTitle.length,
            target_value: 55
        });
    } else if (ourTitle.length > 70) {
        seoScore -= 10;
        actions.push({
            priority: 'low',
            type: 'seo',
            action_code: 'shorten_title',
            detail: `Título largo (${ourTitle.length} chars). Optimiza para móviles.`
        });
    }
    
    // Mayúsculas (penalización fuerte en MLV)
    if (ourTitle === ourTitle.toUpperCase()) {
        seoScore -= 40;
        actions.push({
            priority: 'high',
            type: 'seo',
            action_code: 'fix_title_case',
            detail: 'Quita las MAYÚSCULAS. Usa formato "Inicial Mayúscula".',
            impact_estimate: '+15% profesionalismo'
        });
    }
    
    // Palabras spam detectadas en líder (evitarlas) o en nosotros (corregir)
    const ourSpam = leader.logistics_data?.spam_words_detected || [];
    if (ourSpam.length > 0) {
        seoScore -= 20;
        actions.push({
            priority: 'high',
            type: 'seo',
            action_code: 'remove_spam',
            detail: `Elimina palabras penalizadas: ${ourSpam.join(', ')}`
        });
    }
    
    scores.seo_title = Math.max(0, seoScore);
    
    // 4. FOTOS
    const ourPhotos = ourItem.pictures?.length || 0;
    const leaderPhotos = leader.pictures_count || 0;
    
    if (ourPhotos >= leaderPhotos && ourPhotos >= 6) {
        scores.photos = 100;
    } else if (ourPhotos >= leaderPhotos) {
        scores.photos = 80;
    } else {
        const diff = leaderPhotos - ourPhotos;
        scores.photos = Math.max(0, 100 - (diff * 15));
        actions.push({
            priority: diff > 3 ? 'high' : 'medium',
            type: 'content',
            action_code: 'add_photos',
            current_value: ourPhotos,
            target_value: Math.min(10, leaderPhotos + 1),
            detail: `Añade ${diff} foto(s) más. El líder usa ${leaderPhotos}.`,
            impact_estimate: `+${diff * 5}% clicks`
        });
    }
    
    // 5. LOGÍSTICA (Pickup zones para MLV)
    const leaderZones = leader.logistics_data?.pickup_zones || [];
    const ourZones = ourItem.logistics_data?.pickup_zones || []; // Esto vendría de nuestra config
    
    if (leaderZones.length > 0 && ourZones.length === 0) {
        scores.logistics = 40;
        actions.push({
            priority: 'high',
            type: 'logistics',
            action_code: 'enable_pickup',
            detail: `Habilita pickup en: ${leaderZones.join(', ')}. 80% de ventas MLV son pickup.`,
            impact_estimate: '+30% conversiones locales'
        });
    } else {
        scores.logistics = 80;
    }
    
    // Cálculo total ponderado
    const totalScore = Math.round(
        Object.entries(scores).reduce((sum, [key, val]) => {
            return sum + (val * (weights[key] || 0));
        }, 0)
    );
    
    // Ordenar acciones por prioridad
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return {
        mode, // 'fitment' o 'price'
        score_total: totalScore,
        score_breakdown: scores,
        action_plan: actions,
        gaps: {
            price_percent: pricePct,
            missing_attributes: mode === 'fitment' ? requiredAttrs.filter(a => 
                !(ourItem.attributes || []).find(attr => attr.id === a)
            ) : [],
            photo_gap: leaderPhotos - ourPhotos
        }
    };
}
```

---

## 🎨 FASE 4: COMPONENTES UI CLAVE

### 1. Indicador de Modo de Análisis
```javascript
// Muestra si estamos en modo "Fitment" o "Price"
function AnalysisModeBadge({ mode }) {
    return (
        <span className={`px-2 py-1 rounded text-xs font-bold ${
            mode === 'fitment' 
                ? 'bg-blue-900 text-blue-200' 
                : 'bg-green-900 text-green-200'
        }`}>
            {mode === 'fitment' ? '🔧 MODO COMPATIBILIDAD' : '💰 MODO PRECIO'}
        </span>
    );
}
```

### 2. Tarjeta de Logística MLV
```javascript
// Específica para mostrar Pickup Zones y métodos de envío
function LogisticsCard({ data }) {
    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">🚚 Logística Venezuela</h4>
            
            {data.pickup_zones?.length > 0 ? (
                <div className="mb-2">
                    <span className="text-xs text-slate-400">Zonas Pickup:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {data.pickup_zones.map(zone => (
                            <span key={zone} className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded">
                                {zone.replace('_', ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-yellow-500 text-xs mb-2">
                    ⚠️ No ofrece pickup (desventaja en MLV)
                </div>
            )}
            
            {data.delivery_methods?.length > 0 && (
                <div>
                    <span className="text-xs text-slate-400">Envíos mencionados:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {data.delivery_methods.map(method => (
                            <span key={method} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">
                                {method.toUpperCase()}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
```

### 3. Alerta de Palabras Prohibidas
```javascript
function SpamAlert({ words }) {
    if (!words || words.length === 0) return null;
    
    return (
        <div className="bg-red-900/30 border border-red-700 p-3 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Palabras penalizadas detectadas</span>
            </div>
            <p className="text-xs text-red-300 mt-1">
                Elimina del título: {words.join(', ')}. MLV penaliza términos de urgencia.
            </p>
        </div>
    );
}
```

---

## 📋 PROMPT DE DELEGACIÓN FINAL (Actualizado)

> **Contexto:** Implementar "Listing Sniper" para MLV (Venezuela) usando Next.js + Supabase.
> 
> **Hallazgos críticos de la API:**
> 1. Usar `/sites/MLV/search` (sort=relevance) + ordenar por `sold_quantity` en memoria (no existe sort=sold_quantity_desc)
> 2. Usar `/item/{id}/performance` (la API /health fue descontinuada en feb 2025)
> 3. En MLV no existe Mercado Envíos Full. Enfocarse en **Pickup Zones** (Chacao, Sabana Grande, Valencia) y métodos de envío tradicionales (Zoom, Tealca) detectados en descripciones
> 4. `sold_quantity` SÍ viene en búsqueda pública
> 
> **Arquitectura de Datos:**
> - Usar tabla existente `internal_inventory` (SKU, OEM, costo)
> - Crear `mlv_market_snapshots` con `snapshot_batch_id` para análisis temporal
> - Crear `mlv_competitive_analysis` con `action_plan` estructurado (current/target/impact)
> - Crear `competitor_image_refs` para referencias fotográficas
> 
> **Algoritmo de Scoring:**
> - **Modo Fitment** (búsqueda por vehículo): Prioriza atributos BRAND/MODEL/PART_NUMBER (35%), luego SEO (20%)
> - **Modo Price** (búsqueda por número de parte): Prioriza Precio (30%), luego SEO (25%)
> - Penalizar títulos en MAYÚSCULAS (-40 puntos) y palabras spam ('remate', 'urgente')
> 
> **Tareas:**
> 1. SQL: Crear tablas con índices en `snapshot_batch_id`
> 2. API: `/api/tools/sniper/analyze` - Usar multiget para detalles, fetch de descripción para scraping de logística
> 3. API: `/api/tools/sniper/compare` - Implementar scoring contextual con pesos fitment vs price
> 4. UI: Mostrar "Pickup Zones" como métrica crítica, no "Free Shipping"
> 5. UI: Alertas específicas para palabras prohibidas en títulos MLV

---

**¿Necesitas que profundice en la integración con el módulo de imágenes existente (`ml-image-bank`) o en el sistema de tracking de posiciones históricas para medir el impacto de las optimizaciones aplicadas?**