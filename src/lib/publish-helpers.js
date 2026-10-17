// ================================================================
// publish-helpers.js
// Lógica compartida: publicación individual y masiva vía API ML
// ================================================================
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { uploadPicture } from "@/lib/meli";
import { uploadImageToStorage } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";
export const OFFICIAL_STORE_PLACEHOLDER =
  "https://placehold.co/1500x1500/0f172a/ffffff.jpg?text=WORLD+CARS+OFICIAL";
let cachedPlaceholderPicId = null;

/**
 * Resuelve el directorio efectivo de fotos probando primero la ruta solicitada
 * y luego las rutas candidatas en vivo (\\192.168.1.10\e\FOTOS en Windows, /mnt/fotos en R630).
 */
export function resolveEffectivePhotosDir(requestedPath = "", fallbackSettingsPath = "") {
  const candidates = [
    requestedPath && String(requestedPath).trim(),
    process.env.PHOTOS_PATH || "",
    "/mnt/fotos",
    "\\\\192.168.1.10\\e\\FOTOS",
    "\\\\Servidor\\e\\FOTOS",
    fallbackSettingsPath && String(fallbackSettingsPath).trim(),
    "F:\\",
    "C:\\Users\\ORLANDO\\Pictures\\FOTOS",
    "/fotos",
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) {
        return dir;
      }
    } catch {
      // Continuar con siguiente candidato
    }
  }
  return requestedPath || fallbackSettingsPath || "";
}

/**
 * Auto-Recorte de Bordes Blancos (CropWhiteSpace) + Maximización en Lienzo (EnlargeImage)
 * Extraído por Ingeniería Inversa REA de Integraly v2.2.0.6:
 * Recorta márgenes blancos sobrantes y escala la pieza al ~92% de un lienzo 1500x1500 blanco puro.
 */
export async function optimizeAutopartPhotoBuffer(rawBuffer) {
  try {
    return await sharp(rawBuffer)
      .trim({ background: "#FFFFFF", threshold: 12 })
      .resize(1380, 1380, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement: false,
      })
      .extend({
        top: 60,
        bottom: 60,
        left: 60,
        right: 60,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    return rawBuffer;
  }
}

const ABBREVIATIONS = {
  "AMORT.": "AMORTIGUADOR",
  AMORT: "AMORTIGUADOR",
  "DEL.": "DELANTERO",
  DEL: "DELANTERO",
  "DELT.": "DELANTERO",
  DELT: "DELANTERO",
  "TRAS.": "TRASERO",
  TRAS: "TRASERO",
  "TRST.": "TRASERO",
  TRST: "TRASERO",
  "IZQ.": "IZQUIERDO",
  IZQ: "IZQUIERDO",
  "DER.": "DERECHO",
  DER: "DERECHO",
  "SUP.": "SUPERIOR",
  SUP: "SUPERIOR",
  "INF.": "INFERIOR",
  INF: "INFERIOR",
  "PAST.": "PASTILLAS",
  PAST: "PASTILLAS",
  "BOMB.": "BOMBA",
  BOMB: "BOMBA",
  "BUJ.": "BUJE",
  BUJ: "BUJE",
  "ROT.": "ROTULA",
  ROT: "ROTULA",
  "TERM.": "TERMINAL",
  TERM: "TERMINAL",
  "KIT.": "KIT",
  KIT: "KIT",
  "EMP.": "EMPACADURA",
  EMP: "EMPACADURA",
  "ESTOP.": "ESTOPERA",
  ESTOP: "ESTOPERA",
  "ROD.": "RODAMIENTO",
  ROD: "RODAMIENTO",
  "FILT.": "FILTRO",
  FILT: "FILTRO",
  "VALV.": "VALVULA",
  VALV: "VALVULA",
  "CHEV.": "CHEVROLET",
  CHEV: "CHEVROLET",
  CHEVY: "CHEVROLET",
  "TOY.": "TOYOTA",
  TOY: "TOYOTA",
  "MIT.": "MITSUBISHI",
  MIT: "MITSUBISHI",
  "HYU.": "HYUNDAI",
  HYU: "HYUNDAI",
  "FOR.": "FORD",
  FOR: "FORD",
  "MAZ.": "MAZDA",
  MAZ: "MAZDA",
  "REN.": "RENAULT",
  REN: "RENAULT",
  "CIL.": "CILINDRO",
  CIL: "CILINDRO",
  "MULT.": "MULTIPLE",
  MULT: "MULTIPLE",
  "CREM.": "CREMALLERA",
  CREM: "CREMALLERA",
  "SINCR.": "SINCRONICO",
  "SINC.": "SINCRONICO",
  SINCR: "SINCRONICO",
  "AUT.": "AUTOMATICO",
  "AUTOM.": "AUTOMATICO",
};

const PART_AND_POS_WORDS = new Set([
  "BASE", "SOPORTE", "CAJA", "AMORTIGUADOR", "BUJE", "MESETA", "PASTILLA", "PASTILLAS",
  "FRENO", "DISCO", "TAMBOR", "FILTRO", "ACEITE", "AIRE", "GASOLINA", "CABINA",
  "BOMBA", "AGUA", "DIRECCION", "EMBRAGUE", "CLUTCH", "CREMALLERA", "EMPACADURA",
  "ESTOPERA", "RODAMIENTO", "CUBO", "MOZO", "TERMINAL", "ROTULA", "BRAZO", "BIELA",
  "BIELETA", "LAPIZ", "BARRA", "ESTABILIZADORA", "GOMA", "PALANCA", "CAMBIO", "POMO",
  "FORRO", "GUAYA", "CABLE", "CORREA", "TIEMPO", "UNICA", "ACANALADA", "TENSOR",
  "POLEA", "VALVULA", "TERMOSTATO", "ENVASE", "DEPOSITO", "RADIADOR", "ELECTROVENTILADOR",
  "ASPAS", "FAN", "BOBINA", "BUJIA", "BUJIAS", "CABLES", "SENSOR", "OXIGENO", "INYECTOR",
  "CUERPO", "ACELERACION", "ALTERNADOR", "ARRANQUE", "BENDIX", "INDUCIDO", "PUENTE",
  "CARBONERA", "REGULADOR", "CONCHA", "BANCADA", "ANILLOS", "PISTON", "CAMISA", "ARBOL",
  "LEVA", "TAQUETE", "MARTILLO", "BALANCIN", "COLLARIN", "PLATO", "KIT", "SET", "JUEGO",
  "PAR", "COMPLETA", "COMPLETO", "DELANTERO", "DELANTERA", "TRASERO", "TRASERA",
  "IZQUIERDO", "IZQUIERDA", "DERECHO", "DERECHA", "SUPERIOR", "INFERIOR", "CENTRAL", "HUESITO",
]);

const VEHICLE_MAKES = new Set([
  "FORD", "CHEVROLET", "TOYOTA", "JEEP", "DODGE", "HYUNDAI", "KIA", "MITSUBISHI",
  "RENAULT", "NISSAN", "MAZDA", "HONDA", "VOLKSWAGEN", "VW", "CHERY", "FIAT",
  "PEUGEOT", "SUZUKI", "ISUZU", "DAEWOO", "CHRYSLER", "GMC", "MERCEDES", "BMW",
]);

const MODEL_TO_MAKE = {
  "F-150": "FORD", "F150": "FORD", "F-250": "FORD", "F250": "FORD", "F-350": "FORD", "F350": "FORD",
  "FIESTA": "FORD", "KA": "FORD", "ECOSPORT": "FORD", "EXPLORER": "FORD", "ESCAPE": "FORD",
  "FOCUS": "FORD", "RANGER": "FORD", "LASER": "FORD", "MUSTANG": "FORD", "BRONCO": "FORD",
  "FESTIVA": "FORD", "SIERRA": "FORD", "CORCEL": "FORD", "CONQUISTADOR": "FORD", "TRITON": "FORD",
  "AVEO": "CHEVROLET", "OPTRA": "CHEVROLET", "CORSA": "CHEVROLET", "SPARK": "CHEVROLET",
  "SILVERADO": "CHEVROLET", "TAHOE": "CHEVROLET", "CHEYENNE": "CHEVROLET", "BLAZER": "CHEVROLET",
  "TRAILBLAZER": "CHEVROLET", "CRUZE": "CHEVROLET", "EPICA": "CHEVROLET", "CAPTIVA": "CHEVROLET",
  "ESTEEM": "CHEVROLET", "SWIFT": "CHEVROLET", "VITARA": "CHEVROLET", "LUV": "CHEVROLET",
  "DMAX": "CHEVROLET", "D-MAX": "CHEVROLET", "NPR": "CHEVROLET", "NKR": "CHEVROLET",
  "NHR": "CHEVROLET", "KODIAK": "CHEVROLET", "MALIBU": "CHEVROLET", "CELEBRITY": "CHEVROLET",
  "CENTURY": "CHEVROLET", "CAPRICE": "CHEVROLET", "CAVALIER": "CHEVROLET", "MONTANA": "CHEVROLET",
  "MERIVA": "CHEVROLET", "ORLANDO": "CHEVROLET", "SONIC": "CHEVROLET", "REY": "CHEVROLET",
  "COROLLA": "TOYOTA", "YARIS": "TOYOTA", "CAMRY": "TOYOTA", "TERIOS": "TOYOTA", "STARLET": "TOYOTA",
  "HILUX": "TOYOTA", "KAVAK": "TOYOTA", "FORTUNER": "TOYOTA", "4RUNNER": "TOYOTA", "MERU": "TOYOTA",
  "PRADO": "TOYOTA", "AUTANA": "TOYOTA", "BURBUJA": "TOYOTA", "MACHITO": "TOYOTA", "SAMURAI": "TOYOTA",
  "TUNDRA": "TOYOTA", "TACOMA": "TOYOTA", "HIACE": "TOYOTA", "DYNA": "TOYOTA", "AVANZA": "TOYOTA",
  "CHEROKEE": "JEEP", "WAGONEER": "JEEP", "WRANGLER": "JEEP", "LIBERTY": "JEEP", "COMMANDER": "JEEP",
  "COMPASS": "JEEP", "PATRIOT": "JEEP", "RENEGADE": "JEEP", "CJ5": "JEEP", "CJ7": "JEEP",
  "XJ": "JEEP", "ZJ": "JEEP", "WJ": "JEEP", "WK": "JEEP", "WK2": "JEEP", "KJ": "JEEP", "KK": "JEEP",
  "NEON": "DODGE", "RAM": "DODGE", "DAKOTA": "DODGE", "DURANGO": "DODGE", "CALIBER": "DODGE",
  "CARAVAN": "DODGE", "STRATUS": "DODGE", "DART": "DODGE", "BRISA": "DODGE", "FORZA": "DODGE",
  "ACCENT": "HYUNDAI", "GETZ": "HYUNDAI", "ELANTRA": "HYUNDAI", "SONATA": "HYUNDAI",
  "TUCSON": "HYUNDAI", "ATOS": "HYUNDAI", "MATRIX": "HYUNDAI", "EXCEL": "HYUNDAI", "H1": "HYUNDAI", "H100": "HYUNDAI",
  "RIO": "KIA", "STYLUS": "KIA", "PICANTO": "KIA", "SPECTRA": "KIA", "CERATO": "KIA",
  "OPTIMA": "KIA", "SPORTAGE": "KIA", "SORENTO": "KIA", "CARNIVAL": "KIA", "PREGIO": "KIA",
  "LANCER": "MITSUBISHI", "SIGNO": "MITSUBISHI", "TOURING": "MITSUBISHI", "MIRAGE": "MITSUBISHI",
  "GALANT": "MITSUBISHI", "ECLIPSE": "MITSUBISHI", "MONTERO": "MITSUBISHI", "DAKAR": "MITSUBISHI",
  "NATIVA": "MITSUBISHI", "OUTLANDER": "MITSUBISHI", "ASX": "MITSUBISHI", "L200": "MITSUBISHI",
  "SPORTERO": "MITSUBISHI", "L300": "MITSUBISHI", "CANTER": "MITSUBISHI",
  "LOGAN": "RENAULT", "SYMBOL": "RENAULT", "CLIO": "RENAULT", "TWINGO": "RENAULT", "KANGOO": "RENAULT",
  "MEGANE": "RENAULT", "SCENIC": "RENAULT", "DUSTER": "RENAULT", "SANDERO": "RENAULT", "FLUENCE": "RENAULT",
  "SENTRA": "NISSAN", "B13": "NISSAN", "B14": "NISSAN", "B15": "NISSAN", "TIIDA": "NISSAN",
  "VERSA": "NISSAN", "ALMERA": "NISSAN", "MAXIMA": "NISSAN", "ALTIMA": "NISSAN", "PATHFINDER": "NISSAN",
  "PATROL": "NISSAN", "FRONTIER": "NISSAN", "D21": "NISSAN", "D22": "NISSAN", "NP300": "NISSAN", "X-TRAIL": "NISSAN",
  "ALLEGRO": "MAZDA", "323": "MAZDA", "626": "MAZDA", "DEMIO": "MAZDA", "BT-50": "MAZDA", "BT50": "MAZDA",
  "B2000": "MAZDA", "B2200": "MAZDA", "B2600": "MAZDA",
  "CIVIC": "HONDA", "ACCORD": "HONDA", "FIT": "HONDA", "CR-V": "HONDA", "CRV": "HONDA", "PILOT": "HONDA", "ODYSSEY": "HONDA",
  "GOL": "VOLKSWAGEN", "PARATI": "VOLKSWAGEN", "SAVEIRO": "VOLKSWAGEN", "FOX": "VOLKSWAGEN",
  "SPACEFOX": "VOLKSWAGEN", "CROSSFOX": "VOLKSWAGEN", "POLO": "VOLKSWAGEN", "BORA": "VOLKSWAGEN",
  "JETTA": "VOLKSWAGEN", "GOLF": "VOLKSWAGEN", "PASSAT": "VOLKSWAGEN", "AMAROK": "VOLKSWAGEN",
  "ARAUCA": "CHERY", "ORINOCO": "CHERY", "TIGGO": "CHERY", "QQ": "CHERY", "X1": "CHERY",
  "PALIO": "FIAT", "SIENA": "FIAT", "UNO": "FIAT", "PREMIO": "FIAT", "FIORINO": "FIAT", "STRADA": "FIAT",
};

const SPEC_WORDS = new Set([
  "SYNCRO", "SINCRONICO", "AUTOMATICO", "AUTOMATICA", "4X4", "4X2", "2WD", "4WD", "AWD",
  "8V", "12V", "16V", "24V", "V6", "V8", "L4", "L6", "OHV", "SOHC", "DOHC", "ZETEC", "ROCAM", "DURATEC", "VORTEC",
  "300", "302", "351", "258", "262", "242", "350", "318", "360",
]);

export function isYearToken(w = "") {
  const clean = String(w).trim();
  if (/^(19[5-9]\d|20[0-2]\d)(-(19[5-9]\d|20[0-2]\d))?$/.test(clean)) return true;
  const m = clean.match(/^(\d{2})-(\d{2})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const valid2DigitYear = (y) => (y >= 60 && y <= 99) || (y >= 0 && y <= 27);
    return valid2DigitYear(a) && valid2DigitYear(b);
  }
  return false;
}

function isSpecToken(w = "") {
  const upper = String(w).trim().toUpperCase();
  if (SPEC_WORDS.has(upper)) return true;
  if (/^\d+\.\d+L?$/.test(upper)) return true; // 1.6, 2.0, 4.6, 3.5L
  if (/^[VL]\d{1,2}$/.test(upper)) return true; // V6, V8, L6
  if (/^\d{1,2}V$/.test(upper)) return true; // 8V, 16V
  return false;
}

/**
 * Estructurador Canónico de Títulos SEO para Autopartes (Mercado Libre Gold Pro):
 * Fórmula: [Repuesto + Posición] + [Marca Vehículo] + [Modelos] + [Motor / Specs] + [Años]
 * - Elimina barras `/`, paréntesis y duplicados (ej. `94-96` repetido o `1.6` repetido).
 * - Infiere automáticamente la marca del vehículo (`Ford`, `Chevrolet`, `Toyota`, `Jeep`, etc.) y la coloca antes del modelo.
 * - Si se proveen `extraKeywords` de la competencia, las inserta en su bucket semántico correspondiente (antes de los años) sin superar 60 caracteres.
 */
export function optimizeAutomotiveSEOTitle(rawTitle, { extraKeywords = [], vehicleBrand = "" } = {}) {
  if (!rawTitle) return "";
  let text = String(rawTitle).toUpperCase();

  const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
  const escapedKeys = sortedKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escapedKeys.join("|")})(?=\\.|\\s|/|$)`, "gi");

  text = text.replace(regex, (matched) => {
    const upperMatched = matched.toUpperCase();
    return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + "."] || matched;
  });

  text = text
    .replace(/[,()/\\]/g, " ")
    .replace(/\.([A-Z])/g, " $1")
    .replace(/(?<!\d)\.|(\.(?!\d))/g, " ")
    .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL|EN|Y|POR|AL)\b/gi, " ")
    .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = text.split(" ").filter(Boolean);
  const seenNorm = new Set();
  const uniqueTokens = [];

  for (const tok of rawTokens) {
    const norm = tok.replace(/[^A-Z0-9.]/gi, "").toUpperCase();
    if (!norm || seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    uniqueTokens.push(tok);
  }

  const partBucket = [];
  const makeBucket = [];
  const modelBucket = [];
  const specBucket = [];
  const yearBucket = [];

  let stillInPartPrefix = true;

  for (let i = 0; i < uniqueTokens.length; i++) {
    const tok = uniqueTokens[i];
    const upper = tok.toUpperCase();

    if (VEHICLE_MAKES.has(upper)) {
      stillInPartPrefix = false;
      makeBucket.push(upper === "VW" ? "VOLKSWAGEN" : upper);
      continue;
    }

    if (isYearToken(upper)) {
      stillInPartPrefix = false;
      yearBucket.push(upper);
      continue;
    }

    if (isSpecToken(upper)) {
      stillInPartPrefix = false;
      specBucket.push(upper);
      continue;
    }

    if (PART_AND_POS_WORDS.has(upper) || (stillInPartPrefix && i === 0)) {
      // Si la palabra es "MOTOR" y ya tenemos una pieza (ej. "BASE CAJA"), "MOTOR" es especificación o parte secundaria
      if (upper === "MOTOR" && partBucket.length >= 2 && !stillInPartPrefix) {
        specBucket.push(upper);
      } else {
        partBucket.push(upper);
      }
      continue;
    }

    stillInPartPrefix = false;
    modelBucket.push(upper);
  }

  // Inferir Marca del Vehículo si aún no está en makeBucket
  if (makeBucket.length === 0) {
    const cleanVehBrand = String(vehicleBrand || "").trim().toUpperCase();
    if (cleanVehBrand && VEHICLE_MAKES.has(cleanVehBrand)) {
      makeBucket.push(cleanVehBrand);
    } else {
      for (const m of modelBucket) {
        if (MODEL_TO_MAKE[m]) {
          makeBucket.push(MODEL_TO_MAKE[m]);
          break;
        }
      }
    }
  }

  for (const mk of makeBucket) {
    seenNorm.add(mk.replace(/[^A-Z0-9.]/gi, "").toUpperCase());
  }

  const toTitleCase = (str) =>
    str
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase())
      .replace(/\b(V6|V8|L4|L6|8v|12v|16v|24v|4x4|4x2|2wd|4wd|Awd|Wk|Wk2|Xj|Zj|Wj|Kj|Kk|Cj5|Cj7|B13|B14|B15|D21|D22|Np300|Bt-50|Bt50|Cr-V|Crv)\b/gi, (m) => m.toUpperCase());

  const buildCandidate = () => {
    const all = [...partBucket, ...makeBucket, ...modelBucket, ...specBucket, ...yearBucket];
    return toTitleCase(all.join(" ")).replace(/\s+/g, " ").trim();
  };

  let currentTitle = buildCandidate();

  // Si sobran caracteres hasta 60, integrar keywords valiosas de la competencia en el bucket correcto
  if (Array.isArray(extraKeywords) && extraKeywords.length > 0) {
    for (const rawKw of extraKeywords) {
      const kw = String(rawKw || "").trim().toUpperCase().replace(/^[-/]+|[-/]+$/g, "");
      if (!kw || kw.length < 2) continue;
      // NUNCA copiar años de la competencia ni barras
      if (isYearToken(kw) || kw.includes("/")) continue;
      const norm = kw.replace(/[^A-Z0-9.]/gi, "");
      if (!norm || seenNorm.has(norm)) continue;
      // No agregar otra marca de vehículo distinta si ya tenemos una
      if (VEHICLE_MAKES.has(kw) && makeBucket.length > 0) continue;

      // Probar insertar en el bucket semántico apropiado
      let targetBucket = modelBucket;
      if (VEHICLE_MAKES.has(kw)) targetBucket = makeBucket;
      else if (isSpecToken(kw) || kw === "MOTOR") targetBucket = specBucket;
      else if (PART_AND_POS_WORDS.has(kw)) targetBucket = partBucket;

      targetBucket.push(kw);
      const testTitle = buildCandidate();
      if (testTitle.length <= 60) {
        seenNorm.add(norm);
        currentTitle = testTitle;
      } else {
        targetBucket.pop();
      }
    }
  }

  if (currentTitle.length > 60) {
    let truncated = currentTitle.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 40) truncated = truncated.substring(0, lastSpace);
    return truncated.trim();
  }

  return currentTitle;
}

export function formatSEOTitle(rawTitle, options = {}) {
  return optimizeAutomotiveSEOTitle(rawTitle, options);
}

export function matchLocalPhotoFiles(
  sku,
  localFiles,
  maxPhotos = 6,
  { equivalencias = [], oem = "", explicitPhotos = [] } = {}
) {
  if (!localFiles?.length && !explicitPhotos?.length) return [];

  if (Array.isArray(explicitPhotos) && explicitPhotos.length > 0) {
    return explicitPhotos.slice(0, maxPhotos);
  }

  const candidateCodes = new Set();
  if (sku) candidateCodes.add(String(sku).trim().toLowerCase());
  if (Array.isArray(equivalencias)) {
    for (const eq of equivalencias) {
      if (eq) candidateCodes.add(String(eq).trim().toLowerCase());
    }
  }
  if (oem) {
    for (const part of String(oem).split(/[,;/]+/)) {
      const clean = part.trim().toLowerCase();
      if (clean) candidateCodes.add(clean);
    }
  }

  if (candidateCodes.size === 0) return [];

  return localFiles
    .filter((f) => {
      const base = f.split(".")[0].toLowerCase();
      if (candidateCodes.has(base)) return true;
      const lastDashIndex = base.lastIndexOf("-");
      if (lastDashIndex !== -1) {
        const prefix = base.substring(0, lastDashIndex);
        const suffix = base.substring(lastDashIndex + 1);
        return candidateCodes.has(prefix) && /^\d+$/.test(suffix);
      }
      return false;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, maxPhotos);
}

export async function getImageBankPictures(supabaseAdmin, sku) {
  const { data, error } = await supabaseAdmin
    .from("image_bank")
    .select("ml_picture_id, ml_url")
    .eq("sku", sku)
    .eq("sync_status", "synced")
    .order("image_index", { ascending: true });

  if (error || !data?.length) return [];

  return data
    .map((p) => {
      if (p.ml_picture_id) return { id: p.ml_picture_id };
      if (p.ml_url) return { source: p.ml_url };
      return null;
    })
    .filter(Boolean);
}

export async function loadAvailablePhotoFiles(effectivePhotosPath = "") {
  if (effectivePhotosPath && fs.existsSync(effectivePhotosPath)) {
    try {
      const files = fs.readdirSync(effectivePhotosPath);
      if (files.length > 0) return files;
    } catch {
      // fallback to bridge
    }
  }
  const bridgeUrl = process.env.PHOTO_BRIDGE_URL || "http://192.168.1.97:8088";
  try {
    const res = await fetch(`${bridgeUrl}/list`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files)) return data.files;
    }
  } catch {
    // Bridge no disponible
  }
  return [];
}

async function readPhotoBuffer(photosPath, fileName) {
  if (photosPath && fs.existsSync(photosPath)) {
    const filePath = path.join(photosPath, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  }
  const bridgeUrl = process.env.PHOTO_BRIDGE_URL || "http://192.168.1.97:8088";
  const res = await fetch(`${bridgeUrl}/file?name=${encodeURIComponent(fileName)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (res.ok) {
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  return null;
}

export async function uploadLocalPictures({
  sku,
  equivalencias = [],
  oem = "",
  explicitPhotos = [],
  photosPath,
  localFiles,
  accessToken,
  maxPhotos = 6,
}) {
  const matchingFiles = matchLocalPhotoFiles(sku, localFiles, maxPhotos, {
    equivalencias,
    oem,
    explicitPhotos,
  });
  const payloads = [];

  for (const fileName of matchingFiles) {
    try {
      const rawBuffer = await readPhotoBuffer(photosPath, fileName);
      if (!rawBuffer) continue;
      const buffer = await optimizeAutopartPhotoBuffer(rawBuffer);
      const picRes = await uploadPicture(buffer, fileName, accessToken);
      if (picRes?.id) payloads.push({ id: picRes.id });
    } catch (uploadErr) {
      try {
        const rawBuffer = await readPhotoBuffer(photosPath, fileName);
        if (!rawBuffer) continue;
        const buffer = await optimizeAutopartPhotoBuffer(rawBuffer);
        const publicUrl = await uploadImageToStorage(buffer, fileName);
        if (publicUrl) payloads.push({ source: publicUrl });
      } catch {
        console.warn(`⚠️ Falló subida local para ${fileName}:`, uploadErr.message);
      }
    }
  }

  return { payloads, matchingFiles };
}

/**
 * Resuelve fotos según prioridad:
 * - preferLocalPhotos=false (default): Image Bank → disco local → placeholder
 * - preferLocalPhotos=true: disco local → Image Bank → placeholder
 */
export async function resolvePicturesForSku({
  supabaseAdmin,
  sku,
  equivalencias = [],
  oem = "",
  explicitPhotos = [],
  photosPath,
  localFiles,
  accessToken,
  usePlaceholderIfNoPhoto = true,
  preferLocalPhotos = false,
  maxPhotos = 6,
}) {
  const tryImageBank = async () => {
    const bankPictures = await getImageBankPictures(supabaseAdmin, sku);
    if (bankPictures.length > 0) {
      return {
        picturePayloads: bankPictures.slice(0, maxPhotos),
        photoSource: "image_bank",
        hasRealPhoto: true,
      };
    }
    return null;
  };

  const tryLocalDisk = async () => {
    if (localFiles?.length || explicitPhotos?.length) {
      const { payloads, matchingFiles } = await uploadLocalPictures({
        sku,
        equivalencias,
        oem,
        explicitPhotos,
        photosPath,
        localFiles,
        accessToken,
        maxPhotos,
      });
      if (payloads.length > 0) {
        return {
          picturePayloads: payloads,
          photoSource: "local",
          hasRealPhoto: true,
          matchingFiles,
        };
      }
    }
    return null;
  };

  const resolvers = preferLocalPhotos
    ? [tryLocalDisk, tryImageBank]
    : [tryImageBank, tryLocalDisk];

  for (const resolve of resolvers) {
    const result = await resolve();
    if (result) return result;
  }

  if (usePlaceholderIfNoPhoto) {
    if (accessToken) {
      try {
        if (!cachedPlaceholderPicId) {
          const svg = `<svg width="1500" height="1500" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#ffffff"/>
            <rect x="75" y="75" width="1350" height="1350" rx="50" fill="#0f172a"/>
            <text x="750" y="700" font-family="Arial, sans-serif" font-size="90" font-weight="bold" fill="#ffffff" text-anchor="middle">WORLD CARS</text>
            <text x="750" y="820" font-family="Arial, sans-serif" font-size="52" fill="#38bdf8" text-anchor="middle">TIENDA OFICIAL REPUESTOS</text>
          </svg>`;
          const phBuf = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
          const up = await uploadPicture(phBuf, "placeholder-worldcars.jpg", accessToken);
          if (up?.id) cachedPlaceholderPicId = up.id;
        }
        if (cachedPlaceholderPicId) {
          return {
            picturePayloads: [{ id: cachedPlaceholderPicId }],
            photoSource: "placeholder",
            hasRealPhoto: false,
          };
        }
      } catch {
        // fallback to URL
      }
    }
    return {
      picturePayloads: [{ source: OFFICIAL_STORE_PLACEHOLDER }],
      photoSource: "placeholder",
      hasRealPhoto: false,
    };
  }

  return { picturePayloads: [], photoSource: "none", hasRealPhoto: false };
}

/**
 * Inserta foto de vehículo en posición 2 (índice 1). Máximo 6 fotos.
 */
export function injectVehiclePhoto(pictures, vehiclePicture) {
  if (!vehiclePicture || !pictures?.length) return pictures || [];

  const key = vehiclePicture.id || vehiclePicture.source;
  if (key && pictures.some((p) => (p.id || p.source) === key)) {
    return pictures.slice(0, 6);
  }

  const result = [...pictures];
  const insertAt = Math.min(1, result.length);
  result.splice(insertAt, 0, vehiclePicture);
  return result.slice(0, 6);
}

const categoryNameCache = new Map();

export async function getCategoryDisplayName(categoryId) {
  if (!categoryId) return null;
  if (categoryNameCache.has(categoryId)) return categoryNameCache.get(categoryId);
  try {
    const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const pathStr = Array.isArray(data.path_from_root)
        ? data.path_from_root.map((p) => p.name).join(" > ")
        : data.name;
      const info = { name: data.name || categoryId, path: pathStr || data.name || categoryId };
      categoryNameCache.set(categoryId, info);
      return info;
    }
  } catch {
    // ignore
  }
  return { name: categoryId, path: categoryId };
}

// Caché de validación de categorías: id -> { valid, reason, pathIds }
const categoryValidityCache = new Map();
// Caché de categorías corregidas por sublínea (evita repetir domain_discovery en lotes)
const healedSublineCategoryCache = new Map();

const MELI_VEHICLE_ACCESSORIES_ROOT = "MLV1747"; // Accesorios para Vehículos
const MELI_CAR_PARTS_ROOT = "MLV1748"; // Repuestos Carros y Camionetas

/**
 * Verifica que una categoría de ML exista, sea hoja (sin hijas) y permita publicar.
 * Las categorías de ML se eliminan/reorganizan con el tiempo; un mapeo viejo produce
 * "Category MLVxxxx does not exist" al publicar.
 */
export async function validateMeliCategory(categoryId) {
  if (!categoryId) return { valid: false, reason: "empty", pathIds: [] };
  if (categoryValidityCache.has(categoryId)) return categoryValidityCache.get(categoryId);

  let result = { valid: false, reason: "unknown", pathIds: [] };
  try {
    const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      result = { valid: false, reason: "not_found", pathIds: [] };
    } else if (!res.ok) {
      // Error transitorio de ML: no bloquear la publicación por esto
      return { valid: true, reason: `unverified_${res.status}`, pathIds: [] };
    } else {
      const data = await res.json();
      const isLeaf = !data.children_categories || data.children_categories.length === 0;
      const listingAllowed = data.settings?.listing_allowed !== false;
      const pathIds = (data.path_from_root || []).map((p) => p.id);
      result = isLeaf && listingAllowed
        ? { valid: true, reason: "ok", pathIds }
        : { valid: false, reason: !isLeaf ? "not_leaf" : "listing_not_allowed", pathIds };
    }
  } catch {
    // Timeout/red: no bloquear
    return { valid: true, reason: "unverified_network", pathIds: [] };
  }

  categoryValidityCache.set(categoryId, result);
  return result;
}

// Sinónimos que ML entiende mejor en su predictor (términos venezolanos -> términos del catálogo ML)
const CATEGORY_QUERY_SYNONYMS = [
  [/\bENVASES?\b/gi, "DEPOSITO REFRIGERANTE"],
  [/\bGUAYAS?\b/gi, "CABLE"],
  [/\bBALLESTAS?\b/gi, "MUELLE BALLESTA SUSPENSION"],
  [/\bCONCHAS?\b/gi, "COJINETE"],
  [/\bESTOPERAS?\b/gi, "RETEN"],
  [/\bEMPACADURAS?\b/gi, "JUNTA"],
  [/\bCRUCETAS?\b/gi, "CRUCETA CARDAN"],
  [/\bTRIPOIDES?\b/gi, "TRIPOIDE HOMOCINETICA"],
  [/\bMESETAS?\b/gi, "BRAZO SUSPENSION"],
];

function expandCategoryQuery(q = "") {
  let out = String(q);
  for (const [re, rep] of CATEGORY_QUERY_SYNONYMS) out = out.replace(re, rep);
  return out;
}

async function predictValidCategory(query) {
  if (!query) return null;
  const queries = [...new Set([expandCategoryQuery(query), query, `${expandCategoryQuery(query)} repuesto carro`])];

  let fallbackInVehicleTree = null;
  for (const q of queries) {
    try {
      const res = await fetch(
        `${MELI_BASE_URL}/sites/MLV/domain_discovery/search?limit=8&q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      if (!Array.isArray(data)) continue;
      for (const cand of data) {
        if (!cand?.category_id) continue;
        const check = await validateMeliCategory(cand.category_id);
        if (!check.valid) continue;
        // Preferir "Repuestos Carros y Camionetas"; aceptar "Accesorios para Vehículos" como respaldo.
        // Descartar categorías fuera del árbol automotriz (ej. Peluquería, Caza, Hogar).
        if (check.pathIds.includes(MELI_CAR_PARTS_ROOT)) return cand.category_id;
        if (!fallbackInVehicleTree && check.pathIds.includes(MELI_VEHICLE_ACCESSORIES_ROOT)) {
          fallbackInVehicleTree = cand.category_id;
        }
      }
    } catch (e) {
      console.warn("Error prediciendo categoría:", e.message);
    }
  }
  return fallbackInVehicleTree;
}

// Mapeos canónicos para autopartes que ML confunde en domain_discovery o cuyas categorías históricas fueron reorganizadas
const CANONICAL_AUTOPART_CATEGORIES = [
  // Ballestas y resortes (ML domain discovery confunde "ballesta" con ballestas de caza)
  { match: /\b(HOJAS?\s+DE\s+)?BALLESTAS?\b/i, categoryId: "MLV458152" }, // Suspensión > Resortes y Barras > Ballestas
  { match: /\b(COLGANTE\s+DE\s+BALLESTA|GEMELOS?)\b/i, categoryId: "MLV458150" }, // Grilletes de Ballesta
  // Sistema de Enfriamiento / Radiador (reemplaza MLV122602 eliminada por ML)
  { match: /\b(ENVASES?\s+(DE\s+)?(RADIADOR|REFRIGERANTE|AGUA)|DEPOSITO\s+(DE\s+)?(AGUA|REFRIGERANTE|LIQUIDO))\b/i, categoryId: "MLV373330" }, // Depósito Líquido Refrigerante
  { match: /\b(MANGUERAS?\s+(DE\s+)?RADIADOR)\b/i, categoryId: "MLV373331" }, // Mangueras de Radiador
  { match: /\b(TAPAS?\s+(DE\s+)?RADIADOR)\b/i, categoryId: "MLV373334" }, // Tapas de Radiadores
  { match: /\bRADIADOR(ES)?(\s+DE\s+AGUA)?\b/i, categoryId: "MLV373327" }, // Radiadores de Agua
  // Frenos
  { match: /\bMANGUERAS?\s+(DE\s+)?FRENO\b/i, categoryId: "MLV412187" }, // Mangueras de Frenos
  // Dirección
  { match: /\bMANGUERAS?\s+(DE\s+)?DIRECCION(\s+HIDRAULICA)?\b/i, categoryId: "MLV373422" }, // Mangueras Dirección Hidráulica
  { match: /\bBARRA\s+CENTRAL(\s+Y\s+DE\s+DIRECCION)?\b/i, categoryId: "MLV458162" }, // Barras Centrales de Dirección
];

export async function resolveCategoryId(supabaseAdmin, { subline, title, settings }) {
  let categoryId = null;
  let source = null;

  if (subline) {
    const { data: mapping } = await supabaseAdmin
      .from("category_mappings")
      .select("ml_category_id")
      .ilike("internal_name", subline)
      .limit(1)
      .single();

    if (mapping?.ml_category_id) {
      categoryId = mapping.ml_category_id;
      source = "category_mappings";
    }
  }

  if (!categoryId && settings?.categoryMap?.[subline]) {
    categoryId = settings.categoryMap[subline];
    source = "erp_settings";
  }

  // Validar el mapeo: si la categoría fue eliminada o no es hoja, auto-corregir
  if (categoryId) {
    const check = await validateMeliCategory(categoryId);
    if (!check.valid) {
      console.warn(
        `⚠️ [categorías] ${categoryId} (${source}, sublínea "${subline}") inválida: ${check.reason}. Re-prediciendo...`
      );
      categoryId = null;
    }
  }

  // Comprobar reglas canónicas de autopartes (evita desvíos del predictor y resuelve categorías obsoletas)
  if (!categoryId) {
    const probe = `${subline || ""} ${title || ""}`.trim();
    for (const rule of CANONICAL_AUTOPART_CATEGORIES) {
      if (rule.match.test(probe)) {
        categoryId = rule.categoryId;
        source = "canonical_autoparts_rule";
        break;
      }
    }
  }

  if (!categoryId && title) {
    categoryId = await predictValidCategory(title);
  }

  // Último recurso: predecir con la sublínea (cacheado por sublínea)
  if (!categoryId && subline) {
    const key = String(subline).toUpperCase();
    if (healedSublineCategoryCache.has(key)) {
      categoryId = healedSublineCategoryCache.get(key);
    } else {
      categoryId = await predictValidCategory(subline);
      if (categoryId) healedSublineCategoryCache.set(key, categoryId);
    }
  }

  return categoryId;
}

function inferPositionFromText(text = "") {
  const upper = String(text).toUpperCase();
  if (upper.includes("DELANTER") && upper.includes("IZQ")) return "Delantera izquierda";
  if (upper.includes("DELANTER") && upper.includes("DER")) return "Delantera derecha";
  if (upper.includes("TRASER") && upper.includes("IZQ")) return "Trasera izquierda";
  if (upper.includes("TRASER") && upper.includes("DER")) return "Trasera derecha";
  if (upper.includes("DELANTER")) return "Delantera";
  if (upper.includes("TRASER")) return "Trasera";
  if (upper.includes("IZQUIERD") || upper.includes(" IZQ")) return "Izquierda";
  if (upper.includes("DERECH") || upper.includes(" DER")) return "Derecha";
  if (upper.includes("SUPERIOR") || upper.includes(" SUP")) return "Superior";
  if (upper.includes("INFERIOR") || upper.includes(" INF")) return "Inferior";
  if (upper.includes("CAJA")) return "Trasera";
  if (upper.includes("MOTOR")) return "Delantera";
  return "Inferior";
}

function inferDefaultAttributeValue(attr, { sku, oem, brand, title = "", subline = "" }) {
  const name = (attr.name || "").toLowerCase();
  const id = attr.id || "";
  const isRequired = Boolean(attr?.tags?.required || attr?.tags?.catalog_required);
  const combinedText = `${title} ${subline}`.toUpperCase();

  if (id === "BRAND") return brand || "Genérico";
  if (id === "PART_NUMBER") return sku || oem || "S/N";
  if (id === "OEM") return oem || sku || "S/N";
  if (id === "SELLER_SKU") return sku;

  // Si tiene lista cerrada o sugerida de valores predefinidos en la categoría de ML, SIEMPRE usar un value_id válido de esa lista
  if (attr.values?.length > 0) {
    if (id === "VEHICLE_TYPE" || name.includes("vehículo") || name.includes("vehiculo")) {
      const match = attr.values.find((v) => {
        const vn = (v.name || "").toLowerCase();
        return vn.includes("carro") || vn.includes("auto") || vn.includes("camioneta");
      }) || attr.values[0];
      return { value_id: match.id, value_name: match.name };
    }
    if (id === "ITEM_CONDITION" || name.includes("condición") || name.includes("condicion")) {
      const match = attr.values.find((v) => (v.name || "").toLowerCase().includes("nuevo")) || attr.values[0];
      return { value_id: match.id, value_name: match.name };
    }
    if (id === "COLOR" || name === "color") {
      const match = attr.values.find((v) => (v.name || "").toLowerCase() === "negro") || attr.values[0];
      return { value_id: match.id, value_name: match.name };
    }
    if (id === "IS_OEM") {
      const target = oem ? "sí" : "no";
      const match = attr.values.find((v) => {
        const vn = (v.name || "").toLowerCase();
        return vn === target || vn === (oem ? "si" : "no");
      }) || attr.values[0];
      return { value_id: match.id, value_name: match.name };
    }
    if (
      id === "INCLUDES_MOUNTING_ACCESSORIES" ||
      id === "MOUNTING_HARDWARE_INCLUDED" ||
      id === "IS_KIT"
    ) {
      const wantYes = combinedText.includes("KIT");
      const match = attr.values.find((v) => {
        const vn = (v.name || "").toLowerCase();
        return wantYes ? vn.startsWith("s") : vn === "no";
      });
      if (match) return { value_id: match.id, value_name: match.name };
    }
    if (id === "MOUNTING_BRACKET_INCLUDED") {
      const wantYes = combinedText.includes("BASE") || combinedText.includes("SOPORTE");
      const match = attr.values.find((v) => {
        const vn = (v.name || "").toLowerCase();
        return wantYes ? vn.startsWith("s") : vn === "no";
      });
      if (match) return { value_id: match.id, value_name: match.name };
    }
    if (id === "BRACKET_MATERIAL" || id === "MATERIAL" || name.includes("material")) {
      const match =
        attr.values.find((v) => (v.name || "").toLowerCase().includes("acero")) ||
        attr.values.find((v) => (v.name || "").toLowerCase().includes("metal")) ||
        attr.values[0];
      if (match) return { value_id: match.id, value_name: match.name };
    }
    if (id === "FINISH" || name.includes("acabado")) {
      const match =
        attr.values.find((v) => (v.name || "").toLowerCase() === "mate") ||
        attr.values[0];
      if (match) return { value_id: match.id, value_name: match.name };
    }
    if (id === "MOUNTING_POSITION" || (id === "POSITION" && isRequired) || name.includes("posición de montaje")) {
      const posGuess = inferPositionFromText(combinedText).toLowerCase();
      const match =
        attr.values.find((v) => (v.name || "").toLowerCase() === posGuess) ||
        attr.values.find((v) => (v.name || "").toLowerCase().includes(posGuess)) ||
        (id === "MOUNTING_POSITION"
          ? attr.values.find((v) => (v.name || "").toLowerCase() === "inferior") || attr.values[0]
          : null);
      if (match) return { value_id: match.id, value_name: match.name };
      return null;
    }
    if (isRequired) {
      const first = attr.values.find((v) => v.name) || attr.values[0];
      return { value_id: first.id, value_name: first.name };
    }
    // Si tiene valores predefinidos en ML y no coincidió con ninguno (y no es obligatorio), no inventar texto libre
    return null;
  }

  // Si el atributo en ML es de tipo list (cerrado) y no encontramos un value_id válido arriba, no enviar texto libre
  if (attr.value_type === "list" && !isRequired) {
    return null;
  }

  // Si el atributo exige número + unidad (ej. THICKNESS = "10 mm"), nunca enviar texto como "Estándar"
  if (attr.value_type === "number_unit") {
    if (!isRequired) return null;
    const defaultUnit = attr.default_unit || attr.allowed_units?.[0]?.id || "mm";
    return `1 ${defaultUnit}`;
  }
  if (attr.value_type === "number") {
    return isRequired ? "1" : null;
  }

  // Atributos abiertos o semi-abiertos (principales y secundarios de autopartes)
  if (id === "POSITION") return null; // En autopartes ML suele ser read_only o list cerrado
  if (id === "VEHICLE_TYPE" || name.includes("vehículo") || name.includes("vehiculo")) {
    return { value_id: "11377043", value_name: "Carro/Camioneta" };
  }
  if (id === "ITEM_CONDITION" || name.includes("condición") || name.includes("condicion")) {
    return { value_id: "2230284", value_name: "Nuevo" };
  }
  if (id === "ORIGIN" || name.includes("origen")) return "Importado";
  if (id === "COLOR" || name === "color") return "Negro";
  if (id === "FINISH" || name.includes("acabado")) return "Mate";
  if (id === "BRACKET_MATERIAL" || id === "MATERIAL" || name.includes("material")) {
    if (combinedText.includes("BASE") || combinedText.includes("BUJE") || combinedText.includes("SOPORTE")) {
      return "Metal / Goma";
    }
    return "Acero / Estándar";
  }
  if (id === "MOUNTING_POSITION") {
    return inferPositionFromText(combinedText);
  }
  if (id === "MOUNTING_BRACKET_INCLUDED") {
    return combinedText.includes("BASE") || combinedText.includes("SOPORTE") ? "Sí" : "No";
  }
  if (id === "MOUNTING_HARDWARE_INCLUDED" || id === "INCLUDES_MOUNTING_ACCESSORIES") {
    return combinedText.includes("KIT") ? "Sí" : "No";
  }
  if (id === "BOLT_HOLE_NUMBER" || id === "MOUNTING_HOLES_NUMBER") return "2";
  if (id === "MODEL") return title ? title.split(" ").slice(0, 4).join(" ") : (sku || "Estándar");
  if (id === "UNITS_PER_PACKAGE") return "1";
  if (id === "IS_OEM") return oem ? "Sí" : "No";
  if (id === "UNIT_VOLUME" || name.includes("volumen")) return "1 L";
  if (id === "UNIT_WEIGHT" || name.includes("peso")) return "1 kg";
  if (id === "SALE_FORMAT" || name.includes("formato de venta")) return "Unidad";

  return isRequired ? "Genérico" : null;
}

export function sanitizeOemString(rawOem, fallbackSku = "") {
  const raw = rawOem ? String(rawOem).trim() : String(fallbackSku || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/[,;/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seenAlphaNum = new Set();
  const unique = [];
  for (const p of parts) {
    const key = p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!key || seenAlphaNum.has(key)) continue;
    seenAlphaNum.add(key);
    unique.push(p);
  }
  return unique.slice(0, 4).join(", ") || raw;
}

export function buildDynamicAttributes({
  requiredAttributes = [],
  sku,
  brand,
  oem,
  title = "",
  subline = "",
  extraAttrs = [],
}) {
  const effectiveBrand = brand && brand !== "Original" ? brand : (brand || "Genérico");
  const cleanOem = sanitizeOemString(oem, sku);

  const allowedMap = new Map((requiredAttributes || []).map((a) => [a.id, a]));
  const CORE_ALWAYS_ALLOWED = new Set([
    "SELLER_SKU",
    "BRAND",
    "PART_NUMBER",
    "OEM",
    "EMPTY_GTIN_REASON",
    "VEHICLE_TYPE",
    "ITEM_CONDITION",
  ]);

  const dynamicAttributes = [
    { id: "SELLER_SKU", value_name: sku },
    { id: "BRAND", value_name: effectiveBrand },
    { id: "PART_NUMBER", value_name: sku || cleanOem },
  ];

  if (cleanOem) {
    dynamicAttributes.push({ id: "OEM", value_name: cleanOem });
  }

  for (const at of extraAttrs) {
    if (at?.id && at?.value_name && !dynamicAttributes.find((a) => a.id === at.id)) {
      // No sobreescribir nuestra marca, SKU ni número de pieza, ni copiar atributos problemáticos
      if (["BRAND", "PART_NUMBER", "SELLER_SKU", "OEM", "GTIN", "POSITION", "THICKNESS"].includes(at.id)) continue;
      if (at.id.startsWith("SELLER_PACKAGE_")) continue;

      // Si tenemos el esquema de la categoría, validar que el atributo exista y sea modificable en esta categoría
      if (allowedMap.size > 0 && !allowedMap.has(at.id) && !CORE_ALWAYS_ALLOWED.has(at.id)) {
        continue;
      }

      const catAttr = allowedMap.get(at.id);
      if (catAttr) {
        if (catAttr.tags?.read_only) continue;
        // Validar number_unit (debe empezar por número + unidad)
        if (catAttr.value_type === "number_unit" && !/^\d+(\.\d+)?\s+\S+/.test(String(at.value_name).trim())) {
          continue;
        }
        // Si es de tipo list o tiene valores predefinidos y no trae value_id válido, buscarlo en catAttr.values
        if ((!at.value_id || at.value_id === "-1") && catAttr.values?.length > 0) {
          const matchedVal = catAttr.values.find(
            (v) => (v.name || "").toLowerCase() === String(at.value_name).trim().toLowerCase()
          );
          if (matchedVal) {
            dynamicAttributes.push({
              id: at.id,
              value_id: matchedVal.id,
              value_name: matchedVal.name,
            });
            continue;
          } else if (catAttr.value_type === "list") {
            // Lista cerrada sin coincidencia de value_id -> omitir para evitar error 3510 en ML
            continue;
          }
        }
      }

      const item = { id: at.id, value_name: at.value_name };
      if (at.value_id && at.value_id !== "-1") item.value_id = at.value_id;
      dynamicAttributes.push(item);
    }
  }

  for (const attr of requiredAttributes) {
    if (attr?.tags?.read_only) continue;
    if (!dynamicAttributes.find((a) => a.id === attr.id)) {
      const inferred = inferDefaultAttributeValue(attr, {
        sku,
        oem: cleanOem,
        brand: effectiveBrand,
        title,
        subline,
      });
      if (inferred === null || inferred === undefined) continue;
      if (typeof inferred === "object" && inferred !== null) {
        dynamicAttributes.push({
          id: attr.id,
          value_id: inferred.value_id,
          value_name: inferred.value_name,
        });
      } else {
        dynamicAttributes.push({
          id: attr.id,
          value_name: String(inferred),
        });
      }
    }
  }

  return dynamicAttributes;
}

/**
 * Carga SKUs ya publicados (activos/pausados) para evitar duplicados en lote.
 */
export async function loadPublishedSkuSet(supabaseAdmin, accountId, skus) {
  const original = [...new Set(skus.map((s) => String(s || "").trim()).filter(Boolean))];
  if (!original.length) return new Set();

  const published = new Set();
  const chunkSize = 200;

  for (let i = 0; i < original.length; i += chunkSize) {
    const chunk = original.slice(i, i + chunkSize);
    const { data } = await supabaseAdmin
      .from("products")
      .select("sku, meli_item_id, status, permalink")
      .eq("meli_account_id", accountId)
      .in("sku", chunk);

    for (const row of data || []) {
      if (row.sku) published.add(String(row.sku).trim().toUpperCase());
    }
  }

  return published;
}

export function buildDefaultDescription({ title, sku, brand, oem }) {
  return (
    `¡BIENVENIDOS A NUESTRA TIENDA OFICIAL!\n\n` +
    `PRODUCTO: ${title}\nSKU: ${sku}\nMARCA: ${brand || "Original"}\nOEM: ${oem || "N/A"}\n\n` +
    `- Repuesto nuevo garantizado.\n- Envíos a nivel nacional.\n- Garantía de 90 días por defectos de fábrica.`
  );
}
