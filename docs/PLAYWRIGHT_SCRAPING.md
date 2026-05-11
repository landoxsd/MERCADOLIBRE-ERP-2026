# Playwright Scraping Module — ML ERP V4

## Arquitectura

```
src/utils/scraping/
  ml-scraper.js           ← Motor principal de Playwright

src/app/api/scraping/
  get-phone/route.js      ← POST: Extraer teléfono de una orden
  validate-session/route.js ← POST: Verificar si la cookie sigue activa

tests/
  ml-scraper.spec.ts      ← Suite de tests (6 tests)
  screenshots/            ← Screenshots generados automáticamente (en .gitignore)
```

## Setup Requerido

### 1. Instalar Playwright Browsers
```bash
npx playwright install chromium
```

### 2. Agregar a `.env.local` para tests
```env
# Cookie de sesión para tests de scraping (NO subir a Git)
MELI_TEST_SESSION_COOKIE=MELI_SESSION=xxxx; c_id=yyyy; ...
MELI_TEST_ORDER_ID=2000012345678
```

### 3. Agregar cookie de sesión a Supabase (por cuenta)
En la tabla `meli_accounts`, hay dos columnas reservadas para esto:
- `session_cookie` — El string de cookies copiado del navegador
- `cookie_expiry` — Fecha de vencimiento estimada

## ¿Cómo obtener la cookie de sesión de ML?

1. Abre Chrome y entra a `www.mercadolibre.com.ve` con tu cuenta
2. Presiona `F12` (Herramientas de Desarrollador)
3. Ve a la pestaña **Application** → **Cookies** → `www.mercadolibre.com.ve`
4. Copia las cookies más importantes: `MELI_SESSION`, `c_id`, `jti_v1`
5. Péstalas en el campo `session_cookie` de tu cuenta en Supabase Dashboard

> ⚠️ Las cookies de ML tienen una duración de ~30 días. Habrá que renovarlas periódicamente.

## Correr los Tests

### Tests públicos (sin sesión — siempre funcionan):
```bash
npx playwright test tests/ml-scraper.spec.ts --grep "público|Búsqueda|Publicación|Sniper" --headed
```

### Todos los tests (con sesión configurada):
```bash
npx playwright test tests/ml-scraper.spec.ts --headed
```

### Debug visual paso a paso:
```bash
npx playwright test tests/ml-scraper.spec.ts --debug
```

### Ver reporte HTML de resultados:
```bash
npx playwright show-report
```

## Uso desde la API (Desde tu Dashboard)

```javascript
// Extraer teléfono de una orden
const response = await fetch('/api/scraping/get-phone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'tu-account-id-de-supabase',
    orderId: '2000012345678'
  })
});
const data = await response.json();
// data.phone = "+58412XXXXXXX"
// data.buyerName = "Juan Pérez"
```

## Limitaciones Conocidas

| Limitación | Impacto | Solución |
|---|---|---|
| Cookies expiran en ~30 días | El scraper deja de funcionar | Renovar manualmente o automatizar con script de captura |
| ML puede detectar el bot | El scraper falla silenciosamente | Rotación de User-Agent (ya implementado) |
| Playwright no funciona en Vercel Edge | El endpoint NO puede correr en Vercel Free | Usar en local (`npm run dev`) o Vercel Pro con maxDuration=60 |
| El teléfono puede no estar visible | Si el comprador no lo verificó | Se devuelve `null` sin errores |

## Próximas Features (Roadmap)

- [ ] **Scraping masivo**: Procesar todas las órdenes de la última semana en batch
- [ ] **Integración WhatsApp Web**: Playwright para enviar mensajes post-venta automáticamente
- [ ] **Monitor de precios**: Correr el test de competidores cada 24h y guardar en `mlv_market_snapshots`
- [ ] **Captura automática de cookies**: Script que renueva la sesión automáticamente usando las credenciales de ML
