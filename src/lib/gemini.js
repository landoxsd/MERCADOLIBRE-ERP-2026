// ================================================================
// src/lib/gemini.js
// Cliente de Google Gemini AI con Pool de Claves y Rotación Round-Robin
// Optimizado para enriquecimiento masivo de autopartes en Mercado Libre
// ================================================================

// 1. Recopilar todas las claves configuradas en las variables de entorno
function getGeminiApiKeys() {
  const keys = [];
  
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2.trim());
  if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3.trim());
  if (process.env.GEMINI_API_KEY_4) keys.push(process.env.GEMINI_API_KEY_4.trim());
  
  // Soporte para más claves arbitrarias (GEMINI_API_KEY_5, etc.)
  for (let i = 5; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k.trim());
  }

  // Filtrar duplicados o vacíos
  return Array.from(new Set(keys.filter(Boolean)));
}

let currentKeyIndex = 0;

/**
 * Obtiene la siguiente clave API en rotación Round-Robin
 */
function getNextApiKey() {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;
  
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

/**
 * Ejecuta una consulta contra el modelo de Gemini con reintento automático y conmutación de claves
 */
export async function generateWithGemini(prompt, systemInstruction = "", maxRetries = 3) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("No hay ninguna clave GEMINI_API_KEY configurada en .env.local");
  }

  const modelName = "gemini-3.6-flash"; // Modelo más reciente y optimizado
  let lastError = null;

  for (let attempt = 0; attempt < Math.min(maxRetries, keys.length * 2); attempt++) {
    const apiKey = getNextApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2, // Baja temperatura para máxima precisión técnica
        maxOutputTokens: 1000
      }
    };

    if (systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Si es Rate Limit (429) o Quota Exceeded, rotamos inmediatamente a la siguiente clave
        if (response.status === 429 || errorData.error?.status === "RESOURCE_EXHAUSTED") {
          console.warn(`⚠️ [Gemini Pool] Límite temporal alcanzado en clave ...${apiKey.slice(-6)}. Conmutando a la siguiente clave del pool...`);
          lastError = new Error(errorData.error?.message || "Rate Limit Exceeded");
          continue;
        }

        throw new Error(`Gemini API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Gemini no devolvió texto en la respuesta.");
      }

      return text.trim();

    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [Gemini Pool] Error en intento ${attempt + 1}: ${err.message}`);
    }
  }

  throw lastError || new Error("Error desconocido al consultar Gemini AI.");
}

/**
 * Enriquecedor de Ficha Técnica para Autopartes en Mercado Libre
 * Genera la descripción profesional estructurada y extrae compatibilidades
 */
export async function enrichAutopartListing({ sku, title, brand, oem, subline }) {
  const systemPrompt = `Eres un especialista técnico en autopartes y comercio electrónico en Mercado Libre Venezuela.
Tu trabajo es generar la descripción técnica oficial para una publicación de repuestos automotrices.
Reglas obligatorias:
1. No uses formato HTML ni Markdown complejo que no soporte Mercado Libre (no uses tablas con pipes | ni encabezados #). Usa texto plano estructurado con viñetas claras y mayúsculas.
2. Si detectas el vehículo o aplicación en el título, genera una sección clara de "COMPATIBILIDAD Y APLICACIÓN" con Marca, Modelo y Años estimados.
3. Incluye ficha técnica con SKU, Marca, Código OEM / Número de Parte y Posición.
4. Finaliza con una política de garantía clara de Tienda Oficial (90 días de garantía contra defectos de fábrica, envíos a todo el país y retiro en tienda física).
5. Sé directo, profesional y conciso.`;

  const prompt = `Genera la descripción de Mercado Libre para este repuesto:
- SKU: ${sku || "N/A"}
- Producto / Título: ${title}
- Marca: ${brand || "Genérico / Original"}
- Código OEM / Referencia: ${oem || "N/A"}
- Sublínea / Categoría: ${subline || "Autopartes"}`;

  try {
    const description = await generateWithGemini(prompt, systemPrompt);
    return {
      success: true,
      description
    };
  } catch (error) {
    console.error(`❌ Error enriqueciendo SKU ${sku} con Gemini:`, error.message);
    // Fallback estándar si la IA falla
    return {
      success: false,
      description: `¡BIENVENIDOS A NUESTRA TIENDA OFICIAL!\n\nPRODUCTO: ${title}\nSKU: ${sku}\nMARCA: ${brand || 'Original'}\nOEM: ${oem || 'N/A'}\n\n- Repuesto 100% nuevo garantizado.\n- Envíos a nivel nacional.\n- Garantía de 90 días por defectos de fábrica.`
    };
  }
}
