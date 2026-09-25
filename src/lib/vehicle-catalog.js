// ================================================================
// vehicle-catalog.js
// Catálogo de vehículos + fitment por SKU + foto de aplicación
// Publicador de Calidad v2 — Sprint 2
// ================================================================
import fs from "fs";
import path from "path";
import { uploadPicture, setItemCompatibilities } from "@/lib/meli";

/** Subcarpeta bajo photosPath (raíz FOTOS) donde viven las fotos de aplicación vehicular. */
export const VEHICLE_PHOTOS_SUBFOLDER = "CARROS";

/**
 * Resuelve el directorio de fotos vehiculares.
 * - photosPath = raíz FOTOS → {photosPath}/CARROS
 * - photosPath ya apunta a CARROS → se usa tal cual
 */
export function resolveVehiclePhotosDir(photosPath) {
  if (!photosPath) return null;

  const normalized = path.normalize(String(photosPath).trim());
  if (path.basename(normalized).toUpperCase() === VEHICLE_PHOTOS_SUBFOLDER) {
    return normalized;
  }

  return path.join(normalized, VEHICLE_PHOTOS_SUBFOLDER);
}

/**
 * Ruta absoluta a un archivo de foto vehicular en disco.
 */
export function resolveVehiclePhotoFilePath(photosPath, photoLocalPath) {
  if (!photosPath || !photoLocalPath) return null;

  const dir = resolveVehiclePhotosDir(photosPath);
  // photo_local_path = nombre exacto en CARROS (puede incluir espacios, ej. "ACCENT 2007-2009.jpg")
  const fileName = String(photoLocalPath).trim().replace(/^[/\\]+/, "");
  return path.join(dir, fileName);
}

/**
 * Normaliza clave de búsqueda única: MAKE|MODEL|YEAR
 */
export function normalizeSearchKey(make, model, year) {
  const norm = (s) =>
    String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");
  const y = year != null ? String(year).trim() : "";
  return [norm(make), norm(model), norm(y)].filter(Boolean).join("|");
}

/**
 * Obtiene vehículos asociados a un SKU desde sku_vehicle_fitment.
 */
export async function getVehiclesForSku(supabase, sku) {
  if (!sku) return [];

  const { data, error } = await supabase
    .from("sku_vehicle_fitment")
    .select(
      `
      sku,
      source,
      vehicle_id,
      vehicle_catalog (
        id, make, model, year_from, year_to, variant,
        photo_local_path, ml_picture_id, search_key
      )
    `
    )
    .eq("sku", String(sku).trim());

  if (error || !data?.length) return [];

  return data.map((row) => row.vehicle_catalog).filter(Boolean);
}

/**
 * Resuelve payload ML para foto de vehículo (id o source).
 * Sube desde disco local si hace falta y cachea ml_picture_id.
 */
export async function resolveVehiclePicture(
  supabase,
  vehicle,
  { accessToken, photosPath, vehiclePhotosPath } = {}
) {
  if (!vehicle) return null;

  if (vehicle.ml_picture_id) {
    return { id: vehicle.ml_picture_id };
  }

  const effectivePhotosPath = photosPath || vehiclePhotosPath;
  if (!vehicle.photo_local_path || !effectivePhotosPath || !accessToken) {
    return null;
  }

  const filePath = resolveVehiclePhotoFilePath(effectivePhotosPath, vehicle.photo_local_path);
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const buffer = fs.readFileSync(filePath);
    const picRes = await uploadPicture(buffer, path.basename(filePath), accessToken);
    if (picRes?.id) {
      await supabase
        .from("vehicle_catalog")
        .update({ ml_picture_id: picRes.id, updated_at: new Date().toISOString() })
        .eq("id", vehicle.id);
      return { id: picRes.id };
    }
  } catch (err) {
    console.warn(`⚠️ No se pudo subir foto de vehículo ${vehicle.make} ${vehicle.model}:`, err.message);
  }

  return null;
}

/**
 * Genera bloque de texto de compatibilidad para la descripción.
 */
export function generateCompatibilityText(vehicles) {
  if (!vehicles?.length) return "";

  const lines = vehicles.map((v) => {
    const yearRange =
      v.year_from === v.year_to ? String(v.year_from) : `${v.year_from}-${v.year_to}`;
    const variant = v.variant ? ` (${v.variant})` : "";
    return `• ${v.make} ${v.model} ${yearRange}${variant}`;
  });

  return (
    `\n\n🚗 COMPATIBILIDAD VEHICULAR:\n` +
    `Este repuesto es compatible con los siguientes vehículos:\n` +
    `${lines.join("\n")}\n`
  );
}

/**
 * Persiste fitment en product_compatibilities (Supabase).
 */
export async function storeProductCompatibilities(supabase, { meliItemId, productId, vehicles }) {
  if (!vehicles?.length || !meliItemId) return { stored: 0 };

  const rows = vehicles.map((v) => ({
    meli_item_id: meliItemId,
    product_id: productId || null,
    make: v.make,
    model: v.model,
    year:
      v.year_from === v.year_to ? String(v.year_from) : `${v.year_from}-${v.year_to}`,
    notes: v.variant || null,
  }));

  const { error } = await supabase.from("product_compatibilities").insert(rows);
  if (error) {
    console.warn("⚠️ Error guardando compatibilidades en Supabase:", error.message);
    return { stored: 0, error: error.message };
  }

  return { stored: rows.length };
}

/**
 * Tras publicar: intenta API ML compatibilities, guarda en DB, devuelve texto extra.
 */
export async function persistFitmentAfterPublish({
  supabase,
  meliItemId,
  productId,
  vehicles,
  accessToken,
  description = "",
}) {
  if (!vehicles?.length || !meliItemId) {
    return { compatText: "", mlApiOk: false, dbStored: 0 };
  }

  let mlApiOk = false;
  if (accessToken) {
    const mlPayload = vehicles.map((v) => ({
      make: v.make,
      model: v.model,
      year_from: v.year_from,
      year_to: v.year_to,
      variant: v.variant || undefined,
    }));
    const result = await setItemCompatibilities(meliItemId, mlPayload, accessToken);
    mlApiOk = result?.ok === true;
    if (!mlApiOk) {
      console.warn(
        `ℹ️ API compatibilities no disponible para ${meliItemId} — usando descripción + DB`
      );
    }
  }

  const dbResult = await storeProductCompatibilities(supabase, {
    meliItemId,
    productId,
    vehicles,
  });

  const compatText = description.includes("COMPATIBILIDAD VEHICULAR")
    ? ""
    : generateCompatibilityText(vehicles);

  return {
    compatText,
    mlApiOk,
    dbStored: dbResult.stored || 0,
  };
}
