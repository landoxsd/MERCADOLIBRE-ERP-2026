const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./load-env');

// ================================================================
// PUBLICADOR DIRECTO VÍA API MERCADOLIBRE (Desktop CLI Edition)
// ================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let CONFIG = {
  PHOTOS_PATH: "C:\\Users\\ORLANDO\\Pictures\\FOTOS",
  TIPO_PUBLICACION: "gold_special", // "gold_special" (Clásica) o "gold_pro" (Premium)
  USE_GEMINI_AI: true,
  FALLBACK_IMAGE_URL: "https://http2.mlstatic.com/D_NQ_NP_918237-MLV52098675124_102022-O.webp"
};

try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const extConf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    CONFIG = { ...CONFIG, ...extConf };
    if (CONFIG.TIPO_PUBLICACION === "Clásica" || CONFIG.TIPO_PUBLICACION === "Clasica") CONFIG.TIPO_PUBLICACION = "gold_special";
    if (CONFIG.TIPO_PUBLICACION === "Premium") CONFIG.TIPO_PUBLICACION = "gold_pro";
  }
} catch (e) {
  console.warn("⚠️ Usando configuración por defecto.");
}

// Diccionario SEO
const ABBREVIATIONS = {
  'AMORT.': 'AMORTIGUADOR', 'AMORT': 'AMORTIGUADOR',
  'DEL.': 'DELANTERO', 'DEL': 'DELANTERO', 'DELT.': 'DELANTERO', 'DELT': 'DELANTERO',
  'TRAS.': 'TRASERO', 'TRAS': 'TRASERO', 'TRST.': 'TRASERO', 'TRST': 'TRASERO',
  'IZQ.': 'IZQUIERDO', 'IZQ': 'IZQUIERDO',
  'DER.': 'DERECHO', 'DER': 'DERECHO',
  'SUP.': 'SUPERIOR', 'SUP': 'SUPERIOR',
  'INF.': 'INFERIOR', 'INF': 'INFERIOR',
  'PAST.': 'PASTILLAS', 'PAST': 'PASTILLAS',
  'BOMB.': 'BOMBA', 'BOMB': 'BOMBA',
  'BUJ.': 'BUJE', 'BUJ': 'BUJE',
  'ROT.': 'ROTULA', 'ROT': 'ROTULA',
  'TERM.': 'TERMINAL', 'TERM': 'TERMINAL',
  'KIT.': 'KIT', 'KIT': 'KIT',
  'EMP.': 'EMPACADURA', 'EMP': 'EMPACADURA',
  'ESTOP.': 'ESTOPERA', 'ESTOP': 'ESTOPERA',
  'ROD.': 'RODAMIENTO', 'ROD': 'RODAMIENTO',
  'FILT.': 'FILTRO', 'FILT': 'FILTRO',
  'VALV.': 'VALVULA', 'VALV': 'VALVULA',
  'CHEV.': 'CHEVROLET', 'CHEV': 'CHEVROLET', 'CHEVY': 'CHEVROLET',
  'TOY.': 'TOYOTA', 'TOY': 'TOYOTA',
  'MIT.': 'MITSUBISHI', 'MIT': 'MITSUBISHI',
  'HYU.': 'HYUNDAI', 'HYU': 'HYUNDAI',
  'FOR.': 'FORD', 'FOR': 'FORD',
  'MAZ.': 'MAZDA', 'MAZ': 'MAZDA',
  'REN.': 'RENAULT', 'REN': 'RENAULT',
  'CIL.': 'CILINDRO', 'CIL': 'CILINDRO',
  'MULT.': 'MULTIPLE', 'MULT': 'MULTIPLE',
  'CREM.': 'CREMALLERA', 'CREM': 'CREMALLERA'
};

function formatSEOTitle(rawTitle) {
  if (!rawTitle) return '';
  let seoTitle = String(rawTitle).toUpperCase();
  
  const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
  const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
  
  seoTitle = seoTitle.replace(regex, (matched) => {
    const upperMatched = matched.toUpperCase();
    return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'] || matched;
  });

  seoTitle = seoTitle
    .replace(/[,()]/g, " ")
    .replace(/\.([A-Z])/g, " $1")
    .replace(/\./g, " ")
    .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
    .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  let finalTitle = seoTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  if (finalTitle.length > 60) {
    let truncated = finalTitle.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 45) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated.trim();
  }

  return finalTitle;
}

// Pool de claves de Gemini AI
const GEMINI_KEYS = [
  "AQ.Ab8RN6KbmOMCoBP6zkXe8KBhgmFW1n-uW5vUz8IaV7muPEfKLQ",
  "AQ.Ab8RN6JxxxUXcA0YHCA4_9BQv61zVxrTbeTcgFcGFAALKENnkw",
  "AQ.Ab8RN6IYISIo4krw7I18cjRsOQpgXkifkTXCJkMl_yPWeuKwGg",
  "AQ.Ab8RN6JRjH7poiAXcqI-TvBc8mf6qFD7tNcERYzIKT7Zo5NjBw"
];
let keyIdx = 0;

async function askGemini(prompt, systemPrompt) {
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
    keyIdx++;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      }
    } catch (e) {
      // Intentar con la siguiente clave
    }
  }
  return null;
}

async function uploadPictureToMeli(fileBuffer, filename, accessToken) {
  const boundary = '----MercadoLibreFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const ext = filename.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const partHeader = Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="file"; filename="image.jpg"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`
  );
  const partFooter = Buffer.from(`${crlf}--${boundary}--${crlf}`);
  const body = Buffer.concat([partHeader, fileBuffer, partFooter]);

  const res = await fetch(`https://api.mercadolibre.com/pictures/items/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length.toString()
    },
    body: body
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.id ? { id: json.id } : null;
}

async function main() {
  console.log("\n=======================================================");
  console.log("   🚀 PUBLICADOR MASIVO DIRECTO VÍA API MERCADOLIBRE   ");
  console.log("   Autopartes · Soporte Tienda Oficial · Gemini IA     ");
  console.log("=======================================================\n");

  // 1. Obtener Cuenta de ML en Supabase
  console.log("🔑 Consultando credenciales en Supabase...");
  const { data: accounts, error: accErr } = await supabase.from('meli_accounts').select('*').limit(1);
  if (accErr || !accounts || accounts.length === 0) {
    console.error("❌ No se encontró ninguna cuenta vinculada en Supabase.");
    process.exit(1);
  }

  const account = accounts[0];
  let accessToken = account.access_token;
  console.log(`👤 Cuenta vinculada: ${account.nickname || account.meli_user_id}`);

  // Verificar si el token necesita refresco
  if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
    console.log("🔄 Refrescando token de acceso vencido...");
    const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: account.client_id || "2657663366318591",
        client_secret: process.env.MELI_CLIENT_SECRET || "",
        refresh_token: account.refresh_token
      })
    });
    if (refreshRes.ok) {
      const tokenData = await refreshRes.json();
      accessToken = tokenData.access_token;
    }
  }

  // Obtener official_store_id si existe
  let officialStoreId = null;
  try {
    const userRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    if (userData.brands && Array.isArray(userData.brands)) {
      const b = userData.brands.find(br => br.official_store_id);
      if (b) officialStoreId = b.official_store_id;
    }
  } catch (e) {}

  if (officialStoreId) {
    console.log(`🏷️  Tienda Oficial Detectada ID: ${officialStoreId}`);
  }

  // 2. Leer Carpeta de Profit
  const inputProfitDir = path.join(__dirname, 'Input_Profit');
  const profitFiles = fs.readdirSync(inputProfitDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  if (profitFiles.length === 0) {
    console.error("❌ No hay archivos en Input_Profit/. Coloca tu Excel de Profit Plus.");
    process.exit(1);
  }

  const profitFilePath = path.join(inputProfitDir, profitFiles[0]);
  console.log(`📄 Leyendo archivo: ${profitFiles[0]}...`);

  const workbook = xlsx.readFile(profitFilePath);
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

  // Detectar columnas
  const colMap = { sku: -1, title: -1, price: -1, stock: -1, oem: -1, brand: -1, subline: -1 };
  let headerIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const str = row.map(c => String(c || '').toUpperCase()).join('|');
    if (str.includes('CODIGO') && str.includes('DESCRIPCION')) {
      headerIdx = i;
      row.forEach((cell, idx) => {
        const val = String(cell || '').toUpperCase().trim();
        if (val === 'CODIGO') colMap.sku = idx;
        if (val === 'DESCRIPCION') colMap.title = idx;
        if (val === 'STOCK' || val === 'EXISTENCIA') colMap.stock = idx;
        if (val === 'COSTO' || val === 'CAMPO4' || val === 'PRECIO') colMap.price = idx;
        if (val === 'REF' || val === 'CAMPO7' || val === 'ORIGINAL') colMap.oem = idx;
        if (val === 'CO CATEGORIA' || val === 'MARCA') colMap.brand = idx;
        if (val === 'SUBLINEA' || val === 'CATEGORIA' || val === 'LINEA') colMap.subline = idx;
      });
      break;
    }
  }

  if (colMap.sku === -1 || colMap.title === -1) {
    console.error("❌ No se pudieron detectar las columnas CODIGO y DESCRIPCION en el archivo.");
    process.exit(1);
  }

  // 3. Obtener productos ya publicados en Supabase
  console.log("☁️  Verificando productos ya publicados en Supabase...");
  const { data: existingProducts } = await supabase.from('products').select('sku');
  const publishedSkus = new Set((existingProducts || []).map(p => String(p.sku || '').trim().toUpperCase()));

  // 4. Filtrar ítems pendientes
  const pendingItems = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colMap.sku]) continue;

    const sku = String(row[colMap.sku] || '').trim().toUpperCase();
    if (publishedSkus.has(sku)) continue;

    const title = String(row[colMap.title] || '').trim();
    const price = parseFloat(row[colMap.price]) || 0;
    const stock = parseInt(row[colMap.stock], 10) || 0;
    const oem = colMap.oem !== -1 ? String(row[colMap.oem] || '').trim() : '';
    const brand = colMap.brand !== -1 ? String(row[colMap.brand] || '').trim() : 'Original';
    const subline = colMap.subline !== -1 ? String(row[colMap.subline] || '').trim() : '';

    if (sku && title && price >= 2 && stock > 0) {
      pendingItems.push({ sku, title, price, stock, oem, brand, subline });
    }
  }

  console.log(`📦 Productos nuevos listos para publicar: ${pendingItems.length}`);
  if (pendingItems.length === 0) {
    console.log("✅ Todos los productos del archivo ya están publicados.");
    process.exit(0);
  }

  // 5. Escaneo de Fotos Locales
  const photosDir = CONFIG.PHOTOS_PATH;
  let localFiles = [];
  if (fs.existsSync(photosDir)) {
    localFiles = fs.readdirSync(photosDir);
    console.log(`📁 Carpeta de fotos: ${photosDir} (${localFiles.length} archivos detectados)`);
  } else {
    console.warn(`⚠️ Carpeta de fotos ${photosDir} no encontrada. Se usarán imágenes provisionales.`);
  }

  // 6. Procesamiento Lote a Lote
  const resultsLog = [];
  console.log("\n🚀 INICIANDO PUBLICACIÓN...\n");

  for (let idx = 0; idx < pendingItems.length; idx++) {
    const item = pendingItems[idx];
    const progressStr = `[${idx + 1}/${pendingItems.length}]`;
    const skuLower = item.sku.toLowerCase();

    console.log(`-----------------------------------------------------`);
    console.log(`${progressStr} SKU: ${item.sku} | "${item.title}"`);

    // A. Subir fotos
    const pictures = [];
    let hasLocalPhoto = false;

    if (localFiles.length > 0) {
      const matches = localFiles.filter(f => {
        const base = f.split('.')[0].toLowerCase();
        if (base === skuLower) return true;
        const lastDash = base.lastIndexOf('-');
        if (lastDash !== -1) {
          const pref = base.substring(0, lastDash);
          const suff = base.substring(lastDash + 1);
          return pref === skuLower && /^\d+$/.test(suff);
        }
        return false;
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 6);

      if (matches.length > 0) {
        hasLocalPhoto = true;
        process.stdout.write(`   📸 Subiendo ${matches.length} fotos a ML... `);
        for (const file of matches) {
          const buf = fs.readFileSync(path.join(photosDir, file));
          const pic = await uploadPictureToMeli(buf, file, accessToken);
          if (pic) pictures.push(pic);
        }
        console.log(`✅ (${pictures.length} subidas)`);
      }
    }

    if (pictures.length === 0) {
      pictures.push({ source: CONFIG.FALLBACK_IMAGE_URL });
      console.log(`   🏷️  Usando imagen provisional de Tienda Oficial`);
    }

    // B. Título SEO
    const seoTitle = formatSEOTitle(item.title) || item.title;

    // C. Categoría ML
    let categoryId = null;
    try {
      const predRes = await fetch(`https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q=${encodeURIComponent(seoTitle)}`);
      const predData = await predRes.json();
      if (Array.isArray(predData) && predData.length > 0) {
        categoryId = predData[0].category_id;
      }
    } catch (e) {}

    if (!categoryId) categoryId = "MLV122587"; // Fallback autopartes general

    // D. Enriquecimiento con Gemini AI
    let descriptionText = `¡BIENVENIDOS A NUESTRA TIENDA OFICIAL!\n\nPRODUCTO: ${seoTitle}\nSKU: ${item.sku}\nOEM: ${item.oem || 'N/A'}\n\n- Producto nuevo garantizado.\n- Envíos a nivel nacional.\n- Garantía de 90 días por defectos de fábrica.`;

    if (CONFIG.USE_GEMINI_AI) {
      process.stdout.write(`   🧠 Enriqueciendo con Gemini 3.6 Flash... `);
      const aiDesc = await askGemini(
        `Genera la descripción de Mercado Libre para este repuesto:\n- SKU: ${item.sku}\n- Título: ${seoTitle}\n- OEM: ${item.oem}\n- Marca: ${item.brand}`,
        `Eres un especialista en autopartes de Mercado Libre Venezuela. Genera texto plano estructurado con compatibilidad de vehículos y garantía de 90 días.`
      );
      if (aiDesc) {
        descriptionText = aiDesc;
        console.log(`✅`);
      } else {
        console.log(`⚠️ (usando plantilla)`);
      }
    }

    // E. Publicar
    const payload = {
      title: seoTitle,
      category_id: categoryId,
      price: item.price,
      currency_id: "USD",
      available_quantity: item.stock,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: CONFIG.TIPO_PUBLICACION,
      pictures: pictures,
      attributes: [
        { id: "SELLER_SKU", value_name: item.sku },
        { id: "BRAND", value_name: item.brand || "Original" },
        { id: "PART_NUMBER", value_name: item.oem || item.sku }
      ],
      shipping: { mode: "not_specified" }
    };

    if (officialStoreId) {
      payload.official_store_id = Number(officialStoreId) || officialStoreId;
    }

    try {
      const pubRes = await fetch("https://api.mercadolibre.com/items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const pubData = await pubRes.json();
      if (pubRes.ok && pubData.id) {
        // Adjuntar descripción
        await fetch(`https://api.mercadolibre.com/items/${pubData.id}/description`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ plain_text: descriptionText })
        }).catch(() => {});

        // Guardar en Supabase
        await supabase.from('products').upsert({
          meli_item_id: pubData.id,
          meli_account_id: account.id,
          title: pubData.title,
          status: pubData.status,
          price: pubData.price,
          available_qty: pubData.available_quantity,
          permalink: pubData.permalink,
          thumbnail: pubData.thumbnail,
          category_id: pubData.category_id,
          sku: item.sku,
          raw_data: { ...pubData, photo_status: hasLocalPhoto ? 'real' : 'placeholder' },
          updated_at: new Date()
        }, { onConflict: 'meli_item_id' });

        console.log(`   🎉 PUBLICADO: ${pubData.id} -> ${pubData.permalink}`);
        resultsLog.push({ SKU: item.sku, Titulo: seoTitle, ID_ML: pubData.id, Link: pubData.permalink, Estado: 'EXITOSO', Foto: hasLocalPhoto ? 'REAL' : 'PLACEHOLDER' });
      } else {
        console.error(`   ❌ Error ML: ${JSON.stringify(pubData.message || pubData)}`);
        resultsLog.push({ SKU: item.sku, Titulo: seoTitle, ID_ML: '', Link: '', Estado: `ERROR: ${pubData.message || 'Fallo'}`, Foto: '' });
      }
    } catch (e) {
      console.error(`   ❌ Error de red: ${e.message}`);
      resultsLog.push({ SKU: item.sku, Titulo: seoTitle, ID_ML: '', Link: '', Estado: `ERROR RED: ${e.message}`, Foto: '' });
    }

    // Pequeña pausa preventiva de 400ms
    await new Promise(r => setTimeout(r, 400));
  }

  // 7. Guardar Reporte en Output/
  const outputDir = path.join(__dirname, 'Output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const reportPath = path.join(outputDir, `REPORTE_PUBLICACIONES_API_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
  
  const reportWb = xlsx.utils.book_new();
  const reportWs = xlsx.utils.json_to_sheet(resultsLog);
  xlsx.utils.book_append_sheet(reportWb, reportWs, 'Resultados');
  xlsx.writeFile(reportWb, reportPath);

  console.log(`\n=======================================================`);
  console.log(`✅ PROCESAMIENTO COMPLETADO.`);
  console.log(`📊 Reporte generado en: ${reportPath}`);
  console.log(`=======================================================\n`);
}

main().catch(err => {
  console.error("❌ Error fatal en publicador:", err);
});
