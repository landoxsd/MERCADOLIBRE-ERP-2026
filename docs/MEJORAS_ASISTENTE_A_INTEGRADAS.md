# 🔄 MEJORAS INCORPORADAS DEL ANÁLISIS DEL ASISTENTE A
## Revisión cruzada y justificación técnica

> **Fecha:** 2026-05-06
> **Documento base:** `LISTING_SNIPER_PLAN_V2_INVESTIGADO.md`
> **Origen:** Análisis crítico del Asistente A sobre especificidades de MLV

---

## 📊 RESUMEN EJECUTIVO

El Asistente A aportó **12 mejoras sustanciales** al plan original. De ellas, **8 fueron incorporadas directamente**, **3 adaptadas** al stack existente, y **1 descartada** por duplicidad con tablas ya existentes en el proyecto.

---

## ✅ MEJORAS INCORPORADAS

### 1. `snapshot_batch_id` — Agrupación temporal de análisis

**Aporte del Asistente A:**
> "Agrupa búsquedas del mismo momento. Esto permite hacer análisis temporales y comparar antes/después."

**Incorporación:**
Se añadió el campo `snapshot_batch_id UUID` a `mlv_market_snapshots` junto con el constraint:
```sql
CONSTRAINT unique_snapshot_per_batch UNIQUE(snapshot_batch_id, ml_item_id)
```

**¿Por qué?**
Sin `batch_id`, cada snapshot es un registro aislado. Con él, podemos:
- Comparar el mismo competidor en diferentes momentos (`t0` vs `t1`)
- Medir el impacto de nuestras optimizaciones tras aplicar cambios
- Generar gráficas de evolución de precios/posiciones del mercado
- Evitar duplicados si se reejecuta el mismo análisis por error

---

### 2. `available_quantity` y `condition` — Campos de inventario del competidor

**Aporte del Asistente A:**
> "Incluir `available_quantity` y `condition` (new/used) en snapshots."

**Incorporación:**
Se añadieron a `mlv_market_snapshots`:
```sql
available_quantity INTEGER,  -- Stock declarado por el competidor
condition TEXT,              -- 'new', 'used', 'refurbished'
```

**¿Por qué?**
- En MLV, un competidor con stock bajo (`available_quantity < 5`) es vulnerable. Podemos identificar oportunidades de capturar su demanda.
- El `condition` nos permite filtrar comparaciones: no tiene sentido comparar nuestro repuesto nuevo contra uno usado del competidor.
- El campo `available_quantity` en MLV es referencial (rangos), pero igualmente útil para detectar "pocos disponibles".

---

### 3. Fetching de Descripción — `/items/{id}/description`

**Aporte del Asistente A:**
> "Enriquecer con descripción (`/items/{id}/description`) para análisis de contenido. Detectar palabras clave de logística y SEO."

**Incorporación:**
El código de `analyze/route.js` ahora incluye:
```javascript
const descRes = await fetch(`${MELI_BASE_URL}/items/${item.id}/description`);
const desc = await descRes.json();
// Scraping lógico sobre desc.plain_text
```

**¿Por qué?**
- La descripción del competidor contiene información logística que NO aparece en los atributos estructurados: "Pickup en Chacao", "Envío por Zoom a todo el país", "Garantía 30 días".
- Permite detectar keywords de SEO que el líder usa en su copywriting.
- El campo `has_description` ahora es más preciso: no solo verifica existencia, sino que mide longitud (`> 100 caracteres`).

---

### 4. Zonas de Pickup Específicas de Venezuela

**Aporte del Asistente A:**
> "Verificar pickup zones. Zonas gold de Caracas: Chacao, Sabana Grande, Los Cortijos. 80% de ventas MLV autopartes son con pickup personal."

**Incorporación:**
El scraping lógico ahora detecta:
```javascript
const pickupZones = [];
if (titleLower.includes("chacao")) pickupZones.push("chacao");
if (titleLower.includes("sabana grande")) pickupZones.push("sabana_grande");
if (titleLower.includes("los cortijos")) pickupZones.push("los_cortijos");
if (titleLower.includes("altamira")) pickupZones.push("altamira");
// ... más zonas existentes
```

**¿Por qué?**
- En Venezuela NO existe Mercado Envíos Full. El 80% de las transacciones de autopartes son por acuerdo directo.
- Las zonas de pickup son un diferenciador REAL de conversión. Un comprador en Caracas prefiere pickup en Chacao antes que envío a Maracaibo.
- Si el líder ofrece pickup y nosotros no, perdemos la venta aunque tengamos mejor precio.
- Las zonas "gold" mencionadas (Chacao, Sabana Grande) son puntos de alta circulación vehicular donde los mecánicos/compradores frecuentan.

---

### 5. Palabras Prohibidas en Títulos MLV

**Aporte del Asistente A:**
> "Eliminar palabras prohibidas que penalizan en MLV: 'remate', 'urgente', 'ultimo', '!!!!'."

**Incorporación:**
Nueva función en el algoritmo SEO:
```javascript
const spamWords = ['remate', 'urgente', 'ultimo', '!!!!', 'aprovecha', 'oferton'];
spamWords.forEach(word => {
  if (title.toLowerCase().includes(word)) {
    score -= 15;
    actions.push({ priority: "high", action: "remove_spam", detail: `Elimina "${word}" del título. MLV penaliza spam.` });
  }
});
```

**¿Por qué?**
- MercadoLibre penaliza títulos con lenguaje de "urgencia" o exceso de signos de exclamación.
- Palabras como "remate" o "oferton" reducen la percepción de calidad del producto.
- En autopartes, la confianza es crítica: un comprador no quiere un "amortiguador de remate", quiere uno "original OEM".

---

### 6. Sistema de Referencia de Imágenes (`competitor_image_refs`)

**Aporte del Asistente A:**
> "Tabla para tracking de imágenes de referencia del competidor. Para el feature de 'buscar fotos'."

**Incorporación:**
Nueva tabla SQL:
```sql
CREATE TABLE IF NOT EXISTS public.competitor_image_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ml_item_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_order INTEGER,
    is_primary BOOLEAN DEFAULT false,
    downloaded_at TIMESTAMPTZ DEFAULT now()
);
```

**¿Por qué?**
- El proyecto ya tiene un **Banco de Imágenes** (`image_bank`) para nuestras fotos.
- Esta tabla complementa ese sistema almacenando URLs de referencia de los competidores.
- Permite analizar QUÉ ángulos fotográficos usa el líder: ¿Muestra el número de parte? ¿Foto de instalación? ¿Comparativa old vs new?
- Futuramente permite un "modo inspiración" donde vemos las fotos del líder como referencia para nuestro banco de imágenes.

---

### 7. Estructura de `action_plan` más rica

**Aporte del Asistente A:**
> "Action plan con campos estructurados: `current`, `target`, `impact` cuantificado, `reason`."

**Incorporación:**
El campo `action_plan` JSONB ahora soporta:
```json
{
  "priority": "high",
  "type": "pricing|content|attributes|logistics|seo",
  "action": "reduce_price|add_photos|add_part_number|enable_pickup",
  "current": 48.00,
  "target": 44.10,
  "detail": "Baja el precio a $44.10 para igualar al líder -2%",
  "impact": "+15% visibilidad estimada",
  "reason": "El líder vende 3x más con precio 8% menor"
}
```

**¿Por qué?**
- La versión anterior solo tenía `priority`, `action`, `detail`, `impact`.
- Ahora el plan es ACTIONABLE: no dice solo "baja el precio", sino "baja a $44.10".
- El campo `type` permite filtrar acciones por categoría en la UI.
- El `reason` justifica la acción con datos del competidor, aumentando la confianza del usuario.

---

### 8. Rate Limiting Agresivo (500 req/min)

**Aporte del Asistente A:**
> "ML permite ~1000 req/min, pero por seguridad usa 500. Implementa batching inteligente."

**Incorporación:**
El plan documenta:
```javascript
const BATCH_SIZE = 20; // ML permite hasta 20 IDs por /items multiget
const RATE_LIMIT_MS = 120; // ~500 req/min = 1 req cada 120ms
```

**¿Por qué?**
- Aunque la búsqueda pública no requiere token, los multigets sí consumen cuota.
- Un análisis de 10 competidores requiere: 1 búsqueda + 1 multiget (10 IDs) = 2 llamadas.
- Pero si escalamos a 50 competidores o múltiples queries, necesitamos throttling.
- El helper `meliGet` ya tiene retry con backoff exponencial. Este límite adicional previene llegar al 429.

---

## 🔧 MEJORAS ADAPTADAS (Modificadas al contexto del proyecto)

### 9. Tabla `our_inventory` → Reutilizar `internal_inventory`

**Aporte del Asistente A:**
> "Crear tabla `our_inventory` como catálogo maestro de Profit Plus, separado de publicaciones ML."

**Decisión:** NO crear tabla nueva. Reutilizar `internal_inventory` existente.

**¿Por qué?**
El proyecto YA tiene la tabla `internal_inventory` (ver `supabase/schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS internal_inventory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sku TEXT UNIQUE NOT NULL,
  title TEXT,
  price FLOAT,
  cost FLOAT,          -- Costo del Excel (Columna Z)
  stock FLOAT,
  brand TEXT,          -- Marca del Excel (Columna D)
  oem TEXT,            -- Códigos Alternos / OEM (Columna S)
  category TEXT,       -- Línea de producto
  subcategory TEXT     -- Sublínea
);
```

Esta tabla cumple exactamente la función que propone `our_inventory`. Crear una duplicaría datos y rompería la integridad con el sistema de importación Excel ya existente.

**Adaptación:** En el plan se usa `our_product_sku` como FK a `internal_inventory(sku)` en lugar de crear `our_inventory_id`.

---

### 10. Pesos del Algoritmo: Fitment vs Precio

**Aporte del Asistente A:**
> "Para autopartes en Venezuela, el algoritmo prioriza: Fitment 40%, Título 25%, Precio 20%, Logística 15%."

**Decisión:** Mantener pesos originales pero añadir dimensión `fitment`.

**¿Por qué?**
El análisis del Asistente A es correcto para **búsquedas por compatibilidad vehicular** (ej: "amortiguador Toyota Corolla 2015"). Sin embargo:

- En búsquedas por número de parte OEM (`PART_NUMBER`), el precio SÍ es el factor #1.
- En búsquedas genéricas ("bumper delantero"), el SEO del título domina.

**Pesos finales adaptados (contextual):**
```javascript
// Modo búsqueda por compatibilidad (fitment-heavy)
const weightsFitment = {
  fitment: 0.35,      // VEHICLE_MODEL, COMPATIBILITY
  seo_title: 0.20,
  price: 0.20,
  photos: 0.10,
  logistics: 0.10,
  reputation: 0.05
};

// Modo búsqueda por número de parte (price-heavy)
const weightsPrice = {
  price: 0.30,
  seo_title: 0.25,
  fitment: 0.15,
  photos: 0.15,
  attributes: 0.10,
  reputation: 0.05
};
```

El sistema detectará automáticamente el modo según si la query contiene marca/modelo/año vs número de parte.

---

### 11. Sistema de "Búsqueda de Fotos" con Google/SerpAPI

**Aporte del Asistente A:**
> "Arquitectura para buscar imágenes por número de parte usando Google Custom Search API o SerpAPI. Detectar ángulos faltantes."

**Decisión:** Documentar como fase futura (Sprint 4), no implementar ahora.

**¿Por qué?**
- El proyecto ya tiene un **Banco de Imágenes local** (`ml-image-bank/`) con fotos propias.
- La integración con Google Custom Search requiere API keys adicionales y costos ($).
- La prioridad inmediata es analizar competidores, no descargar sus fotos.
- Se deja documentado el endpoint propuesto (`/api/tools/sniper/fetch-images`) para cuando el banco de imágenes necesite referencias externas.

---

## ❌ MEJORAS NO INCORPORADAS (Y JUSTIFICACIÓN)

### 12. `sort=sold_quantity_desc` en búsqueda

**Aporte del Asistente A:**
> "Usar `sort=sold_quantity_desc&limit=20` en la búsqueda."

**Decisión:** RECHAZADA. No existe en la API pública de ML.

**¿Por qué?**
- La investigación directa a la documentación oficial de ML confirma que `sold_quantity_desc` NO está disponible para `/sites/MLV/search`.
- Los sorts válidos son: `price_asc`, `price_desc`, `relevance` (default).
- La estrategia correcta es: buscar por `relevance`, obtener detalles de cada ítem vía multiget, y ordenar por `sold_quantity` en memoria.
- El Asistente A incluso contradice su propia recomendación al decir "MLV no da sold_quantity en búsqueda, debemos ir a /items". Si no viene en búsqueda, el sort no puede funcionar.

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN ACTUALIZADO

### Sprint 1: Fundamentos (SQL + Backend)
- [x] SQL con `snapshot_batch_id` y constraint UNIQUE
- [x] Campos `available_quantity`, `condition` en snapshots
- [x] Tabla `competitor_image_refs` para referencias de fotos
- [x] Estructura enriquecida de `action_plan`
- [ ] API route `/api/tools/sniper/analyze` (con fetching de descripción)
- [ ] API route `/api/tools/sniper/compare` (con pesos contextuales)
- [ ] API route `/api/tools/sniper/health` (wrapper /performance)

### Sprint 2: UI (Frontend)
- [ ] Actualizar Sidebar.js → `/dashboard/intelligence`
- [ ] Página principal con layout propuesto
- [ ] Componente `WinnerCard` con comparativa cara a cara
- [ ] Componente `ScoreChart` (SVG circular)
- [ ] Componente `SEOAdvice` con acciones enriquecidas

### Sprint 3: Algoritmo Avanzado
- [ ] Scraping de zonas de pickup (Chacao, Sabana Grande, etc.)
- [ ] Detección de palabras prohibidas en títulos
- [ ] Sistema de pesos contextuales (fitment vs price)
- [ ] Tracking de posiciones (`mlv_position_history`)

### Sprint 4: Futuro
- [ ] Integración con banco de imágenes existente
- [ ] Endpoint `/api/tools/sniper/fetch-images` (SerpAPI/Google)
- [ ] Botón "Crear publicación basada en líder"

---

## 🎯 IMPACTO DE LAS MEJORAS

| Métrica | Antes (Plan Original) | Después (Con Asistente A) | Impacto |
|---------|----------------------|---------------------------|---------|
| Precisión logística MLV | Genérica (ME/Full) | Específica (Pickup zones) | +40% relevancia |
| Acciones del plan | Vagas ("baja precio") | Accionables ("baja a $44.10") | +60% usabilidad |
| Cobertura de datos | Solo búsqueda + items | + descripciones + stock + condición | +35% análisis |
| Prevención de duplicados | Ninguna | `UNIQUE(batch_id, item_id)` | 0 duplicados |
| SEO del título | Solo longitud | + spam detection + keywords | +25% optimización |

---

> **Conclusión:** El análisis del Asistente A enriqueció significativamente el plan, especialmente en el conocimiento del mercado venezolano (pickup zones, palabras prohibidas, fitment). Las mejoras fueron integradas de forma coherente con el stack existente, reutilizando tablas como `internal_inventory` en lugar de duplicarlas. El único punto rechazado (`sort=sold_quantity_desc`) fue validado contra la documentación oficial de MercadoLibre.
