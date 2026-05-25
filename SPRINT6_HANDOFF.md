# SPRINT 6 — HANDOFF PARA GEMINI
## MercadoLibre ERP Venezuela · Image Hunter + Listing Optimizer
### Plan preparado por: ANTIGRAVITY (Claude) · Para ejecutar: Gemini 2.5 Pro
### Fecha: 2026-05-24

---

## INSTRUCCION CRITICA PARA GEMINI

Lee ESTE documento completo antes de tocar cualquier archivo.
Lee tambien MASTER_BRAIN.md para contexto completo del proyecto.
NO reinventes lo que ya existe. Reutiliza los patrones documentados.

---

## CONTEXTO DEL PROYECTO

Stack: Next.js 14 App Router + Supabase + Vercel
Negocio: Autopartes Venezuela · 18,000-40,000 SKUs
ERP local: Profit Plus (SQL Server) · Publicacion masiva: Integraly (CSV por SKU)
URL prod: https://mercadolibre-erp.vercel.app
Diseno: Glassmorphism oscuro. Referencia visual: ver /dashboard/spy/page.js

REGLAS DE ORO (NO violar nunca):
1. SIEMPRE usar meliGet() de src/lib/meli.js. Tiene retry + backoff 429. NO crear fetches propios.
2. SIEMPRE usar getValidAccessToken() de src/lib/meli-auth-helper.js para tokens.
3. El exportador Integraly usa SheetJS client-side en handleDownloadIntegraly() de /dashboard/inventory/page.js.
4. Playwright: maxDuration=60, cerrar browser en finally{}, User-Agent real + --disable-blink-features=AutomationControlled.
5. /dashboard/intelligence ya existe (Listing Sniper V3). El Optimizer es EXTENSION, NO reescritura.

NOMENCLATURA IMAGENES PROFIT (CRITICO):
  SKU-0.jpg, SKU-1.jpg, SKU-2.jpg, SKU-3.jpg
  Carpeta: /public/hunter-sandbox/
  Spec: 1500x1500px, fondo blanco RGB(255,255,255), JPEG 95%, sharpen sigma:1.5 m1:2.0 m2:1.0

---

## ORDEN DE IMPLEMENTACION

1. MODULO 1 primero (Image Hunter) - No requiere OPENAI_API_KEY. Backend 60% listo.
2. MODULO 2 despues (Listing Optimizer) - Requiere OPENAI_API_KEY en .env

---

## MODULO 1: IMAGE HUNTER

### TAREA 1.1 — FIX /src/app/api/images/hunt/route.js

PROBLEMA: Extrae thumbnails comprimidos, no URLs originales HD.
La URL HD esta en el atributo data-id del contenedor [data-id] en DuckDuckGo.
Ese atributo contiene JSON: { "image": "URL_HD", "thumbnail": "...", "width": N, "height": N }

CAMBIOS REQUERIDOS:
- Cambiar query: agregar "autopart catalog white background" al final del SKU
- Extraer data-id del tile padre: tile.getAttribute('data-id') -> JSON.parse(decodeURIComponent(...))
- Retornar: { hd_url, thumbnail, width, height, domain, is_hd: width>=800 }
- Agregar finalmente{} con browser.close() siempre
- Aumentar resultados a 12

### TAREA 1.2 — FIX /src/app/api/images/export-zip/route.js

PROBLEMA: Variable "passThrough" (TransformStream) declarada pero nunca usada en linea 24.
CAMBIO: Eliminar esa linea. Solo mantener { readable, writable } = new TransformStream()
AGREGAR: Soporte para ?clear=true que borra los .jpg de /public/hunter-sandbox/ despues de zip.finalize()

### TAREA 1.3 — CREAR /src/app/api/images/sandbox/route.js (NUEVO)

GET  -> Lista *.jpg en /public/hunter-sandbox/ con { filename, url, sku, index, size_bytes }
       Parsear sku e index del nombre: "KE5009-2.jpg" -> sku="KE5009", index=2
DELETE ?file=SKU-0.jpg -> Elimina ese archivo (sanitizar nombre con path.basename)
DELETE ?clear=all -> Elimina todos los .jpg de la carpeta

### TAREA 1.4 — CREAR /src/app/dashboard/images/hunter/page.js (NUEVO — UI PRINCIPAL)

Layout: 3 zonas verticales. Glassmorphism oscuro (mismo estilo que /dashboard/spy).

ZONA 1: Panel de Busqueda Batch
- textarea: SKUs uno por linea
- boton [Buscar Todos]: itera SKUs con for...of asincrono (uno a la vez, no en paralelo)
- progress bar animada: "3/20 SKUs · AS332"
- boton [Detener] que usa un ref para abortar el loop

ZONA 2: Resultados por SKU
- tabs horizontales: un boton por SKU con cantidad de resultados
- grid 4-6 columnas de cards de imagen:
  * imagen preview (thumbnail)
  * badge: verde "HD 1200x1200" o amarillo "Baja 300x300"
  * dominio fuente (amazon.com, ebay.com, etc)
  * boton [+ Agregar a Bandeja]
- Click en "+ Agregar": llama POST /api/images/process con { imageUrl: hd_url, sku, index: getNextIndex(sku) }
  getNextIndex(sku) busca en sandbox[] cuantas imagenes de ese SKU ya existen y devuelve el siguiente indice

ZONA 3: Bandeja de Aprobacion (abajo, siempre visible)
- Carga al montar con useEffect -> GET /api/images/sandbox
- Grid de cards: imagen procesada, nombre "KE5009-0.jpg", boton [X Eliminar]
- Header con contador y boton principal [Descargar ZIP -> PROFIT]
- Descargar: fetch GET /api/images/export-zip?clear=true -> blob -> download link
- Despues de descargar: recargar bandeja (quedara vacia)

ESTADO React necesario:
  skuInput, isSearching, progress{current,total,currentSku}, results[], activeSkuIndex, sandbox[], processing, downloading

### TAREA 1.5 — MODIFICAR /src/components/Sidebar.js

Agregar al array NAV_ITEMS (despues de Big Data Export en linea 22):
  { href: '/dashboard/images/hunter', label: 'Image Hunter', icon: 'U+1F4F8' },
  { href: '/dashboard/optimizer', label: 'Listing Optimizer', icon: 'U+26A1' },

---

## MODULO 2: LISTING OPTIMIZER

PREREQUISITO: Agregar al .env raiz:
  OPENAI_API_KEY=sk-...
Sin esa clave, el endpoint devuelve un analisis basico de precios (sin IA) con demo_mode:true

### TAREA 2.1 — CREAR /src/app/api/tools/optimizer/analyze/route.js

POST { item_id: "MLV123456789" }

Flujo:
1. Leer cuenta activa de cookie meli_erp_account -> accountsTable()
2. getValidAccessToken(account) -> token
3. meliGet(/items/, token) -> myItem
4. meliGet(/items//description, token) -> descripcion (substring 500 chars)
5. cleanTitle = titulo sin años (20XX) y palabras genericas (ORIGINAL, NUEVO, OEM)
6. meliGet(/sites/MLV/search?q=&limit=20) -> resultados
7. Filtrar: excluir seller.id === myItem.seller_id. Tomar primeros 5.
8. Para cada competidor: meliGet(/items/) -> attributes (primeros 10), pictures.length
9. Construir prompt y llamar OpenAI gpt-4o-mini con response_format: json_object
10. Retornar: { success, myItem, competitors[5], dictamen }

Si no hay OPENAI_API_KEY: calcular precio promedio de competidores y devolver analisis basico.

dictamen JSON shape:
{
  score: 0-100,
  resumen_ejecutivo: "...",
  precio: { posicion: "por encima/en linea/por debajo del mercado", delta_promedio_pct: N, recomendacion: "..." },
  titulo: { palabras_clave_faltantes: [], titulo_sugerido: "..." },
  descripcion: { gaps_detectados: [], descripcion_sugerida: "..." },
  imagenes: { cantidad_nuestra: N, promedio_competencia: N, recomendacion: "..." },
  atributos_faltantes: [],
  prioridades: ["Accion 1 urgente", "Accion 2", "Accion 3"]
}

### TAREA 2.2 — CREAR /src/app/api/tools/optimizer/export/route.js

POST { items: [{ sku, item_id, nuevo_titulo, nueva_descripcion, nuevo_precio, score_antes }] }

Generar CSV BOM UTF-8 (prefijo \uFEFF para Excel):
Columnas: SKU, ITEM_ID, TITULO_NUEVO, DESCRIPCION_NUEVA, PRECIO_NUEVO, SCORE_ANTES, FECHA_GENERACION
Escapar valores con comillas dobles si contienen comas o saltos de linea.
Content-Type: text/csv; charset=utf-8
Filename: INTEGRALY_OPTIMIZER_2026-05-24.csv

### TAREA 2.3 — CREAR /src/app/dashboard/optimizer/page.js

Layout: 3 paneles horizontales side by side (flexbox o CSS grid 3 columnas).
Diseno: glassmorphism oscuro, consistente con /dashboard/spy y /dashboard/intelligence.

PANEL IZQUIERDO (ancho fijo ~280px):
- Input de busqueda de texto
- Lista de mis publicaciones: fetch GET /api/account/publications/search o consultar Supabase meli_items
  Mostrar: thumbnail pequeño, titulo truncado, precio
- Click en una pub -> se resalta y activa boton [ANALIZAR]
- Spinner durante analisis con texto "Analizando competencia..."
- Seccion "Aceptados:" muestra los items con cambios aceptados listos para exportar
- Boton [Exportar Integraly] al fondo del panel -> descarga CSV

PANEL CENTRAL (flex 1 - mayor espacio):
- Si no hay analisis: pantalla de bienvenida con instrucciones
- Si hay dictamen:
  * Header: titulo de la pub analizada + Score grande (N/100) con barra de progreso circular o lineal
  * Badge de color: rojo <40, amarillo 40-70, verde >70
  * Resumen ejecutivo en italic
  * Secciones colapsables (expandidas por defecto):
    - PRECIO: posicion, delta %, recomendacion, campo para nuevo precio (input number)
    - TITULO: palabras faltantes en badges, campo editable con titulo sugerido (input text)
    - DESCRIPCION: gaps en lista, textarea editable con descripcion sugerida
    - IMAGENES: cantidad nuestra vs promedio, recomendacion
    - ATRIBUTOS FALTANTES: lista de badges
    - PRIORIDADES: lista numerada 1, 2, 3
  * Cada seccion (precio, titulo, descripcion) tiene botones [Aceptar] [Ignorar]
  * [Aceptar] agrega los cambios al estado local cambiosAceptados[]
  * Boton [Aceptar Todo y Pasar al Siguiente]

PANEL DERECHO (ancho fijo ~260px):
- Titulo "Top 5 Competidores"
- Cards para cada competidor:
  * Thumbnail de la publicacion (img.thumbnail)
  * Titulo truncado a 2 lineas
  * Precio destacado
  * Badge envio gratis o no
  * Cantidad de fotos
  * Nombre del vendedor

---

## VERIFICACION

Imagen Hunter:
- Pegar 3 SKUs -> resultados con imagenes reales (no thumbnails rotos ni placeholders)
- Click [+ Agregar] -> imagen aparece en Zona 3 con nombre correcto (SKU-0.jpg)
- Verificar que /public/hunter-sandbox/SKU-0.jpg es exactamente 1500x1500px
- [Descargar ZIP] -> .zip contiene archivos SKU-0.jpg correctos
- Bandeja queda vacia despues de descargar
- Links nuevos en Sidebar funcionan

Listing Optimizer (con OPENAI_API_KEY):
- Buscar pub -> ANALIZAR -> dictamen con score realista
- 5 competidores visibles en panel derecho
- Aceptar titulo y precio -> aparecen en "Aceptados"
- Exportar -> CSV descargado con columnas SKU, TITULO_NUEVO, etc
- CSV abre sin errores en Excel

---
Handoff preparado por ANTIGRAVITY · 2026-05-24


## CHECKPOINT ALCANZADO (25 MAYO 2026)
- **Módulo 1 (Image Hunter) COMPLETADO**: Se resolvieron los problemas de captchas de buscadores migrando a Regex sobre Yahoo Images y se agregaron previsualizaciones clickeables en alta resolución.
- **Módulo 2 (Listing Optimizer)**: Listo para iniciar su implementación en la próxima sesión.
