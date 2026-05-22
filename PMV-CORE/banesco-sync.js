const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const { parseBanescoTxt } = require("./parser");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function notifyToWhatsApp(message, type = 'INFO') {
    try {
        await axios.post(`http://localhost:${process.env.PORT || 3000}/notify`, { message, type });
    } catch (e) {
        console.error("⚠️ No se pudo enviar notificación a WhatsApp (¿Está el bot encendido?)");
    }
}

async function handlePopups(page) {
    try {
        const continuarBtn = page.locator('button:has-text("Continuar"), input[value="Continuar"]');
        if (await continuarBtn.isVisible({ timeout: 2000 })) {
            console.log("👆 Detectado popup de inactividad. Haciendo clic en Continuar...");
            await continuarBtn.click();
        }
    } catch (e) {}
}

let browser = null;
let context = null;
let page = null;

async function ensureBrowser() {
  if (!browser) {
    console.log("🌐 Iniciando navegador persistente...");
    browser = await chromium.launch({
        headless: process.env.BANESCO_HEADLESS === "true",
        args: [
            "--no-sandbox", 
            "--disable-blink-features=AutomationControlled",
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ]
    });
    context = await browser.newContext({ 
        acceptDownloads: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    page.setDefaultTimeout(60000);
  }
  return { browser, page };
}

async function syncBanesco() {
  console.log("🏦 Iniciando sincronización de Banesco...");
  await ensureBrowser();
  await handlePopups(page);
  
  try {
    // Si ya estamos en una página de Banesco, intentamos refrescar o navegar
    if (page.url().includes("banesconline.com")) {
        console.log("🔄 Sesión persistente detectada. Refrescando...");
        await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    }
    // 1. LOGIN con Camuflaje (Solo si no estamos logueados)
    if (!page.url().includes("default.aspx") && !page.url().includes("movimientoscuenta.aspx")) {
        console.log("🔗 Sesión no detectada. Iniciando login...");
        console.log("🔗 Navegando a Banesco informativo...");
        await page.goto("https://www.banesco.com/", { waitUntil: 'networkidle' });
        
        console.log("🖱️ Saltando a Banesconline...");
        await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx", { waitUntil: 'networkidle' });
        
        let loginFrame = page; 
        
        console.log("🔍 Buscando campos de acceso...");
        const frames = page.frames();
        let found = false;
        
        for (const frame of frames) {
            try {
                const userField = frame.locator("#txtUsuario");
                if (await userField.isVisible({ timeout: 5000 })) {
                    loginFrame = frame;
                    found = true;
                    break;
                }
            } catch (e) {}
        }

        if (found && process.env.BANESCO_USER) {
            console.log("👤 Ingresando credenciales...");
            await loginFrame.fill("#txtUsuario", process.env.BANESCO_USER);
            await loginFrame.click("#bAceptar");
        
        // --- RADAR TOTAL DE ERRORES (Escanea todos los frames) ---
        console.log("🔍 Escaneando página en busca de bloqueos...");
        await page.waitForTimeout(2000); // Un respiro para que el banco responda
        
        const allFrames = page.frames();
        let isBlocked = false;
        for (const f of allFrames) {
            const msg = await f.locator('text=/conexión activa/i').isVisible().catch(() => false);
            if (msg) {
                console.log("🚨 BLOQUEO CONFIRMADO: Sesión activa detectada en un sub-marco.");
                await f.click('input[value="Aceptar"]').catch(() => {});
                isBlocked = true;
                break;
            }
        }

        if (isBlocked) {
            await notifyToWhatsApp("⏳ *Banesco:* Sesión activa. El robot esperará 5 min para el próximo latido.");
            throw new Error("sesión activa");
        }

        // Si no hay bloqueo, seguimos buscando la clave
        await loginFrame.waitForSelector("#txtClave", { timeout: 10000 }).catch(async () => {
            // Re-chequeo rápido por si el error salió después
            if (await page.locator('text=/conexión activa/i').isVisible()) throw new Error("sesión activa");
            console.log("⚠️ No se ve el campo de clave, revisa la ventana del banco.");
        });

        if (await loginFrame.locator("#txtClave").isVisible()) {
            await loginFrame.fill("#txtClave", process.env.BANESCO_PASS);
            await loginFrame.click("#bAceptar");
        }
    } else {
        await notifyToWhatsApp("⚠️ *ATENCIÓN:* Se requiere intervención manual en el banco.");
    }
    } else {
        console.log("✅ Ya estamos dentro de Banesco. Saltando login.");
    }

    console.log("⏳ Esperando navegación post-login...");
    // Esperamos a que cargue el dashboard principal
    await page.waitForURL("**/default.aspx", { timeout: 60000 }).catch(() => {});

    if (page.url().includes("default.aspx")) {
        console.log("🔍 Detectada pantalla de Resumen. Entrando a la cuenta...");
        // Buscamos el link que parece un número de cuenta (formato 0134-...)
        const accountLink = page.locator('a:has-text("0134")').first();
        if (await accountLink.isVisible()) {
            await accountLink.click();
        } else {
            console.log("⚠️ No se encontró el link de la cuenta, por favor haz clic manualmente.");
        }
    }

    // Ahora sí esperamos a llegar a los movimientos
    console.log("⏳ Esperando a que el banco cargue los movimientos...");
    await page.waitForURL(/.*movimientoscuenta\.aspx/i, { timeout: 30000 }).catch(() => {
        console.log("ℹ️ Nota: No se detectó cambio de URL, pero seguiremos intentando detectar el botón de exportar.");
    });

    // 2. CONSULTAR Y EXPORTAR (Detección por contenido, no solo por URL)
    const exportBtn = page.locator('input[value="Exportar"]');
    const consultBtn = page.locator('input[value="Consultar"]');

    if (await exportBtn.isVisible() || page.url().toLowerCase().includes("movimientoscuenta")) {
        console.log("✅ Pantalla de movimientos detectada por botones.");
        await handlePopups(page);
        console.log("🔍 Cargando movimientos bancarios (Consultar)...");
        await consultBtn.click().catch(() => {});
        await page.waitForTimeout(3000);

        console.log("🖱️ Iniciando Exportación...");
        await exportBtn.click();
        
        // --- EXPORTACIÓN: Diagnóstico + Clic por evaluate() ---
        console.log("⏳ Esperando pantalla de exportación...");
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3000);

        // DIAGNÓSTICO: ¿Qué ve el robot en cada frame?
        const allExportFrames = page.frames();
        console.log(`🔬 Frames en la página: ${allExportFrames.length}`);
        for (let i = 0; i < allExportFrames.length; i++) {
            const f = allExportFrames[i];
            const diag = await f.evaluate(() => {
                const inputs = document.querySelectorAll('input[type="radio"], input[type="submit"]');
                const selects = document.querySelectorAll('select');
                const details = [];
                inputs.forEach(el => details.push(`${el.type}|id=${el.id}|name=${el.name}|value=${el.value}`));
                selects.forEach(el => details.push(`select|id=${el.id}|name=${el.name}`));
                return { count: inputs.length + selects.length, elements: details.slice(0, 15) };
            }).catch(() => ({ count: 0, elements: [] }));
            if (diag.count > 0) {
                console.log(`   Frame[${i}] (${f.url().slice(0, 80)}): ${diag.count} elementos`);
                diag.elements.forEach(e => console.log(`     → ${e}`));
            }
        }

        // Buscar el frame correcto que tiene el formulario
        let exportFrame = page;
        for (const f of allExportFrames) {
            const hasForm = await f.evaluate(() => {
                return !!(document.querySelector('#ctl00_cp_rbFormato_0') || 
                          document.querySelector('input[name="ctl00$cp$rbFormato"]') ||
                          document.querySelector('#ctl00_cp_btnOk'));
            }).catch(() => false);
            if (hasForm) {
                console.log(`🎯 Marco con formulario encontrado: ${f.url().slice(0, 80)}`);
                exportFrame = f;
                break;
            }
        }

        // Seleccionar Predeterminada + Click Aceptar — TODO dentro de evaluate()
        console.log("🖱️ Seleccionando formato y preparando descarga (evaluate directo)...");
        const evalResult = await exportFrame.evaluate(() => {
            const out = { radioFound: false, radioClicked: false, btnFound: false };
            
            // 1. Buscar y marcar el radio de Predeterminada
            const radio = document.querySelector('#ctl00_cp_rbFormato_0') 
                || document.querySelector('input[name="ctl00$cp$rbFormato"]');
            if (radio) {
                out.radioFound = true;
                radio.checked = true;
                radio.click();
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                out.radioClicked = true;
            }
            
            // 2. Verificar si el botón Aceptar existe
            const btn = document.querySelector('#ctl00_cp_btnOk') 
                || document.querySelector('input[value="Aceptar"]');
            if (btn) {
                out.btnFound = true;
                out.btnId = btn.id;
                out.btnVisible = btn.offsetParent !== null;
            }
            
            return out;
        });
        console.log(`   Resultado: radio=${evalResult.radioFound}/${evalResult.radioClicked}, btn=${evalResult.btnFound} (visible=${evalResult.btnVisible}, id=${evalResult.btnId})`);

        await page.waitForTimeout(1500);

        // Ahora el clic en Aceptar con Playwright (para capturar el download event)
        console.log("📥 Presionando Aceptar para descargar...");
        const acceptBtn = exportFrame.locator('#ctl00_cp_btnOk, input[value="Aceptar"]').first();
        
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 60000 }),
          acceptBtn.click({ force: true })
        ]);

        console.log("✅ Archivo descargado correctamente.");

        const path = await download.path();
        const content = fs.readFileSync(path, "latin1"); 

        // 4. PARSEAR E INSERTAR EN SUPABASE
        const movements = parseBanescoTxt(content);
        console.log(`📊 Se extrajeron ${movements.length} movimientos de crédito.`);

        let inserted = 0;
        for (const tx of movements) {
          const { error } = await supabase
            .from("bank_statements_staging")
            .upsert({
              ...tx,
              bank_name: "Banesco",
              account_number: process.env.BANESCO_ACCOUNT_NUMBER || "PRINCIPAL",
              payload: tx
            }, { onConflict: 'row_hash' });

          if (!error) inserted++;
          else console.error("❌ Error en upsert:", error.message);
        }

        console.log("✅ Sincronización completada.");
        await notifyToWhatsApp(`✅ *Sincronización Exitosa:* Se encontraron ${inserted} movimientos nuevos.`, 'BANK_SYNC_COMPLETE');

        // Ya no cerramos sesión ni el navegador para mantener la persistencia
        console.log("🛋️ Manteniendo sesión viva para el próximo ciclo...");
    }

  } catch (error) {
    const errMsg = error?.message || String(error);
    console.error("❌ Error durante la sincronización:", errMsg);
    if (errMsg.includes("sesión activa")) {
        await notifyToWhatsApp("⏳ *Banesco:* Sesión previa activa. Reintentando en el próximo ciclo.");
    }
  } finally {
    // browser.close(); // ELIMINADO: El navegador se queda abierto
    console.log("📡 Ciclo finalizado. Navegador en espera.");
  }
}

module.exports = { syncBanesco };
