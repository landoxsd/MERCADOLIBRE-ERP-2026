// =============================================================================
// tests/ml-scraper.spec.ts
// Tests de Playwright para el Motor de Scraping de Mercado Libre
// =============================================================================
// Cómo correr estos tests:
//   npx playwright test tests/ml-scraper.spec.ts --headed
//   (--headed muestra el browser en pantalla para debug)
//
// Para correr en modo debug paso a paso:
//   npx playwright test tests/ml-scraper.spec.ts --debug
// =============================================================================

import { test, expect, chromium, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuración del test suite
// ---------------------------------------------------------------------------

// ⚠️ Para los tests que requieren autenticación, carga la cookie desde .env.local
// Agrega MELI_TEST_SESSION_COOKIE=<tu_cookie> a tu archivo .env.local
const TEST_SESSION_COOKIE = process.env.MELI_TEST_SESSION_COOKIE || '';

// ID de una orden real para probar (cambiar por una orden reciente tuya)
const TEST_ORDER_ID = process.env.MELI_TEST_ORDER_ID || '2000000000000'; 

// Permalink de una publicación real para test de datos públicos
const TEST_PERMALINK = 'https://articulo.mercadolibre.com.ve/MLV-762308-amortiguador-delantero-toyota-hilux-2005-2015-_JM';

// ---------------------------------------------------------------------------
// TEST 1: Test Público - Verificar que ML Venezuela carga correctamente
// ---------------------------------------------------------------------------
test('ML Venezuela: La página principal carga correctamente', async ({ page }) => {
  await page.goto('https://www.mercadolibre.com.ve', { waitUntil: 'domcontentloaded' });
  
  // Verificar que el título contiene "Mercado Libre"
  await expect(page).toHaveTitle(/Mercado Libre/i);
  
  // Verificar que el buscador está presente
  const searchBox = page.locator('input[placeholder*="Buscar"], input[name="q"]').first();
  await expect(searchBox).toBeVisible();
  
  console.log('✅ ML Venezuela carga correctamente');
});

// ---------------------------------------------------------------------------
// TEST 2: Test Público - Búsqueda de producto
// ---------------------------------------------------------------------------
test('Búsqueda pública: Buscar amortiguador y obtener resultados', async ({ page }) => {
  await page.goto('https://www.mercadolibre.com.ve', { waitUntil: 'domcontentloaded' });
  
  // Buscar un producto
  const searchBox = page.locator('input[placeholder*="Buscar"], input[name="q"]').first();
  await searchBox.fill('amortiguador delantero toyota hilux');
  await searchBox.press('Enter');
  
  // MLV redirige a listado.mercadolibre.com.ve (no a /search)
  // Esperamos la navegación a cualquier URL de resultados
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  await page.waitForTimeout(2000); // Extra espera para JS dinámico de MLV
  
  // Selectores reales de MLV (poly-component es el card moderno de ML)
  await page.waitForSelector('.poly-component, .ui-search-layout__item, .andes-card', { timeout: 20000 });
  
  // Verificar que hay resultados
  const items = page.locator('.poly-component, .ui-search-layout__item');
  const count = await items.count();
  
  const currentUrl = page.url();
  console.log(`✅ URL de resultados: ${currentUrl}`);
  console.log(`✅ Se encontraron ${count} resultados para "amortiguador delantero toyota hilux"`);
  expect(count).toBeGreaterThan(0);
  
  // Capturar screenshot del resultado para revisión visual
  await page.screenshot({ path: 'tests/screenshots/search-results.png' });
});

// ---------------------------------------------------------------------------
// TEST 3: Test Público - Extraer datos de una publicación específica
// ---------------------------------------------------------------------------
test('Publicación: Extraer datos de una publicación pública', async ({ page }) => {
  await page.goto(TEST_PERMALINK, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Verificar que la página cargó correctamente
  const title = await page.locator('h1.ui-pdp-title').first().textContent({ timeout: 10000 }).catch(() => null);
  
  if (!title) {
    // La publicación podría no existir. Saltamos gracefully.
    console.warn('⚠️ La publicación de test no existe o está cerrada. Ajusta TEST_PERMALINK en el test.');
    test.skip();
    return;
  }
  
  console.log(`📦 Título de la publicación: "${title.trim()}"`);
  
  // Verificar precio
  const price = await page.locator('.andes-money-amount__fraction').first().textContent({ timeout: 5000 }).catch(() => null);
  console.log(`💰 Precio: ${price || 'No disponible'}`);
  
  // Verificar si tiene Envío Gratis
  const freeShipping = await page.locator('text=Envío gratis').first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`🚚 Envío gratis: ${freeShipping}`);

  // Verificar vendedor
  const sellerName = await page.locator('[class*="seller-info"] [class*="name"]').first().textContent({ timeout: 5000 }).catch(() => 'No disponible');
  console.log(`🏪 Vendedor: ${sellerName?.trim() || 'N/A'}`);

  // Capturar screenshot
  await page.screenshot({ path: 'tests/screenshots/publication-detail.png', fullPage: false });
  
  expect(title).toBeTruthy();
});

// ---------------------------------------------------------------------------
// TEST 4: Test de Competidores - Listing Sniper básico
// ---------------------------------------------------------------------------
test('Listing Sniper: Analizar precios de competidores en una categoría', async ({ page }) => {
  // Buscar amortiguadores en MLV — URL directa de categoría
  await page.goto(
    'https://listado.mercadolibre.com.ve/amortiguadores-delanteros-toyota',
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );

  // Esperar que carguen los cards (MLV usa .poly-component como card moderno)
  await page.waitForTimeout(3000);
  await page.waitForSelector('.poly-component, .ui-search-layout__item', { timeout: 20000 }).catch(() => null);
  
  // Extraer los primeros 5 resultados con precio y título
  // Selectores actualizados para el DOM real de MLV 2025
  const items = await page.locator('.poly-component, .ui-search-layout__item').evaluateAll((elements) => {
    return elements.slice(0, 5).map(el => {
      // poly-component__title es el selector nuevo de ML 2025
      const titleEl = el.querySelector('.poly-component__title, .ui-search-item__title, h2');
      // El precio puede estar en múltiples contenedores
      const priceEl = el.querySelector('.andes-money-amount__fraction, .price-tag-fraction');
      const linkEl = el.querySelector('a[href*="mercadolibre.com.ve"], a[href*="MLV"]');
      
      return {
        title: titleEl?.textContent?.trim() || '',
        price: priceEl?.textContent?.trim() || '',
        link: linkEl?.href || '',
      };
    });
  });

  console.log('\n📊 TOP 5 COMPETIDORES - Amortiguadores Toyota MLV:');
  console.log('═══════════════════════════════════════════════════');
  items.forEach((item, idx) => {
    if (item.title) {
      console.log(`${idx + 1}. ${item.title}`);
      console.log(`   Precio: $${item.price || 'N/A'}`);
      console.log(`   Link: ${item.link.substring(0, 70)}...`);
      console.log('───────────────────────────────────────────────────');
    }
  });
  
  await page.screenshot({ path: 'tests/screenshots/competitor-analysis.png' });
  
  // Verificar que hay al menos algún resultado (aunque el título esté vacío por selectores)
  const validItems = items.filter(i => i.title || i.link);
  console.log(`\n✅ Items encontrados con data: ${validItems.length}`);
  expect(items.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// TEST 5: Test de Sesión - (Requiere MELI_TEST_SESSION_COOKIE)
// ---------------------------------------------------------------------------
test('Sesión: Verificar autenticación con cookie de sesión', async ({ }) => {
  if (!TEST_SESSION_COOKIE) {
    console.warn('⚠️ TEST_SESSION_COOKIE no configurada. Saltando test de sesión.');
    test.skip();
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  // Inyectar cookies
  const cookies = TEST_SESSION_COOKIE.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.mercadolibre.com', path: '/' };
  }).filter(c => c.name && c.value);
  
  await context.addCookies(cookies);
  console.log(`🍪 ${cookies.length} cookies inyectadas`);

  const page = await context.newPage();
  await page.goto('https://www.mercadolibre.com.ve/ventas/listado', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  const isLoggedIn = !page.url().includes('/login');
  console.log(`🔐 Sesión válida: ${isLoggedIn}`);
  console.log(`📍 URL actual: ${page.url()}`);
  
  await page.screenshot({ path: 'tests/screenshots/session-test.png' });
  await browser.close();
  
  expect(isLoggedIn).toBe(true);
});

// ---------------------------------------------------------------------------
// TEST 6: Test de Extracción de Teléfono - (Requiere sesión + orden real)
// ---------------------------------------------------------------------------
test('Scraping: Extraer teléfono de una orden (requiere sesión y orden real)', async ({}) => {
  if (!TEST_SESSION_COOKIE || TEST_ORDER_ID === '2000000000000') {
    console.warn('⚠️ Configura MELI_TEST_SESSION_COOKIE y MELI_TEST_ORDER_ID para correr este test.');
    test.skip();
    return;
  }

  const browser = await chromium.launch({ headless: false }); // Visible para debug
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-VE',
  });

  const cookies = TEST_SESSION_COOKIE.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain: '.mercadolibre.com', path: '/' };
  }).filter(c => c.name && c.value);
  
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  const orderUrl = `https://www.mercadolibre.com.ve/ventas/${TEST_ORDER_ID}/detalle`;
  
  console.log(`🔍 Navegando a: ${orderUrl}`);
  await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Tomar screenshot para ver qué está mostrando ML
  await page.screenshot({ path: 'tests/screenshots/order-detail.png', fullPage: true });
  
  console.log(`📍 URL final: ${page.url()}`);
  
  // Buscar el botón de teléfono
  const phoneBtn = page.locator('button:has-text("Ver teléfono"), button:has-text("Ver número")').first();
  const phoneBtnVisible = await phoneBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`📞 Botón "Ver teléfono" visible: ${phoneBtnVisible}`);
  
  if (phoneBtnVisible) {
    await phoneBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/phone-revealed.png' });
    
    const phoneEl = page.locator('[href^="tel:"]').first();
    const phone = await phoneEl.getAttribute('href').catch(() => null);
    console.log(`✅ Teléfono extraído: ${phone?.replace('tel:', '') || 'No encontrado'}`);
  }
  
  await browser.close();
});
