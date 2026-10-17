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
  "https://http2.mlstatic.com/D_NQ_NP_918237-MLV52098675124_102022-O.webp";

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
};

export function formatSEOTitle(rawTitle) {
  if (!rawTitle) return "";
  let seoTitle = String(rawTitle).toUpperCase();

  const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
  const escapedKeys = sortedKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escapedKeys.join("|")})(?=\\.|\\s|$)`, "gi");

  seoTitle = seoTitle.replace(regex, (matched) => {
    const upperMatched = matched.toUpperCase();
    return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + "."] || matched;
  });

  seoTitle = seoTitle
    .replace(/[,()]/g, " ")
    .replace(/\.([A-Z])/g, " $1")
    .replace(/(?<!\d)\.|(\.(?!\d))/g, " ")
    .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
    .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  let finalTitle = seoTitle.toLowerCase().replace(/(?:^|\s|-|\/)\S/g, (c) => c.toUpperCase());

  if (finalTitle.length > 60) {
    let truncated = finalTitle.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 45) truncated = truncated.substring(0, lastSpace);
    return truncated.trim();
  }

  return finalTitle;
}

export function matchLocalPhotoFiles(sku, localFiles, maxPhotos = 6) {
  if (!sku || !localFiles?.length) return [];
  const skuLower = String(sku).trim().toLowerCase();

  return localFiles
    .filter((f) => {
      const base = f.split(".")[0].toLowerCase();
      if (base === skuLower) return true;
      const lastDashIndex = base.lastIndexOf("-");
      if (lastDashIndex !== -1) {
        const prefix = base.substring(0, lastDashIndex);
        const suffix = base.substring(lastDashIndex + 1);
        return prefix === skuLower && /^\d+$/.test(suffix);
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
  photosPath,
  localFiles,
  accessToken,
  maxPhotos = 6,
}) {
  const matchingFiles = matchLocalPhotoFiles(sku, localFiles, maxPhotos);
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
    if (localFiles?.length) {
      const { payloads, matchingFiles } = await uploadLocalPictures({
        sku,
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

export async function resolveCategoryId(supabaseAdmin, { subline, title, settings }) {
  let categoryId = null;

  if (subline) {
    const { data: mapping } = await supabaseAdmin
      .from("category_mappings")
      .select("ml_category_id")
      .ilike("internal_name", subline)
      .limit(1)
      .single();

    if (mapping?.ml_category_id) categoryId = mapping.ml_category_id;
  }

  if (!categoryId && settings?.categoryMap?.[subline]) {
    categoryId = settings.categoryMap[subline];
  }

  if (!categoryId && title) {
    try {
      const predictRes = await fetch(
        `${MELI_BASE_URL}/sites/MLV/domain_discovery/search?q=${encodeURIComponent(title)}`
      );
      const predictData = await predictRes.json();
      if (Array.isArray(predictData) && predictData[0]?.category_id) {
        categoryId = predictData[0].category_id;
      }
    } catch (e) {
      console.warn("Error prediciendo categoría:", e.message);
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
  if (upper.includes("CAJA")) return "Caja";
  if (upper.includes("MOTOR")) return "Motor";
  return "Estándar";
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

  // Si tiene lista cerrada de valores predefinidos en la categoría de ML
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
    if (id === "POSITION" || id === "MOUNTING_POSITION" || name.includes("posición") || name.includes("posicion")) {
      const posGuess = inferPositionFromText(combinedText).toLowerCase();
      const match = attr.values.find((v) => (v.name || "").toLowerCase().includes(posGuess));
      if (match) return { value_id: match.id, value_name: match.name };
    }
    if (isRequired) {
      const first = attr.values.find((v) => v.name) || attr.values[0];
      return { value_id: first.id, value_name: first.name };
    }
  }

  // Atributos abiertos o semi-abiertos (principales y secundarios de autopartes)
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
  if (id === "MOUNTING_POSITION" || id === "POSITION" || name.includes("posición") || name.includes("posicion")) {
    return inferPositionFromText(combinedText);
  }
  if (id === "MOUNTING_BRACKET_INCLUDED") {
    return combinedText.includes("BASE") || combinedText.includes("SOPORTE") ? "Sí" : "No";
  }
  if (id === "MOUNTING_HARDWARE_INCLUDED" || id === "INCLUDES_MOUNTING_ACCESSORIES") {
    return combinedText.includes("KIT") ? "Sí" : "No";
  }
  if (id === "BOLT_HOLE_NUMBER" || id === "MOUNTING_HOLES_NUMBER") return "2";
  if (id === "THICKNESS") return "Estándar";
  if (id === "MODEL") return title ? title.split(" ").slice(0, 4).join(" ") : (sku || "Estándar");
  if (id === "UNITS_PER_PACKAGE") return "1";
  if (id === "IS_OEM") return oem ? "Sí" : "No";
  if (id === "UNIT_VOLUME" || name.includes("volumen")) return "1 L";
  if (id === "UNIT_WEIGHT" || name.includes("peso")) return "1 kg";
  if (id === "SALE_FORMAT" || name.includes("formato de venta")) return "Unidad";

  return isRequired ? "Genérico" : null;
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
  const cleanOem = oem ? String(oem).trim() : String(sku || "").trim();

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
      // No sobreescribir nuestra marca, SKU ni número de pieza con los del competidor
      if (["BRAND", "PART_NUMBER", "SELLER_SKU", "OEM", "GTIN"].includes(at.id)) continue;
      if (at.id.startsWith("SELLER_PACKAGE_")) continue;
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
