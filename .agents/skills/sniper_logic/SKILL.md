---
name: sniper_logic
description: Inteligencia de mercado y algoritmos de comparación competitiva para el sector autopartes en MLV. Incluye Seller Spy (rayos X de cuentas de competidores), Radar de Categorías (semáforos de nichos), Top 20 Ganadores, Keywords Inverso y Big Data Export.
---

# sniper_logic

💡 Esta habilidad permite realizar ingeniería inversa de la competencia para identificar brechas de mercado y oportunidades de venta en MercadoLibre Venezuela.

## Usage

Use esta habilidad cuando necesite:
- Comparar una publicación propia contra el líder de ventas.
- Calcular puntajes de competitividad (Sniper Score).
- Detectar zonas de pickup estratégicas en la competencia.
- Generar un plan de acción basado en SEO, precio y fotos.
- **Espiar la cuenta completa de un competidor** (Seller Spy): escanear todo su catálogo, calcular ingresos, Market Share por producto y matriz logística.
- **Radar de Categorías**: detectar si un nicho está creciendo o muriendo con semáforos visuales.
- **Búsqueda por IDs directos**: pegar IDs tipo `MLV818066302` o URLs en el buscador para modo quirúrgico.

## Arquitectura del Sistema (2026)

### Flujo de datos completo

```
INPUT: query (texto) | sku (interno) | ourItemId (MLV...)
                │
                ▼
  [Backend] src/app/api/tools/sniper/analyze/route.js
                │
    ┌───────────┴──────────────┐
    │                          │
    ▼                          ▼
  Si ourItemId               Si solo query:
  → /items/{id} con token    → PLAYWRIGHT SCRAPER
    → multiget competidores  → listado.mercadolibre.com.ve
                             → page.content() HTML
                             → parse polycards → IDs MLV
                             → multiget /items?ids=...
                │
                ▼
     [Scoring] src/lib/sniper-scoring.js
     [Helpers] src/lib/sniper-helpers.js
                │
                ▼
     [Supabase] intelligence_snapshots
```

### Fuentes de datos de competidores

1. **Primaria**: Playwright scraper sobre `listado.mercadolibre.com.ve/{query}`
   - El endpoint `api.mercadolibre.com/sites/MLV/search` está bloqueado (403 permanente)
   - Playwright usa Chromium real → pasa Akamai → descarga HTML completo
   - Extrae IDs MLV del HTML, luego enriches via multiget con token

2. **Secundaria**: Si el usuario ingresa `ourItemId` (MLV...)
   - El sistema extrae la categoría del ítem propio
   - Busca otros ítems del mismo vendedor para comparar

## Steps

1. **Búsqueda**: Playwright scraper extrae los 10-20 primeros resultados del listado.
2. **Enriquecimiento**: Multiget `/items?ids=...` con token para obtener `sold_quantity`, fotos, atributos.
3. **Gap Analysis**: Comparar Título, Precio, Fotos, Atributos y Logística.
4. **Scoring**: Aplicar pesos (30% Precio, 25% SEO, 20% Fotos, 15% Atributos, 10% Logística).
5. **Recomendación**: Generar lista de acciones prioritarias (ActionPlan).

## Segmentación por Modelos (Vehicle Split)

Para dominar el mercado de autopartes:
- **Identificar Modelos**: Usar lista maestra de modelos (Aveo, Spark, Corolla, etc.) para detectar aplicaciones múltiples.
- **Evitar Colisiones**: Modelos contenidos en otros (ej. "Cherokee" vs "Grand Cherokee") → manejar como entidad única.
- **Generación de Variants**: Crear publicaciones individuales por modelo para aparecer en búsquedas específicas.

## Scoring Sniper (pesos)

| Factor       | Peso | Descripción |
|--------------|------|-------------|
| Precio       | 30%  | Competitividad del precio vs. líder |
| SEO (Título) | 25%  | Palabras clave, límite 60 chars |
| Fotos        | 20%  | Cantidad y calidad de imágenes |
| Atributos    | 15%  | Completitud de ficha técnica |
| Logística    | 10%  | Envío gratis, cobertura geográfica |

## Componentes del Frontend

- `src/app/dashboard/intelligence/page.js` — Panel principal
  - 3 inputs: query, SKU interno, ML Item ID
  - Filtros multi-zona y selector de top (10 a 25)
  - Cálculos de mercado dinámicos
  - **Modo Quirúrgico**: detecta IDs `MLV...` en el input y los procesa directamente
- `src/components/intelligence/CompetitorGrid.js` — Grid de competidores
  - Extrae SKU, Marca, Fotos, Ventas
  - Botón `🕵️ Espiar` al lado del nombre de cada vendedor → `/dashboard/spy/{seller_id}`
  - Exportación a CSV con atributos pivotados dinámicamente
- `src/components/intelligence/AnalysisModeBadge.js` — Badge de modo
- `src/components/intelligence/SpamAlert.js` — Alerta de spam/saturación
- `src/components/intelligence/ActionPlan.js` — Plan de acciones

## Módulos en Desarrollo (Radar de Mercado)

| Módulo | Ruta Frontend | Ruta API | Estado |
|--------|--------------|----------|--------|
| Seller Spy | `/dashboard/spy/[seller_id]` | `/api/tools/sniper/seller` | 🔜 Sprint 1 |
| Radar Categorías | `/dashboard/radar` | `/api/tools/radar/category` | ⬜ Sprint 2 |
| Top 20 Ganadores | `/dashboard/radar` (sub-vista) | `/api/tools/radar/top-products` | ⬜ Sprint 3 |
| Keywords Inverso | `/dashboard/keywords` | `/api/tools/keywords` | ⬜ Sprint 4 |
| Big Data Export | `/dashboard/export` | `/api/tools/export/combined` | ⬜ Sprint 5 |

## Supabase Tables

- `mlv_market_snapshots` — historial de análisis de búsquedas guardados
- `meli_accounts` — tokens de acceso ML
- `seller_spy_sessions` — sesiones de espionaje de cuentas completas (cache 6h)
- `seller_spy_items` — publicaciones individuales por sesión espiada
- `category_radar_snapshots` — snapshots de categorías para semáforos de tendencia
- `category_keywords` — keywords por categoría con volumen y conversión
