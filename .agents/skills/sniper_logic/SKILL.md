---
name: sniper_logic
description: Inteligencia de mercado y algoritmos de comparaciÃ³n competitiva para el sector autopartes en MLV. Incluye Seller Spy (rayos X de cuentas de competidores), Radar de CategorÃ­as (semÃ¡foros de nichos), Top 20 Ganadores, Keywords Inverso y Big Data Export.
---

# sniper_logic

ðŸ’¡ Esta habilidad permite realizar ingenierÃ­a inversa de la competencia para identificar brechas de mercado y oportunidades de venta en MercadoLibre Venezuela.

## Usage

Use esta habilidad cuando necesite:
- Comparar una publicaciÃ³n propia contra el lÃ­der de ventas.
- Calcular puntajes de competitividad (Sniper Score).
- Detectar zonas de pickup estratÃ©gicas en la competencia.
- Generar un plan de acciÃ³n basado en SEO, precio y fotos.
- **Espiar la cuenta completa de un competidor** (Seller Spy): escanear todo su catÃ¡logo, calcular ingresos, Market Share por producto y matriz logÃ­stica.
- **Radar de CategorÃ­as**: detectar si un nicho estÃ¡ creciendo o muriendo con semÃ¡foros visuales.
- **BÃºsqueda por IDs directos**: pegar IDs tipo `MLV818066302` o URLs en el buscador para modo quirÃºrgico.

## Arquitectura del Sistema (2026)

### Flujo de datos completo

```
INPUT: query (texto) | sku (interno) | ourItemId (MLV...)
                â”‚
                â–¼
  [Backend] src/app/api/tools/sniper/analyze/route.js
                â”‚
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”�
    â”‚                          â”‚
    â–¼                          â–¼
  Si ourItemId               Si solo query:
  â†’ /items/{id} con token    â†’ PLAYWRIGHT SCRAPER
    â†’ multiget competidores  â†’ listado.mercadolibre.com.ve
                             â†’ page.content() HTML
                             â†’ parse polycards â†’ IDs MLV
                             â†’ multiget /items?ids=...
                â”‚
                â–¼
     [Scoring] src/lib/sniper-scoring.js
     [Helpers] src/lib/sniper-helpers.js
                â”‚
                â–¼
     [Supabase] intelligence_snapshots
```

### Fuentes de datos de competidores

1. **Primaria**: Playwright scraper sobre `listado.mercadolibre.com.ve/_CustId_...` o `/nombre-vendedor`
   - El endpoint `api.mercadolibre.com/sites/MLV/search?seller_id=` estÃ¡ completamente bloqueado (403 permanente) por Akamai y polÃ­ticas de privacidad para tokens de competidores.
   - Seller Spy y Radar ahora usan **Playwright (Chromium real)** para paginar `_CustId_{id}` y descargar IDs del catÃ¡logo saltando a Akamai, y luego los enriquece usando multiget.

2. **Secundaria**: Si el usuario ingresa `ourItemId` (MLV...) en Listing Sniper
   - El sistema extrae la categorÃ­a del Ã­tem propio y busca otros Ã­tems del mismo vendedor para comparar.

## Steps de Espionaje

1. **Resolución**: `/api/tools/sniper/resolve` analiza la cadena ingresada. Extrae IDs si son links, busca al usuario si es nickname y devuelve el `seller_id` limpio. 
   * **Actualización 2026**: Para nicknames, usa el microservicio Python (`/resolve-nickname` con Camoufox) abriendo la página de perfil `mercadolibre.com.ve/perfil/{nickname}` para extraer el `_CustId_` oculto, sorteando bloqueos de Anubis.
2. **Búsqueda**: Playwright scraper extrae los items de la tienda o catálogo del vendedor.
3. **Enriquecimiento**: Multiget `/items?ids=...` con token para obtener `sold_quantity`, fotos, atributos.
4. **Gap Analysis**: Comparar Título, Precio, Fotos, Atributos y Logística contra la cuenta del ERP vinculada.
5. **Scoring**: Aplicar pesos (30% Precio, 25% SEO, 20% Fotos, 15% Atributos, 10% Logística).
6. **Recomendación**: Generar lista de acciones prioritarias (ActionPlan).

## SegmentaciÃ³n por Modelos (Vehicle Split)

Para dominar el mercado de autopartes:
- **Identificar Modelos**: Usar lista maestra de modelos (Aveo, Spark, Corolla, etc.) para detectar aplicaciones mÃºltiples.
- **Evitar Colisiones**: Modelos contenidos en otros (ej. "Cherokee" vs "Grand Cherokee") â†’ manejar como entidad Ãºnica.
- **GeneraciÃ³n de Variants**: Crear publicaciones individuales por modelo para aparecer en bÃºsquedas especÃ­ficas.

## Scoring Sniper (pesos)

| Factor       | Peso | DescripciÃ³n |
|--------------|------|-------------|
| Precio       | 30%  | Competitividad del precio vs. lÃ­der |
| SEO (TÃ­tulo) | 25%  | Palabras clave, lÃ­mite 60 chars |
| Fotos        | 20%  | Cantidad y calidad de imÃ¡genes |
| Atributos    | 15%  | Completitud de ficha tÃ©cnica |
| LogÃ­stica    | 10%  | EnvÃ­o gratis, cobertura geogrÃ¡fica |

## Componentes del Frontend

- `src/app/dashboard/intelligence/page.js` â€” Panel de comparaciÃ³n (Listing Sniper)
  - 3 inputs: query, SKU interno, ML Item ID
  - Filtros multi-zona y selector de top (10 a 25)
  - CÃ¡lculos de mercado dinÃ¡micos
  - **Modo QuirÃºrgico**: detecta IDs `MLV...` en el input y los procesa directamente
- `src/app/dashboard/spy/page.js` â€” Landing Page de Seller Spy
  - Buscador inteligente multi-entrada (links, nicknames, IDs, publicaciones).
  - Panel de historial de escaneos guardados en base a componentes `.glass-card`.
- `src/app/dashboard/spy/[seller_id]/page.js` â€” Dashboard individual de espionaje
  - KPI bars, Donut charts por categorÃ­as de competidores y Matriz LogÃ­stica.
  - Tabla interactiva con opciÃ³n de exportaciÃ³n CSV enriquecida y atributos pivotados.
- `src/components/intelligence/CompetitorGrid.js` â€” Grid de competidores
  - Extrae SKU, Marca, Fotos, Ventas
  - BotÃ³n `ðŸ•µï¸� Espiar` al lado del nombre de cada vendedor â†’ `/dashboard/spy/{seller_id}`

## MÃ³dulos de Inteligencia (Radar de Mercado)

| MÃ³dulo | Ruta Frontend | Ruta API | Estado |
|--------|--------------|----------|--------|
| Seller Spy | `/dashboard/spy/[seller_id]` | `/api/tools/sniper/seller` | âœ… Completado |
| Radar CategorÃ­as | `/dashboard/radar` | `/api/tools/radar/category` | âœ… Completado |
| Top 20 Ganadores | `/dashboard/radar/[category_id]` | `/api/tools/radar/top-products` | âœ… Completado |
| Keywords Inverso | `/dashboard/keywords` | `/api/tools/keywords` | âœ… Completado |
| Big Data Export | `/dashboard/export` | `/api/tools/export/combined` | âœ… Completado |

## Supabase Tables

- `mlv_market_snapshots` â€” historial de anÃ¡lisis de bÃºsquedas guardados
- `meli_accounts` â€” tokens de acceso ML
- `seller_spy_sessions` â€” sesiones de espionaje de cuentas completas (cache 6h)
- `seller_spy_items` â€” publicaciones individuales por sesiÃ³n espiada
- `category_radar_snapshots` â€” snapshots de categorÃ­as para semÃ¡foros de tendencia
- `category_keywords` â€” keywords por categorÃ­a con volumen y conversiÃ³n


## Extracción de Imágenes Anti-Bot (Image Hunter)

Para evadir los bloqueos estrictos (Bot Protection / Captchas) impuestos por DuckDuckGo y los sistemas de carga perezosa (lazy-loading) de Yahoo/Bing, **no se debe usar parseo del DOM** (\page.eval\) para extraer imágenes.

**Estrategia Obligatoria (Regex HD):**
1. Renderizar la página con Playwright y obtener el HTML puro (\page.content()\).
2. Aplicar Expresiones Regulares sobre el código fuente para extraer los URLs directos en alta resolución que suelen estar ocultos en JSONs o atributos de redirección.
   - Ejemplo de Regex: \/https?:\/\/[^\s"'<>]+?(?:\.jpg|\.jpeg|\.png|\.webp)/gi\`n3. Filtrar y decodificar (\decodeURIComponent\) las URLs, excluyendo dominios de thumbnails (ej. \yimg.com\, \	se\, \ing.net\).
4. Enviar los enlaces \hd_url\ limpios al cliente para garantizar descargas sin pérdida de resolución.
