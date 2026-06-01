---
name: promo_manager
description: >
  Skill para gestionar descuentos y promociones en Mercado Libre Venezuela (MLV) mediante la API oficial.
  Cubre el ciclo completo: consultar campañas disponibles, aplicar descuentos por lote/línea/total,
  crear campañas propias (SELLER_CAMPAIGN), analizar precios vs competencia y sugerir descuentos ganadores.
---

# promo_manager

💡 Esta habilidad gestiona el ciclo completo de promociones en Mercado Libre MLV usando el recurso
`/seller-promotions` de la API oficial v2, combinado con inteligencia competitiva vía Playwright scraper.

---

## ⚠️ Restricciones Críticas de la API (Verificadas Jun 2026)

- **Descuento mínimo**: 5% sobre el precio original. Menos = error `buyer_discount_not_in_range`.
- **Descuento máximo**: 80% sobre el precio original. Más = error `The percentage is greater than allowed`.
- **Duración máxima SELLER_CAMPAIGN**: 14 días entre `start_date` y `finish_date`.
- **Requisito del ítem**: estado `active`, condición `new`, exposición no gratuita (Clásica o Premium).
- **Requisito del vendedor**: reputación verde (nivel 4 o 5).
- **Fechas**: deben estar en formato **local** (`YYYY-MM-DDTHH:MM:SS`), NO en UTC. ML toma las 00:00:00 como inicio y 23:59:59 como fin.
- **Paginación**: usar `search_after` (string opaco), no `offset`. TTL del cursor: 5 minutos.
- **Rate limiting**: máximo ~10 req/seg. Usar backoff exponencial en caso de 429.
- **403 en /items/{id}**: Los ítems de una cuenta solo son accesibles con el token de la cuenta propietaria. Siempre probar todas las cuentas de `meli_accounts` en Supabase.

---

## Tipos de Campaña y Sus Características

| Tipo | Quién define precio | Co-fondeada ML | Exposición extra | Plazo máximo |
|------|---------------------|---------------|-----------------|--------------|
| `DEAL` | Vendedor (dentro de rango) | No | Alta (catálogo ML) | Según campaña |
| `MARKETPLACE_CAMPAIGN` | ML sugiere, vendedor acepta | Sí | Alta | Según campaña |
| `PRICE_DISCOUNT` | Vendedor libre | No | Normal | 14 días |
| `SELLER_CAMPAIGN` | Vendedor libre | No | Normal | 14 días |
| `LIGHTNING` | Vendedor (rango estricto) | No | Muy alta (temporizada) | Horas |
| `DOD` | Vendedor (con sugerencia) | No | Muy alta (24h) | 24h |

> **Recomendación de negocio**: Priorizar siempre participar en campañas `DEAL` y `MARKETPLACE_CAMPAIGN`
> de Mercado Libre. Tienen mayor exposición orgánica que `SELLER_CAMPAIGN`. Las campañas propias son
> útiles para lanzar descuentos puntuales sin esperar invitación de ML.

---

## Flujo Completo de Gestión de Promociones

### Paso 1: Obtener token válido
```js
// Siempre usar getValidTokenForAccount(accountId, supabase) de meli-auth-helper.js
// Para MLV (CORPORACIONRWCCA): accountId = '1eb437bf-33a8-42f3-9c66-93a638ab36b5'
const token = await getValidTokenForAccount(accountId, supabase);
```

### Paso 2: Consultar campañas disponibles del vendedor
```bash
GET /seller-promotions/users/{USER_ID}?app_version=v2
Authorization: Bearer {ACCESS_TOKEN}
```
Retorna: lista de campañas con `id`, `type`, `status`, `start_date`, `finish_date`, `name`.

### Paso 3: Consultar estado de promociones de un ítem
```bash
GET /seller-promotions/items/{ITEM_ID}?app_version=v2
Authorization: Bearer {ACCESS_TOKEN}
```
Retorna array con todas las promociones del ítem. Campos clave:
- `status: "started"` → Activa ahora
- `status: "candidate"` → Puedes sumarte
- `status: "pending"` → Programada
- `min_discounted_price` / `max_discounted_price` → Rango permitido por ML
- `suggested_discounted_price` → Precio sugerido por el algoritmo

### Paso 4: Sumar un ítem a una campaña
```bash
POST /seller-promotions/items/{ITEM_ID}?app_version=v2
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "promotion_id": "P-MLV17357018",
  "promotion_type": "DEAL",
  "deal_price": 72.29
}
```

### Paso 5: Crear una Campaña del Vendedor propia
```bash
POST /seller-promotions/promotions?app_version=v2
Authorization: Bearer {ACCESS_TOKEN}

{
  "promotion_type": "SELLER_CAMPAIGN",
  "name": "Descuentos Junio 2026",
  "sub_type": "FLEXIBLE_PERCENTAGE",
  "start_date": "2026-06-01T00:00:00",
  "finish_date": "2026-06-14T00:00:00"
}
```

### Paso 6: Sumar ítem a Campaña del Vendedor
```bash
POST /seller-promotions/items/{ITEM_ID}?app_version=v2

{
  "promotion_id": "C-MLV360923",
  "promotion_type": "SELLER_CAMPAIGN",
  "deal_price": 72.29
}
```

---

## Motor de Análisis Competitivo

### Fuente de datos de competidores
El endpoint `/sites/MLV/search` está **bloqueado (403 siempre)** en MLV.
Única fuente viable: **Playwright scraper** (`src/lib/mlv-playwright-scraper.js`).

### Algoritmo de sugerencia de precio ganador
```
1. Obtener precio_propio del ítem
2. Scraper obtiene Top 5 competidores del mismo título/categoría
3. Calcular precio_campeon = MIN(precios_competidores)
4. Calcular gap = precio_propio - precio_campeon
5. Si gap > 0 (estamos más caros):
   - precio_sugerido = precio_campeon * 0.97  (3% por debajo del campeón)
   - descuento_pct = ((precio_propio - precio_sugerido) / precio_propio) * 100
   - Verificar: descuento_pct >= 5% y <= 80%
   - Si descuento_pct < 5%: precio_sugerido = precio_propio * 0.95
6. Si gap <= 0 (somos los más baratos):
   - Recomendación: "Ya eres el más competitivo. Considera un 5% para liquidar stock."
```

### Filtros de Priorización (cuándo aplicar descuentos primero)
```
- mayor_ticket: ordenar por precio DESC → impacto de revenue mayor
- mas_vendido: ordenar por sold_quantity DESC → mantener momentum
- menos_vendido: ordenar por sold_quantity ASC → impulsar items dormidos
- por_linea: filtrar por category_id de ML
- por_marca: filtrar por atributo BRAND del ítem
- por_ids: lista explícita de IDs
```

---

## Errores Conocidos y Manejo

| Código | Error | Causa | Solución |
|--------|-------|-------|----------|
| `400` | `buyer_discount_not_in_range` | Descuento < 5% o > 80% | Ajustar `deal_price` |
| `400` | `error_credibility_price` | Precio no creíble para ML | Bajar más el precio |
| `400` | `Invalid sub_type` | sub_type incorrecto | Usar `FLEXIBLE_PERCENTAGE` |
| `400` | `Maximum period cannot exceed the allowed` | Campaña > 14 días | Acortar fechas |
| `403` | Sin acceso al ítem (`Caller don't have permissions`) | Token de otra cuenta. Frecuente por corrupción en BD: un sync masivo en Supabase sobrescribe el `meli_account_id` incorrecto debido a un upsert (onConflict: `meli_item_id`). | Revisar en BD a qué cuenta pertenece y si el token usado coincide con el dueño real. |
| `423` | `ENTITY_LOCKED` | Ítem temporalmente bloqueado | Reintentar en 5 segundos |
| `429` | Rate limit | Demasiadas requests | Backoff exponencial: 1s, 2s, 4s |
| Frontend | "Sin promociones" falso positivo | Retorno de API doblemente envuelto: `promos: { promos: [...] }` | Asegurar de que la capa de red retorne el Array limpio para que el UI pueda iterarlo con `Array.isArray()`. |

---

## Estructura de Datos — Resumen de Promoción de Ítem
```json
{
  "id": "P-MLV17479004",
  "type": "DEAL",
  "status": "started",
  "price": 72.29,
  "original_price": 88.16,
  "min_discounted_price": 17.63,
  "max_discounted_price": 83.75,
  "suggested_discounted_price": 79.34,
  "start_date": "2026-05-01T00:00:00-04:00",
  "finish_date": "2026-06-01T00:00:00-04:00",
  "name": "Reto autopartista 2026"
}
```
