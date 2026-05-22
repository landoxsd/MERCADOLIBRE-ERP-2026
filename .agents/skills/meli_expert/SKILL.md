---
name: meli_expert
description: Experto en la API de Mercado Libre Venezuela (MLV) con conocimientos actualizados de 2026.
---

# meli_expert

💡 Esta habilidad proporciona el conocimiento técnico necesario para interactuar con la API de Mercado Libre en el contexto de Venezuela (MLV).

## Usage

Use esta habilidad cuando necesite:
- Realizar búsquedas de productos en MLV.
- Consultar detalles de ítems (multiget).
- Analizar el rendimiento de una publicación (Performance API).
- Manejar la lógica de precios legal en USD (BCV).

## Steps

1. **Autenticación**: Use siempre `getValidAccessToken()` de `@/lib/meli-auth-helper`.
2. **Consulta**: Realice las peticiones a `https://api.mercadolibre.com/`.
3. **Validación**: Verifique que el `currency_id` sea `USD` (legal en MLV).
4. **Logística**: Analice el campo `shipping` y la descripción para detectar zonas de pickup.

## ⚠️ Restricciones Confirmadas de la API MLV (verificado Mayo 2026)

### Endpoint `/sites/MLV/search` — COMPLETAMENTE BLOQUEADO
- Devuelve **403 forbidden** siempre, con token o sin token, con cualquier IP.
- No hay workaround via parámetros (`format_external`, `app_version`, `category`, `access_token` en URL).
- **No usar este endpoint para MLV. Nunca.**

### Endpoints que SÍ funcionan con token válido
- `GET /users/me` ✅
- `GET /items/{id}` ✅
- `GET /items?ids=id1,id2,...` (multiget) ✅
- `GET /users/{user_id}/items/search` ✅
- `GET /trends/MLV` ✅
- `GET /categories/{id}` ✅

### Scraping Node.js `fetch` — NO FUNCIONA
- MercadoLibre detecta que no es un browser real (TLS fingerprint, sin JS).
- Devuelve 5KB micro-landing page vacía, aunque el PoW se resuelva correctamente.
- El bypass de `_bmstate` PoW no es suficiente.

## ✅ Solución Correcta: Playwright Hybrid Scraper

### Arquitectura (implementada en `src/lib/mlv-playwright-scraper.js`)

```
1. Playwright (Chromium headless) navega a listado.mercadolibre.com.ve/{query}
2. Espera a que carguen los polycards (networkidle + selector)
3. Descarga HTML completo via page.content() — NO screenshots
4. Parser HTML extrae IDs MLV (formato MLV\d{9,12}) y metadata polycard
5. Multiget /items?ids=... con token para enriquecer sold_quantity, fotos, atributos
6. Análisis, scoring y persistencia en Supabase
```

### Dependencias instaladas (Mayo 2026)
```json
"playwright-core": "^1.x",
"@sparticuz/chromium-min": "^x.x"
```
- Local: usa `@playwright/test` ya instalado + Chromium local (`npx playwright install chromium`)
- Vercel: usa `playwright-core` + `@sparticuz/chromium-min` (menos de 45MB, dentro del límite serverless)
- `vercel.json` requiere `"maxDuration": 60` para la función `/api/tools/sniper/analyze`

### Formato polycard en el HTML de MLV
El HTML de listado.mercadolibre.com.ve contiene JSON embebido con el siguiente formato:
```
"polycard": {
  "metadata": { "id": "MLV576105535", "url": "articulo.mercadolibre.com.ve/..." },
  "components": [
    { "id": "title",    "title":    { "text": "Amortiguador ..." } },
    { "id": "price",    "price":    { "current_price": { "value": 25.5, "currency": "USD" } } },
    { "id": "shipping", "shipping": { "text": "Envío gratis" } }
  ]
}
```
Extraer IDs via regex: `/MLV\d{9,12}/g` sobre el HTML completo.

## SEO & Publicación Masiva (V2.1 - 2026)

- **Límite de Título**: Estricto de 60 caracteres.
- **Normalización**: Eliminar conectores (DE, LA, EL, CON) y puntuación.
- **Abreviaturas**: Expandir abreviaturas críticas (AMORT., DEL., TRAS., etc.).
- **Title Case**: Formato "Título Capitalizado" para estética premium.
- **Logística Limpia**: Dejar en NULL las columnas de precio por zona para MercadoEnvíos.
- **Espejo Local-Vercel**: Mantener paridad total de lógica entre desktop y API Routes.
- **Imagen Fallback**: Siempre incluir URL de imagen de respaldo (Corporación RWC).

## Integridad de Datos y Errores Críticos

- **Regla del SKU Inmutable**: El SKU es la clave primaria. No normalizar ni recortar.
- **Paginación de Inventario**: Siempre usar bucles de paginación para Supabase (catálogo >18,000 ítems).
- **Parche de ExcelJS (B643)**: Limpieza radical de fórmulas (`cell.value = null; cell.value = val;`).
- **Detección Dinámica**: Buscar encabezados (`CODIGO`, `EXISTENCIA`) en las primeras 30 filas.
- **Fallback de Imágenes**: Proveer `FALLBACK_IMAGE_URL` oficial para publicaciones masivas.

## Mercado Envíos Venezuela (SPA External Portal - 2026)

- **Acceso Directo**: Información de contacto protegida. Usar scraping del portal `mercadoenvios.com.ve`.
- **Sesión Dual**: Inyectar cookies de ML + `access_token` específico en `.mercadoenvios.com.ve`.
- **Estrategia Anti-Bot**:
  - User-Agent: Chrome/Windows moderno.
  - WebDriver Hidden: Inyectar script para ocultar `navigator.webdriver`.
  - Angular Rendering: Esperar `<melienvios-root>` + delay de 3-5s.
- **Selectores de Oro**:
  - Teléfono: párrafos con texto "Teléfono:".
  - Receptor: párrafos con texto "Quien recibe:".
- **Sincronización de Pesos**: Extraer de `/vendedor/productos` para cálculo de fletes.
