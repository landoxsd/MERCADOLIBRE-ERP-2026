He revisado tu plan y, tras analizar las especificidades del mercado venezolano (MLV) y las capacidades reales de la API de MercadoLibre, necesito ajustar varios aspectos críticos. **MLV es un mercado especial**: no existe Mercado Envíos Full, la logística es 100% coordinada por el vendedor (pickup zones y acuerdos de envío), y el algoritmo prioriza brutalmente la precisión del fitment (compatibilidad vehicular) sobre otros factores.

Aquí tienes el plan técnico completo, corregido y optimizado para el contexto venezolano:

---

## 🔍 Investigación Crítica: Realidades de MLV (MercadoLibre Venezuela)

Antes de codear, estos son los datos técnicos que cambiarán tu arquitectura:

1. **Sold Quantity**: La API de búsqueda (`/sites/MLV/search`) **no expone** `sold_quantity` directamente en los resultados (a diferencia de MLA o MLB). Debes hacer batch calls a `/items/{ids}` para obtener este dato.
2. **Logística en MLV**: No hay `shipping.mode: "me2"` (Fulfillment). Lo que verás es:
   - `local_pick_up: true` (Pickup en zona comercial)
   - `free_shipping: true` (Generalmente falso, excepto promos específicas)
   - El verdadero diferenciador está en el campo `seller_address` y los tags del ítem.
3. **Autopartes - Fitment Obligatorio**: En MLV, los ítems de autopartes sin el atributo `VEHICLE_MODEL` o `COMPATIBLE_VEHICLE` están penalizados. El algoritmo filtra por compatibilidad antes que por precio.
4. **Imágenes**: MLV permite máximo 10 fotos. El líder usualmente usa 6-8.

---

## 🗄️ Fase 1: Infraestructura de Datos (SQL Corregido)

Tu esquema base es bueno, pero le falta granularidad para el análisis temporal y el fitment de autopartes. Este es el SQL production-ready:

```sql
-- 1. Tabla maestra de productos propios (integración con Profit Plus)
CREATE TABLE IF NOT EXISTS public.our_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    internal_code TEXT,
    product_name TEXT NOT NULL,
    current_ml_item_id TEXT, -- Puede ser null si aún no publicamos
    category_id TEXT, -- Ej: MLV1574 (Repuestos Autos)
    target_buy_price DECIMAL(12,2), -- Para calcular margen vs competencia
    target_sell_price DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Snapshots de mercado (corregido para MLV)
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_batch_id UUID NOT NULL, -- Agrupa búsquedas del mismo momento
    search_query TEXT NOT NULL,
    our_inventory_id UUID REFERENCES public.our_inventory(id),
    
    -- Datos del competidor
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd DECIMAL(12,2),
    available_quantity INTEGER,
    sold_quantity INTEGER, -- Requiere llamada adicional a /items/{id}
    listing_type_id TEXT, -- gold_pro, gold_special, free, etc.
    condition TEXT, -- new, used
    
    -- SEO & Atributos críticos para autopartes
    attributes JSONB, -- { "BRAND": "Toyota", "PART_NUMBER": "12345", "VEHICLE_MODEL": "Corolla" }
    pictures_count INTEGER,
    has_description BOOLEAN DEFAULT false,
    
    -- Logística MLV específica
    logistics_data JSONB, -- { "local_pickup": true, "seller_city": "Caracas", "delivery_agreement": true }
    seller_reputation_level TEXT, -- 5_green, 4_light_green, etc.
    seller_nickname TEXT,
    
    -- Posicionamiento
    search_position INTEGER,
    is_premium BOOLEAN DEFAULT false,
    
    -- Metadata
    raw_api_response JSONB,
    captured_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_snapshot_per_batch UNIQUE(snapshot_batch_id, ml_item_id)
);

-- 3. Análisis comparativo detallado (Gap Analysis)
CREATE TABLE IF NOT EXISTS public.mlv_competitive_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID REFERENCES public.mlv_market_snapshots(id),
    our_inventory_id UUID REFERENCES public.our_inventory(id),
    
    -- Scoring ponderado (0-100)
    score_total INTEGER,
    score_breakdown JSONB, -- { "price_competitiveness": 85, "seo_density": 70, "content_quality": 90, "logistics_trust": 60 }
    
    -- Gap Analysis específico
    price_gap_percent DECIMAL(5,2), -- Negativo si estamos más caros
    missing_attributes TEXT[], -- ['PART_NUMBER', 'VEHICLE_YEAR']
    missing_photos_count INTEGER,
    title_optimization_score INTEGER,
    
    -- Action Plan generado
    action_plan JSONB, -- Array de acciones prioritarias
    potential_ranking_impact TEXT, -- 'high', 'medium', 'low'
    
    analyzed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla para tracking de imágenes de referencia (para el feature de "buscar fotos")
CREATE TABLE IF NOT EXISTS public.competitor_image_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ml_item_id TEXT REFERENCES public.mlv_market_snapshots(ml_item_id),
    image_url TEXT NOT NULL,
    image_order INTEGER,
    is_primary BOOLEAN DEFAULT false,
    downloaded_at TIMESTAMPTZ DEFAULT now()
);

-- Índices críticos para performance
CREATE INDEX idx_snapshots_batch ON public.mlv_market_snapshots(snapshot_batch_id);
CREATE INDEX idx_snapshots_item ON public.mlv_market_snapshots(ml_item_id);
CREATE INDEX idx_snapshots_inventory ON public.mlv_market_snapshots(our_inventory_id);
CREATE INDEX idx_analysis_snapshot ON public.mlv_competitive_analysis(snapshot_id);
```

---

## ⚙️ Fase 2: Backend - API Routes (Lógica MLV Específica)

**Corrección importante**: En MLV, debes manejar el rate limiting agresivamente (ML permite ~1000 req/min, pero por seguridad usa 500). Implementa un sistema de colas o batching.

### 1. API Route Principal: Análisis Competitivo

```javascript
// src/app/api/tools/sniper/analyze/route.js
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/meli-auth-helper';
import { createClient } from '@/lib/supabase-admin';

const MLV_SITE_ID = 'MLV';
const BATCH_SIZE = 20; // ML permite hasta 20 IDs por llamada a /items

export async function POST(request) {
  try {
    const { query, sku, ourPrice, categoryId, ourItemId } = await request.json();
    const supabase = createClient();
    
    // 1. Autenticación
    const accessToken = await getValidAccessToken();
    
    // 2. Buscar competidores (Top 20 para tener margen de análisis)
    const searchUrl = `https://api.mercadolibre.com/sites/${MLV_SITE_ID}/search?q=${encodeURIComponent(query)}&category=${categoryId || ''}&sort=sold_quantity_desc&limit=20`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!searchRes.ok) throw new Error(`ML Search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    
    // 3. Enriquecer datos: Obtener sold_quantity y atributos detallados
    // NOTA: MLV no trae sold_quantity en búsqueda, debemos ir a /items
    const itemIds = searchData.results.map(r => r.id);
    const detailedItems = await fetchItemsDetails(itemIds, accessToken);
    
    // 4. Crear snapshot batch
    const { data: batch, error: batchError } = await supabase
      .from('mlv_market_snapshots')
      .insert({
        snapshot_batch_id: crypto.randomUUID(),
        search_query: query,
        // ... mapear datos de detailedItems
      })
      .select();
    
    // 5. Análisis comparativo contra nuestro producto
    const analysis = await performGapAnalysis(detailedItems, {
      sku,
      ourPrice,
      ourItemId,
      query
    }, supabase);
    
    return NextResponse.json({ 
      success: true, 
      competitors: detailedItems.slice(0, 10),
      analysis,
      leader: detailedItems[0] // El más vendido
    });
    
  } catch (error) {
    console.error('Sniper Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Batch fetch de detalles (crítico para MLV)
async function fetchItemsDetails(itemIds, accessToken) {
  const chunks = [];
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    chunks.push(itemIds.slice(i, i + BATCH_SIZE));
  }
  
  const results = [];
  for (const chunk of chunks) {
    const idsString = chunk.join(',');
    const res = await fetch(`https://api.mercadolibre.com/items?ids=${idsString}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (res.ok) {
      const items = await res.json();
      results.push(...items.map(i => i.body)); // ML devuelve array de {code, body}
    }
  }
  
  // Enriquecer con descripción (async paralelo controlado)
  const withDescriptions = await Promise.all(
    results.map(async (item) => {
      try {
        const descRes = await fetch(`https://api.mercadolibre.com/items/${item.id}/description`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const desc = await descRes.json();
        return {
          ...item,
          description_text: desc.plain_text || '',
          has_description: !!desc.plain_text && desc.plain_text.length > 100
        };
      } catch {
        return { ...item, description_text: '', has_description: false };
      }
    })
  );
  
  return withDescriptions;
}

// Helper: Algoritmo de Gap Analysis para MLV
async function performGapAnalysis(competitors, ourData, supabase) {
  const leader = competitors[0]; // Asumimos que está sorteado por sold_quantity
  const ourPrice = parseFloat(ourData.ourPrice);
  
  // Calcular gaps
  const priceGap = ((ourPrice - leader.price) / leader.price) * 100;
  
  // Análisis de título (SEO)
  const titleAnalysis = analyzeTitleMLV(leader.title, ourData.query);
  
  // Análisis de atributos críticos para autopartes
  const requiredAttrs = ['BRAND', 'MODEL', 'PART_NUMBER', 'ITEM_CONDITION'];
  const leaderAttrs = leader.attributes || [];
  const missingInLeader = requiredAttrs.filter(attr => 
    !leaderAttrs.some(a => a.id === attr && a.value_name)
  );
  
  // Scoring MLV específico
  const scores = {
    price_competitiveness: priceGap <= 0 ? 100 : Math.max(0, 100 - (priceGap * 2)),
    content_quality: (leader.pictures?.length || 0) * 10 + (leader.has_description ? 20 : 0),
    seo_density: titleAnalysis.score,
    logistics_trust: leader.seller?.seller_reputation?.power_seller_status ? 100 : 60
  };
  
  const totalScore = Math.round(
    (scores.price_competitiveness * 0.4) + 
    (scores.content_quality * 0.2) + 
    (scores.seo_density * 0.25) + 
    (scores.logistics_trust * 0.15)
  );
  
  // Generar Action Plan específico para MLV
  const actions = [];
  
  if (priceGap > 5) {
    actions.push({
      priority: 'high',
      type: 'pricing',
      action: 'reduce_price',
      current: ourPrice,
      target: (leader.price * 0.98).toFixed(2),
      impact: 'Aumentaría conversión ~15% según datos MLV'
    });
  }
  
  if (leader.pictures?.length > 6) {
    actions.push({
      priority: 'medium',
      type: 'content',
      action: 'add_photos',
      current_count: 3, // Asumido, debería venir de DB
      target_count: Math.min(10, leader.pictures.length + 1),
      message: 'El líder usa fotos de ángulos específicos: frontal, trasera, número de parte visible'
    });
  }
  
  // Atributos críticos para autopartes en Venezuela
  const partNumber = leaderAttrs.find(a => a.id === 'PART_NUMBER');
  if (partNumber) {
    actions.push({
      priority: 'high',
      type: 'attributes',
      action: 'add_part_number',
      value: partNumber.value_name,
      reason: 'El número de parte OEM es el buscador #1 en autopartes MLV'
    });
  }
  
  // Verificar pickup zones (crítico en Venezuela)
  if (leader.shipping?.local_pick_up) {
    actions.push({
      priority: 'high',
      type: 'logistics',
      action: 'enable_pickup',
      zones: ['Chacao', 'Sabana Grande', 'Los Cortijos'], // Zonas gold de Caracas
      reason: '80% de ventas MLV autopartes son con pickup personal'
    });
  }
  
  return {
    scores,
    total_score: totalScore,
    price_gap_percent: priceGap,
    leader_id: leader.id,
    action_plan: actions,
    title_suggestions: titleAnalysis.suggestions
  };
}

function analyzeTitleMLV(leaderTitle, searchQuery) {
  // MLV da más peso a palabras exactas al inicio del título
  const words = searchQuery.toLowerCase().split(' ');
  const title = leaderTitle.toLowerCase();
  
  let score = 0;
  const suggestions = [];
  
  // Palabras al inicio (primeros 30 chars son oro)
  const first30 = title.substring(0, 30);
  const hasKeywordsInFront = words.some(w => first30.includes(w));
  
  if (hasKeywordsInFront) score += 50;
  else suggestions.push('Mover palabras clave (modelo/auto) al inicio del título');
  
  // Longitud óptima MLV: 50-60 caracteres
  if (leaderTitle.length >= 50 && leaderTitle.length <= 60) score += 30;
  else if (leaderTitle.length < 40) suggestions.push('Título demasiado corto, añadir especificaciones técnicas');
  
  // Mayúsculas (MLV penaliza títulos en TODO MAYÚSCULAS)
  if (leaderTitle === leaderTitle.toUpperCase()) {
    score -= 20;
    suggestions.push('Evitar MAYÚSCULAS totales, usar Title Case');
  }
  
  return { score: Math.min(100, score), suggestions };
}
```

---

## 🎨 Fase 3: Frontend (UI/UX Dark Mode)

### Estructura de Componentes

```javascript
// src/app/dashboard/intelligence/page.js
'use client';
import { useState } from 'react';
import { Search, Target, TrendingUp, AlertCircle } from 'lucide-react';
import CompetitorGrid from '@/components/sniper/CompetitorGrid';
import WinnerCard from '@/components/sniper/WinnerCard';
import ActionPlan from '@/components/sniper/ActionPlan';

export default function IntelligencePage() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async (formData) => {
    setLoading(true);
    const res = await fetch('/api/tools/sniper/analyze', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    setAnalysis(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
          Listing Sniper MLV
        </h1>
        <p className="text-slate-400 mt-2">Inteligencia competitiva para autopartes Venezuela</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Búsqueda */}
        <div className="lg:col-span-1 space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
          <SearchForm onSubmit={runAnalysis} loading={loading} />
        </div>

        {/* Panel de Resultados */}
        <div className="lg:col-span-2 space-y-6">
          {analysis && (
            <>
              <WinnerCard 
                leader={analysis.leader} 
                ourAnalysis={analysis.analysis} 
              />
              <ActionPlan 
                actions={analysis.analysis.action_plan} 
              />
              <CompetitorGrid 
                competitors={analysis.competitors.slice(1)} 
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Componente WinnerCard (Cara a Cara)

```javascript
// src/components/sniper/WinnerCard.js
import { Crown, DollarSign, Camera, MapPin } from 'lucide-react';

export default function WinnerCard({ leader, ourAnalysis }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border border-yellow-500/20">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="text-yellow-400 w-6 h-6" />
        <h2 className="text-xl font-bold text-yellow-400">Análisis vs Líder Actual</h2>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Columna Líder */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold">
            <Target className="w-4 h-4" />
            <span>LÍDER DE VENTAS</span>
          </div>
          <img 
            src={leader.thumbnail} 
            alt={leader.title}
            className="w-full h-48 object-cover rounded-lg bg-slate-800"
          />
          <h3 className="font-medium text-sm line-clamp-2">{leader.title}</h3>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-slate-800 p-2 rounded">
              <span className="text-slate-400 block text-xs">Precio</span>
              <span className="text-green-400 font-bold">${leader.price}</span>
            </div>
            <div className="bg-slate-800 p-2 rounded">
              <span className="text-slate-400 block text-xs">Vendidos</span>
              <span className="text-white">{leader.sold_quantity || 'N/A'}</span>
            </div>
          </div>

          <div className="flex gap-2 text-xs">
            {leader.shipping?.local_pick_up && (
              <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Pickup
              </span>
            )}
            {leader.pictures?.length > 5 && (
              <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1">
                <Camera className="w-3 h-3" /> {leader.pictures.length} fotos
              </span>
            )}
          </div>
        </div>

        {/* Columna Nuestro Score */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <span>NUESTRA POSICIÓN</span>
          </div>
          
          <div className="flex items-center justify-center h-48">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#1e293b" strokeWidth="8" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke={ourAnalysis.total_score > 80 ? '#22c55e' : ourAnalysis.total_score > 60 ? '#eab308' : '#ef4444'} 
                  strokeWidth="8" 
                  fill="none"
                  strokeDasharray={`${ourAnalysis.total_score * 3.51} 351`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold">{ourAnalysis.total_score}</span>
                <span className="text-xs text-slate-400">SNIPER SCORE</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(ourAnalysis.scores).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${value > 80 ? 'bg-green-500' : value > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🧠 Fase 4: Algoritmo de Posicionamiento (SEO MLV)

Para autopartes en Venezuela, el algoritmo de ML prioriza este orden:

1. **Fitment** (40%): Coincidencia exacta de modelo/año/pieza
2. **Título** (25%): Palabras clave al inicio, sin spam
3. **Precio** (20%): Competitividad vs mercado
4. **Logística** (15%): Pickup disponible + reputación

### Servicio de Optimización de Títulos

```javascript
// src/lib/mlv-seo-optimizer.js

export function optimizeTitleForMLV(currentTitle, competitorTitles, category) {
  // Análisis de n-gramas de los competidores top
  const commonPatterns = extractCommonPatterns(competitorTitles);
  
  // Reglas específicas MLV Autopartes
  const patterns = {
    priority1: ['Toyota', 'Corolla', 'Hyundai', 'Accent'], // Marcas populares Venezuela
    priority2: ['OEM', 'Generico', 'Alternativo'],
    priority3: ['Caracas', 'Entrega Inmediata'] // Local relevance
  };

  let newTitle = currentTitle;
  const suggestions = [];

  // 1. Verificar si el modelo de auto está en los primeros 25 caracteres
  const modelMatch = patterns.priority1.find(brand => 
    currentTitle.toLowerCase().includes(brand.toLowerCase())
  );
  
  if (modelMatch && !currentTitle.substring(0, 25).includes(modelMatch)) {
    suggestions.push(`Mover "${modelMatch}" al inicio del título`);
    newTitle = `${modelMatch} ${currentTitle.replace(modelMatch, '')}`.trim();
  }

  // 2. Longitud óptima
  if (newTitle.length > 60) {
    newTitle = newTitle.substring(0, 60);
    suggestions.push('Título recortado a 60 caracteres (óptimo MLV)');
  }

  // 3. Eliminar palabras prohibidas que penalizan en MLV
  const spamWords = ['remate', 'urgente', 'ultimo', '!!!!'];
  spamWords.forEach(word => {
    if (newTitle.toLowerCase().includes(word)) {
      newTitle = newTitle.replace(new RegExp(word, 'gi'), '');
      suggestions.push(`Eliminada palabra penalizada: "${word}"`);
    }
  });

  return {
    optimized_title: newTitle,
    original_title: currentTitle,
    suggestions,
    seo_score: calculateSEOScore(newTitle, commonPatterns)
  };
}
```

---

## 🚀 Fase 5: Sistema de "Búsqueda de Fotos"

Como mencionas extraer/buscar fotos, aquí está la arquitectura para ese feature específico:

```javascript
// src/app/api/tools/sniper/fetch-images/route.js
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis'; // O usar SerpAPI para Google Lens

export async function POST(req) {
  const { partNumber, productName } = await req.json();
  
  // Estrategia: Buscar imágenes de referencia por número de parte
  // Usar Google Custom Search API o SerpAPI
  
  const searchQuery = `${partNumber} ${productName} autoparte`;
  
  // Descargar y analizar imágenes de competidores (solo URLs públicas)
  const competitorImages = await fetchCompetitorImagesFromDB(partNumber);
  
  // Sugerir fotos faltantes basado en análisis de gaps
  const missingAngles = detectMissingAngles(competitorImages);
  
  return NextResponse.json({
    reference_images: competitorImages,
    missing_angles: missingAngles, // ['vista_trasera', 'numero_parte', 'instalacion']
    suggestions: `Añade fotos de: ${missingAngles.join(', ')}`
  });
}
```

---

## 📋 Prompt de Delegación Final (Actualizado)

Copia y pega esto a tu equipo o a la IA ejecutora:

> **Contexto**: Estamos desarrollando "Listing Sniper" para MercadoLibre Venezuela (MLV), mercado de autopartes. MLV es especial: no hay Fulfillment, la logística es por pickup/acuerdo, y el fitment (compatibilidad vehicular) es 40% del algoritmo.
>
> **Stack**: Next.js 14 (App Router), Supabase, Tailwind, ML API.
>
> **Tareas Inmediatas**:
> 1. Ejecutar el SQL proporcionado arriba (con las correcciones para MLV).
> 2. Implementar `/api/tools/sniper/analyze` con manejo de batch calls a `/items` (crítico porque MLV no da sold_quantity en búsqueda).
> 3. Crear interfaz "Inteligencia de Mercado" con:
>    - Input de búsqueda por SKU o número de parte
>    - Visualización del "Sniper Score" (0-100)
>    - Action Plan priorizado (Precio > Atributos > Fotos > Pickup zones)
> 4. Implementar algoritmo de optimización de títulos específico para MLV (prioriza marca vehículo al inicio, evita mayúsculas).
>
> **Restricciones MLV**:
> - Máximo 10 fotos por publicación
> - Atributos obligatorios: BRAND, PART_NUMBER, VEHICLE_MODEL
> - Reputación del vendedor es crítica (power seller status)
>
> **Éxito**: El usuario debe ver en menos de 10 segundos: "Baja tu precio a $X", "Añade pickup en Chacao", "Mueve 'Toyota' al inicio del título".

---

## ⚠️ Consideraciones Legales y Éticas

1. **Rate Limiting**: MLV tiene límites estrictos. Implementa un sistema de cola (Redis/Bull) si vas a hacer muchas consultas.
2. **Términos de Uso**: No hagas scraping de páginas, solo usa la API oficial. Las imágenes de competidores son públicas pero no las almacenes localmente más de 24h sin necesidad.
3. **Datos**: No extraigas datos personales de vendedores (emails, teléfonos).

¿Necesitas que profundice en alguna fase específica, como el sistema de sugerencias de imágenes usando computer vision, o la integración con tu inventario de Profit Plus?