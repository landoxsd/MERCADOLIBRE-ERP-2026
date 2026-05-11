// =============================================================================
// src/utils/scraping/ml-scraper.js
// Motor de Scraping de Mercado Libre con Playwright
// =============================================================================
// Responsabilidades:
//   1. Inicializar un browser Playwright con cookies de sesión inyectadas
//   2. Navegar a una orden de ML y extraer el teléfono del comprador
//   3. Extraer datos extendidos de una publicación (datos no disponibles en API)
//   4. Retornar los datos limpios para ser guardados en Supabase
//
// ⚠️ SOLO USAR EN SERVIDOR (scripts locales, API routes con Node.js runtime)
//    NO funciona en Edge Runtime de Vercel.
// =============================================================================

import { chromium } from '@playwright/test';

// ---------------------------------------------------------------------------
// CONSTANTES
// ---------------------------------------------------------------------------
const ML_BASE_URL = 'https://www.mercadolibre.com.ve';
const ML_VENTAS_URL = 'https://www.mercadolibre.com.ve/ventas/listado';
const SCRAPER_TIMEOUT = 30000; // 30 segundos máximo por operación

// ---------------------------------------------------------------------------
// HELPER: Parsear cookie string a array de objetos para Playwright
// ---------------------------------------------------------------------------
function parseCookieString(cookieStr) {
  if (!cookieStr) return [];

  return cookieStr.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    const n = name?.trim();
    const v = rest.join('=')?.trim() || '';
    
    // Detectar dominio (ML o Mercado Envíos)
    let domain = '.mercadolibre.com.ve';
    if (n === 'access_token' || n.startsWith('_ga') || n === 'mercadoenvios_user_cookie_consent') {
      domain = '.mercadoenvios.com.ve';
    }
    
    return {
      name: n,
      value: v,
      domain,
      path: '/',
      httpOnly: false,
      secure: true,
    };
  }).filter(c => c.name && c.value);
}

// ---------------------------------------------------------------------------
// HELPER: Inicializar Browser con Sesión Inyectada
// ---------------------------------------------------------------------------
async function createAuthBrowser(sessionCookie) {
  const browser = await chromium.launch({
    headless: true, // Cambiar a false para modo debug visual
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Evitar detección anti-bot
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    viewport: { width: 1366, height: 768 },
  });

  // Inyectar cookies de sesión
  if (sessionCookie) {
    const cookies = parseCookieString(sessionCookie);
    if (cookies.length > 0) {
      // Inyectar cookies en el contexto
      await context.addCookies(cookies);
      
      // Si hay un access_token, inyectarlo también para el subdominio www
      const tokenCookie = cookies.find(c => c.name === 'access_token');
      if (tokenCookie) {
        await context.addCookies([{ ...tokenCookie, domain: 'www.mercadoenvios.com.ve' }]);
      }
      
      console.log(`🍪 ${cookies.length} cookies de sesión inyectadas.`);
    }
  }

  return { browser, context };
}

// ---------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL: Extraer Teléfono de una Orden
// ---------------------------------------------------------------------------
/**
 * @param {string} orderId    - ID de la orden en ML (ej: "2000007654321")
 * @param {string} sessionCookie - Cookie de sesión del vendedor
 * @returns {{ phone: string|null, buyerName: string|null, error: string|null }}
 */
export async function scrapeOrderPhone(orderId, sessionCookie) {
  let browser = null;
  
  try {
    console.log(`📞 Iniciando scraping de teléfono para orden: ${orderId}`);
    
    const { browser: b, context } = await createAuthBrowser(sessionCookie);
    browser = b;

    const page = await context.newPage();
    
    // Ocultar que somos un bot de forma más profunda
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Truco extra: añadir plugins falsos para parecer un navegador real
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    // Navegar a la vista detallada de la orden
    const orderUrl = `${ML_BASE_URL}/ventas/${orderId}/detalle`;
    await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: SCRAPER_TIMEOUT });

    // Verificar que la sesión está activa (si redirige al login, la cookie expiró)
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/registration')) {
      return { phone: null, buyerName: null, error: 'SESSION_EXPIRED' };
    }

    // Esperar a que cargue la sección del comprador
    await page.waitForSelector('[data-testid="buyer-info"], .avi-order-buyer, .ui-pdp-seller', {
      timeout: SCRAPER_TIMEOUT
    }).catch(() => null);

    // Estrategia 1: Buscar el botón "Ver teléfono" en ML (Legacy/Fallback)
    const phoneButtonSelectors = [
      'button[data-testid="phone-reveal-button"]',
      'button:has-text("Ver teléfono")',
      'button:has-text("Ver número")',
    ];

    let phoneText = null;
    let buyerName = null;
    for (const selector of phoneButtonSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1000);
        const phoneEl = page.locator('[data-testid="phone-number"], .phone-revealer__number').first();
        phoneText = await phoneEl.textContent({ timeout: 3000 }).catch(() => null);
        if (phoneText) break;
      }
    }

    // 🚀 ESTRATEGIA "PORTAL DIRECTO VENEZUELA": Ir directo a Mercado Envíos
    if (!phoneText) {
      const portalOrderUrl = `https://www.mercadoenvios.com.ve/vendedor/orden/${orderId}`;
      console.log(`➡️ Intentando acceso directo al portal de envíos: ${portalOrderUrl}`);
      
      // Inyectar token en LocalStorage antes de navegar
      const cookies = await context.cookies();
      const token = cookies.find(c => c.name === 'access_token')?.value;
      if (token) {
        await page.addInitScript(t => {
          window.localStorage.setItem('token', t);
          window.localStorage.setItem('access_token', t);
        }, token);
      }

      // 1. Ir a la Home para inicializar sesión
      await page.goto('https://www.mercadoenvios.com.ve/', { waitUntil: 'networkidle', timeout: SCRAPER_TIMEOUT });
      
      // Eliminar banner de cookies si existe
      await page.evaluate(() => {
        const banner = document.querySelector('.cookie-banner, #cookie-banner, .andes-snackbar--cookie');
        if (banner) banner.remove();
        // O simplemente buscar por texto "Entendido"
        const buttons = Array.from(document.querySelectorAll('button'));
        const entendido = buttons.find(b => b.innerText.includes('Entendido'));
        if (entendido) entendido.click();
      }).catch(() => null);

      // 2. Click en CONÉCTATE si no estamos logueados
      const connectBtn = page.locator('a:has-text("CONÉCTATE"), button:has-text("CONÉCTATE"), .btn-conectate').first();
      if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('🔗 Haciendo clic en CONÉCTATE...');
        await connectBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }

      // 3. Click en Ingresar con Mercado Libre
      const mlLoginBtn = page.locator('button:has-text("Ingresar con mi cuenta de Mercado Libre"), .btn-ml, .btn-yellow').first();
      if (await mlLoginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('🔑 Sincronizando con cuenta de Mercado Libre...');
        await mlLoginBtn.click({ force: true });
        
        // Esperar a que el portal nos reconozca
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
      }

      // 4. Ahora sí, ir a la orden directa
      console.log(`➡️ Navegando a la orden: ${portalOrderUrl}`);
      await page.goto(portalOrderUrl, { waitUntil: 'networkidle', timeout: SCRAPER_TIMEOUT });
      
      // Esperar a que la App de Angular se inicialice (el contenedor principal)
      await page.waitForSelector('melienvios-root', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(3000); // Dar tiempo extra para renderizado final


      // Una vez en la página de la orden del portal
      const portalPhoneSelectors = [
        'p:has-text("Teléfono:")',
        'p:has-text("Quien recibe:")',
        '.receiver-phone',
        'text=/Teléfono:.*/',
      ];

      for (const selector of portalPhoneSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
          let text = await el.textContent().catch(() => null);
          if (text) {
            if (text.includes('Teléfono:')) {
              phoneText = text.replace('Teléfono:', '').trim();
              console.log(`🎯 Teléfono recuperado del Portal: ${phoneText}`);
            }
            if (text.includes('Quien recibe:')) {
              buyerName = text.replace('Quien recibe:', '').trim();
              console.log(`👤 Nombre del receptor recuperado: ${buyerName}`);
            }
          }
        }
      }

      // Detectar si la orden está incompleta (según captura del usuario)
      const isIncomplete = await page.locator('text=/Incompleta/i').isVisible().catch(() => false);
      if (!phoneText && isIncomplete) {
        console.log('⚠️ La orden aparece como INCOMPLETA en el portal (datos de envío pendientes por el comprador).');
      }
    }

    // Estrategia 3: Buscar el número directamente en ML por Regex (Último recurso)
    if (!phoneText) {
      const bodyText = await page.innerText('body');
      const phoneMatch = bodyText.match(/(?:0414|0424|0412|0416|0426)[-\s]?\d{3}[-\s]?\d{4}/);
      if (phoneMatch) {
        phoneText = phoneMatch[0];
        console.log(`🔎 Teléfono detectado por Regex en el body: ${phoneText}`);
      }
    }

    // Extraer nombre del comprador (si no se obtuvo del portal)
    const buyerSelectors = [
      '[data-testid="buyer-name"]',
      '.avi-order-buyer__name',
      '.buyer-name',
    ];
    
    if (!buyerName) {
      for (const selector of buyerSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          buyerName = await el.textContent({ timeout: 3000 }).catch(() => null);
          if (buyerName) break;
        }
      }
    }

    // Limpiar el número (remover espacios, guiones, etc.)
    if (phoneText) {
      phoneText = phoneText.replace(/[^\d+]/g, '').trim();
      // Normalizar a formato Venezuela
      if (phoneText.startsWith('0')) {
        phoneText = '58' + phoneText.substring(1);
      }
      if (!phoneText.startsWith('+') && phoneText.length > 0) {
        phoneText = '+' + phoneText;
      }
    }

    console.log(`✅ Scraping completado. Teléfono: ${phoneText || 'No encontrado'}, Comprador: ${buyerName || 'N/A'}`);
    
    // Si no se encontró nada, tomar captura para debug
    if (!phoneText) {
      await page.screenshot({ path: 'last_order_view.png', fullPage: true });
      console.log('📸 Captura de pantalla guardada como last_order_view.png');
    }

    return { 
      phone: phoneText?.trim() || null, 
      buyerName: buyerName?.trim() || null,
      error: null
    };

  } catch (err) {
    console.error(`❌ Error en scraping de orden ${orderId}:`, err.message);
    return { phone: null, buyerName: null, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

// ---------------------------------------------------------------------------
// FUNCIÓN: Extraer Datos Extendidos de una Publicación (Sniper Pro)
// ---------------------------------------------------------------------------
/**
 * Obtiene datos de una publicación de ML que la API no expone directamente:
 * - Número de visitas (si no está en API)
 * - Preguntas frecuentes sin responder
 * - Detalles de logística visibles al comprador
 *
 * @param {string} permalink - URL completa de la publicación (ej: https://articulo.mercadolibre.com.ve/...)
 * @returns {{ visits: number|null, hasEnvioGratis: boolean, questions: number, error: string|null }}
 */
export async function scrapePublicationData(permalink) {
  let browser = null;
  
  try {
    console.log(`🔍 Scraping datos de publicación: ${permalink}`);
    
    // Para datos públicos de publicaciones, NO necesitamos cookie de sesión
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'es-VE',
    });

    const page = await context.newPage();
    await page.goto(permalink, { waitUntil: 'domcontentloaded', timeout: SCRAPER_TIMEOUT });

    // Verificar si la publicación está activa
    const is404 = await page.locator('h1:has-text("no existe")').isVisible({ timeout: 2000 }).catch(() => false);
    if (is404) return { visits: null, hasEnvioGratis: false, questions: 0, error: 'ITEM_NOT_FOUND' };

    // Extraer "Envío Gratis"
    const hasEnvioGratis = await page.locator('text=Envío gratis').first().isVisible({ timeout: 3000 }).catch(() => false);

    // Extraer cantidad de preguntas
    let questionCount = 0;
    const questionsEl = page.locator('[data-testid="questions-summary"] h2, .qadb-tabs-container span').first();
    if (await questionsEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const qtxt = await questionsEl.textContent().catch(() => '0');
      const match = qtxt.match(/(\d+)/);
      questionCount = match ? parseInt(match[1]) : 0;
    }

    // Intentar extraer visitas (a veces visible en la página)
    let visits = null;
    const visitsEl = page.locator('text=/\\d+ visita/, text=/\\d+ visitantes/').first();
    if (await visitsEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const vtxt = await visitsEl.textContent().catch(() => '');
      const vmatch = vtxt.match(/(\d+)/);
      visits = vmatch ? parseInt(vmatch[1]) : null;
    }

    // Extraer Vendedor (Reputación del vendedor - visible en página pública)
    const sellerRep = await page.locator('[class*="reputation"] [class*="status"]').first().textContent({ timeout: 3000 }).catch(() => null);

    console.log(`✅ Datos de publicación: Envío Gratis=${hasEnvioGratis}, Preguntas=${questionCount}, Visitas=${visits}`);

    return { visits, hasEnvioGratis, questions: questionCount, sellerReputation: sellerRep?.trim() || null, error: null };

  } catch (err) {
    console.error(`❌ Error en scraping de publicación:`, err.message);
    return { visits: null, hasEnvioGratis: false, questions: 0, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

// ---------------------------------------------------------------------------
// FUNCIÓN: Verificar si la Cookie de Sesión es Válida
// ---------------------------------------------------------------------------
/**
 * @param {string} sessionCookie - Cookie de sesión a validar
 * @returns {{ valid: boolean, nickname: string|null, userId: string|null }}
 */
export async function validateSessionCookie(sessionCookie) {
  let browser = null;
  try {
    const { browser: b, context } = await createAuthBrowser(sessionCookie);
    browser = b;
    const page = await context.newPage();
    
    // Ocultar que somos un bot
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Ir a la página de "Mis ventas" - requiere autenticación
    await page.goto(`${ML_VENTAS_URL}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/registration');

    let nickname = null;
    if (isLoggedIn) {
      const nickEl = page.locator('[class*="nav-user"] span, [class*="user__name"]').first();
      nickname = await nickEl.textContent({ timeout: 5000 }).catch(() => null);
    }

    return { valid: isLoggedIn, nickname: nickname?.trim() || null, userId: null };
  } catch (err) {
    return { valid: false, nickname: null, userId: null };
  } finally {
    if (browser) await browser.close();
  }
}
