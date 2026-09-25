// ================================================================
// publish-helpers.js
// Lógica compartida: publicación individual y masiva vía API ML
// ================================================================
import fs from "fs";
import path from "path";
import { uploadPicture } from "@/lib/meli";
import { uploadImageToStorage } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";
export const OFFICIAL_STORE_PLACEHOLDER =
  "https://http2.mlstatic.com/D_NQ_NP_918237-MLV52098675124_102022-O.webp";

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
    .replace(/\./g, " ")
    .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
    .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  let finalTitle = seoTitle.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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
    const filePath = path.join(photosPath, fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const buffer = fs.readFileSync(filePath);
      const picRes = await uploadPicture(buffer, fileName, accessToken);
      if (picRes?.id) payloads.push({ id: picRes.id });
    } catch (uploadErr) {
      try {
        const buffer = fs.readFileSync(filePath);
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
    if (photosPath && fs.existsSync(photosPath) && localFiles?.length) {
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

function inferDefaultAttributeValue(attr, { oem }) {
  const name = (attr.name || "").toLowerCase();
  const id = attr.id || "";

  if (id === "VEHICLE_TYPE" || name.includes("vehículo")) return "Auto/Camioneta";
  if (id === "UNITS_PER_PACKAGE") return "1";
  if (id === "IS_OEM") return oem ? "Sí" : "No";
  if (id === "UNIT_VOLUME" || name.includes("volumen")) return "1 L";
  if (id === "UNIT_WEIGHT" || name.includes("peso")) return "1 kg";
  if (id === "SALE_FORMAT" || name.includes("formato de venta")) return "Unidad";
  if (id === "ITEM_CONDITION" || name.includes("condición")) return "Nuevo";

  if (attr.values?.length > 0) {
    const first = attr.values.find((v) => v.name) || attr.values[0];
    return first.name || first.id || "Genérico";
  }

  return "Genérico";
}

export function buildDynamicAttributes({
  requiredAttributes = [],
  sku,
  brand,
  oem,
  extraAttrs = [],
}) {
  const dynamicAttributes = [{ id: "SELLER_SKU", value_name: sku }];

  if (brand) dynamicAttributes.push({ id: "BRAND", value_name: brand });
  if (oem) dynamicAttributes.push({ id: "PART_NUMBER", value_name: oem });

  for (const at of extraAttrs) {
    if (at?.id && !dynamicAttributes.find((a) => a.id === at.id)) {
      dynamicAttributes.push({ id: at.id, value_name: at.value_name });
    }
  }

  for (const attr of requiredAttributes) {
    if (!dynamicAttributes.find((a) => a.id === attr.id)) {
      dynamicAttributes.push({
        id: attr.id,
        value_name: inferDefaultAttributeValue(attr, { oem }),
      });
    }
  }

  if (!dynamicAttributes.find((a) => a.id === "BRAND")) {
    dynamicAttributes.push({ id: "BRAND", value_name: brand || "Genérico" });
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
