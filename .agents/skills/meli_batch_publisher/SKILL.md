---
name: meli_batch_publisher
description: Motor de publicación masiva directa por API oficial de Mercado Libre con soporte para Tienda Oficial, escaneo y subida de fotos locales, y enriquecimiento con Gemini 3.6 Flash IA.
---

# meli_batch_publisher

💡 Esta habilidad proporciona el conocimiento técnico y los procedimientos para ejecutar publicaciones masivas por lotes directamente contra la API oficial de Mercado Libre sin depender de plantillas Excel intermedias.

## Usage

Use esta habilidad cuando necesite:
- Publicar lotes de productos directamente desde el inventario de Profit Plus a Mercado Libre.
- Escanear carpetas de imágenes locales (`SKU.jpg`, `SKU-1.jpg`, etc.) y subirlas a `POST /pictures/items/upload`.
- Inyectar el `official_store_id` y atributos obligatorios de la categoría.
- Enriquecer títulos SEO y descripciones con el pool Multi-Key de Google Gemini 3.6 Flash.
- Transmitir el progreso en tiempo real mediante Server-Sent Events (SSE).

## Arquitectura del Flujo

```
  [Excel Profit / Faltantes]
             │
             ▼
  [Escáner de Fotos Locales en Disco] ➔ POST /pictures/items/upload
             │
             ▼
  [Mapeo de Categorías] ➔ 'category_mappings' / domain_discovery
             │
             ▼
  [Atributos Requeridos] ➔ GET /categories/{id}/attributes
             │
             ▼
  [Enriquecimiento con Gemini AI] ➔ Descripciones y Compatibilidad
             │
             ▼
  [Creación de Publicación] ➔ POST /items + POST /items/{id}/description
             │
             ▼
  [Persistencia en Supabase] ➔ Tabla 'products' (photo_status: real | placeholder)
```

## Componentes Clave

1. **Backend API (`src/app/api/account/publications/publish-batch/route.js`):**
   - Procesa items en cola controlada con pausas de 400ms para evitar rate-limits de ML.
   - Conexión SSE (`text/event-stream`) para transmitir eventos en vivo.
2. **Pool de IA Gemini (`src/lib/gemini.js`):**
   - Round-Robin entre 4 API Keys (`GEMINI_API_KEY`, `_2`, `_3`, `_4`), alcanzando 60 peticiones/minuto gratuitas.
   - Infiere compatibilidad vehicular (años, modelos, motores) y formatea texto plano para ML.
3. **Modal UI (`src/components/inventory/MassPublisherModal.js`):**
   - Interfaz en `/dashboard/inventory` con selector de carpeta local, barra de progreso y monitor en tiempo real.
4. **Desktop CLI (`ML_Desktop_Publisher/publicar_api_directo.js`):**
   - Script standalone con ejecutable `.bat` para publicar desde terminal en segundo plano.
