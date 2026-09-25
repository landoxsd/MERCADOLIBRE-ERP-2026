import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { getCategoryAttributes } from "@/lib/meli";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadPublishedSkuSet } from "@/lib/publish-helpers";
import { buildPublishPreview } from "@/lib/publication-quality-engine";
import { resolveVehiclePhotosDir } from "@/lib/vehicle-catalog";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accountId,
      items,
      item,
      photosPath,
      usePlaceholderIfNoPhoto = true,
      useCompetitorIntel = true,
      injectVehiclePhotos = true,
      skipDuplicates = true,
      preferLocalPhotos = false,
    } = body;

    const itemList = Array.isArray(items) ? items : item ? [item] : [];
    if (!accountId || itemList.length === 0) {
      return NextResponse.json(
        { error: "Se requiere accountId y al menos un item (items[] o item)." },
        { status: 400 }
      );
    }

    const settings = getSettings();
    const effectivePhotosPath = (photosPath && photosPath.trim()) || settings.photosPath || "";
    const hasValidPhotosDir = effectivePhotosPath && fs.existsSync(effectivePhotosPath);
    const vehiclePhotosPath =
      hasValidPhotosDir && effectivePhotosPath
        ? resolveVehiclePhotosDir(effectivePhotosPath)
        : null;

    const accessToken = await getValidAccessToken(accountId);

    let localFiles = [];
    if (hasValidPhotosDir) {
      try {
        localFiles = fs.readdirSync(effectivePhotosPath);
      } catch {
        // Sin fotos locales
      }
    }

    let publishedSkuSet = new Set();
    if (skipDuplicates) {
      publishedSkuSet = await loadPublishedSkuSet(
        supabaseAdmin,
        accountId,
        itemList.map((it) => it.sku)
      );
    }

    const categoryAttributesCache = new Map();
    const previewItem = itemList[0];

    const preview = await buildPublishPreview({
      supabaseAdmin,
      accountId,
      item: previewItem,
      accessToken,
      settings,
      photosPath: effectivePhotosPath,
      localFiles,
      vehiclePhotosPath,
      usePlaceholderIfNoPhoto,
      useCompetitorIntel,
      injectVehiclePhotos,
      preferLocalPhotos,
      categoryAttributesCache,
      getCategoryAttributesFn: getCategoryAttributes,
    });

    const duplicateWarnings = [];
    const skuUpper = String(previewItem.sku || "").trim().toUpperCase();
    if (skipDuplicates && publishedSkuSet.has(skuUpper)) {
      duplicateWarnings.push(`SKU "${previewItem.sku}" ya publicado en ML — será omitido en el lote`);
    }

    const batchSummary = {
      total: itemList.length,
      previewIndex: 0,
      alreadyPublished: publishedSkuSet.size,
      willSkipDuplicates: skipDuplicates,
    };

    return NextResponse.json({
      preview: {
        ...preview,
        warnings: [...(preview.warnings || []), ...duplicateWarnings],
      },
      batchSummary,
    });
  } catch (error) {
    console.error("❌ Error en publish-preview:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
