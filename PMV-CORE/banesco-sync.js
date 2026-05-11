const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const { parseBanescoTxt } = require("./parser");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function syncBanesco() {
  console.log("🏦 Iniciando sincronización REAL de Banesco...");
  
  const browser = await chromium.launch({
    headless: process.env.BANESCO_HEADLESS === "false",
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // 1. LOGIN (Manual o Auto)
    await page.goto("https://www.banesconline.com/mantis/Website/Login.aspx");
    if (process.env.BANESCO_USER) {
        await page.fill("#txtUsuario", process.env.BANESCO_USER);
        await page.fill("#txtClave", process.env.BANESCO_PASS);
        await page.click("#bAceptar");
    }

    console.log("⏳ Esperando llegada a la pantalla de movimientos...");
    await page.waitForURL("**/movimientoscuenta.aspx", { timeout: 300000 });

    // 2. CLIC EN EXPORTAR
    console.log("🖱️ Haciendo clic en Exportar...");
    await page.click('input[value="Exportar"]');
    await page.waitForURL("**/Exportar.aspx");

    // 3. CONFIGURAR FORMATO TXT
    console.log("⚙️ Configurando formato de descarga...");
    await page.click("#ctl00_cp_rbFormato_1"); // Personalizado
    await page.waitForTimeout(1000);
    await page.click("#ctl00_cp_rbDivision_1"); // Delimitador
    
    // 4. DESCARGAR
    console.log("📥 Iniciando descarga del reporte...");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#ctl00_cp_btnOk")
    ]);

    const path = await download.path();
    const fs = require("fs");
    const content = fs.readFileSync(path, "latin1"); // Banesco usa codificación Latin1

    // 5. PARSEAR E INSERTAR EN SUPABASE STAGING
    const movements = parseBanescoTxt(content);
    console.log(`📊 Se extrajeron ${movements.length} movimientos válidos.`);

    for (const tx of movements) {
      console.log(`📤 Sincronizando Ref: ${tx.reference_number} - Monto: ${tx.amount}`);
      const { error } = await supabase
        .from("bank_statements_staging")
        .upsert({
          ...tx,
          account_number: "PRINCIPAL", // Ajustar si tienes varias cuentas
          payload: tx
        }, { onConflict: 'row_hash' });

      if (error) console.error("❌ Error:", error.message);
    }

    console.log("✅ Sincronización completada.");

  } catch (error) {
    console.error("❌ Error en el proceso:", error.message);
  } finally {
    // browser.close(); // Lo dejamos abierto para que veas el resultado
  }
}

syncBanesco();
