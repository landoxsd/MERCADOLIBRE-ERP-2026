import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import {
  publishItem,
  setItemDescription,
  getCategoryAttributes,
  getOfficialStoreId,
} from "@/lib/meli";
import { productsTable, supabaseAdmin } from "@/lib/supabase-admin";
import { enrichAutopartListing } from "@/lib/gemini";
import {
  formatSEOTitle,
  resolvePicturesForSku,
  resolveCategoryId,
  buildDynamicAttributes,
  buildDefaultDescription,
  injectVehiclePhoto,
} from "@/lib/publish-helpers";
import {
  getVehiclesForSku,
  resolveVehiclePicture,
  persistFitmentAfterPublish,
  generateCompatibilityText,
} from "@/lib/vehicle-catalog";
import {
  analyzeCompetitorsForListing,
  mergeLeaderInsights,
  validatePublishItem,
} from "@/lib/publication-quality-engine";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req) {
  try {
    const settings = getSettings();
    const body = await req.json();
    let {
      accountId,
      sku,
      title,
      price,
      stock,
      subline,
      brand,
      oem,
      extraAttrs,
      useCompetitorIntel = true,
      injectVehiclePhotos = true,
      usePlaceholderIfNoPhoto = false,
      preferLocalPhotos = false,
      useAI = false,
      listingTypeId = "gold_special",
      preflightOnly = false,
    } = body;

    sku = sku?.trim();

    if (!accountId || !sku || !title) {
      return NextResponse.json(
        { error: "Faltan parámetros obligatorios (accountId, sku, title)" },
        { status: 400 }
      );
    }

    const { data: existingProduct } = await supabaseAdmin
      .from("products")
      .select("meli_item_id, permalink, status, sku")
      .eq("meli_account_id", accountId)
      .ilike("sku", sku)
      .limit(1)
      .maybeSingle();

    if (existingProduct?.meli_item_id) {
      return NextResponse.json(
        {
          error: `El SKU "${sku}" ya está publicado en Mercado Libre.`,
          meli_item_id: existingProduct.meli_item_id,
          permalink: existingProduct.permalink,
          status: existingProduct.status,
        },
        { status: 409 }
      );
    }

    const accessToken = await getValidAccessToken(accountId);
    const photosPath = settings.photosPath || "";
    const hasValidPhotosDir = photosPath && fs.existsSync(photosPath);
    const localFiles = hasValidPhotosDir ? fs.readdirSync(photosPath) : [];

    let seoTitle = formatSEOTitle(title) || title;
    let effectivePrice = parseFloat(price);
    const stockQty = parseInt(stock, 10) || 1;
    const sublineStr = String(subline || "").trim();
    const brandName = brand || "Original";
    const oemCode = oem || "";

    let {
      picturePayloads,
      photoSource,
      hasRealPhoto,
    } = await resolvePicturesForSku({
      supabaseAdmin,
      sku,
      photosPath,
      localFiles,
      accessToken,
      usePlaceholderIfNoPhoto,
      preferLocalPhotos,
      maxPhotos: 6,
    });

    if (injectVehiclePhotos) {
      const vehicles = await getVehiclesForSku(supabaseAdmin, sku);
      if (vehicles.length > 0) {
        const vehiclePicture = await resolveVehiclePicture(
          supabaseAdmin,
          vehicles[0],
          { accessToken, photosPath }
        );
        if (vehiclePicture) {
          picturePayloads = injectVehiclePhoto(picturePayloads, vehiclePicture);
        }
      }
    }

    if (picturePayloads.length === 0) {
      return NextResponse.json(
        {
          error: `No se encontraron fotos (ni en Image Bank ni locales) para el SKU "${sku}".`,
        },
        { status: 400 }
      );
    }

    const categoryId = await resolveCategoryId(supabaseAdmin, {
      subline: sublineStr,
      title: seoTitle,
      settings,
    });

    if (!categoryId) {
      return NextResponse.json(
        {
          error: `No hay categoría mapeada para la sublínea "${sublineStr}" y falló la predicción automática.`,
        },
        { status: 400 }
      );
    }

    const preflight = validatePublishItem(
      { sku, title: seoTitle, price: effectivePrice, stock: stockQty },
      categoryId,
      picturePayloads
    );

    if (!preflight.ok) {
      return NextResponse.json(
        { error: preflight.errors.join("; "), warnings: preflight.warnings },
        { status: 400 }
      );
    }

    let competitorLeader = null;
    let intelExtraAttrs = extraAttrs || [];

    if (useCompetitorIntel) {
      const intel = await analyzeCompetitorsForListing({
        title: seoTitle,
        sku,
        subline: sublineStr,
        accountId,
        accessToken,
      });

      if (intel.ok && intel.leader) {
        competitorLeader = intel.leader;
        const preliminaryAttrs = [
          { id: "SELLER_SKU", value_name: sku },
          ...(brandName ? [{ id: "BRAND", value_name: brandName }] : []),
          ...(oemCode ? [{ id: "PART_NUMBER", value_name: oemCode }] : []),
        ];
        const merged = mergeLeaderInsights({
          ourTitle: seoTitle,
          ourPrice: effectivePrice,
          ourAttrs: preliminaryAttrs,
          leader: intel.leader,
        });

        seoTitle = merged.suggestedTitle || seoTitle;
        if (merged.suggestedPrice && merged.suggestedPrice >= 2) {
          effectivePrice = merged.suggestedPrice;
        }
        intelExtraAttrs = [...intelExtraAttrs, ...(merged.missingAttributes || [])];
      }
    }

    if (isNaN(effectivePrice) || effectivePrice < 2) {
      return NextResponse.json(
        { error: `Precio inválido ($${effectivePrice}). Mínimo $2.00 USD.` },
        { status: 400 }
      );
    }

    const requiredAttributes = await getCategoryAttributes(categoryId);
    const dynamicAttributes = buildDynamicAttributes({
      requiredAttributes,
      sku,
      brand: brandName,
      oem: oemCode,
      extraAttrs: intelExtraAttrs,
    });

    if (preflightOnly) {
      return NextResponse.json({
        success: true,
        preflight: true,
        title: seoTitle,
        seoTitle,
        categoryId,
        suggestedPrice: effectivePrice,
        attributes: dynamicAttributes,
        photoSource,
        photoCount: picturePayloads.length,
        warnings: preflight.warnings,
        competitor_leader_id: competitorLeader?.id || null,
      });
    }

    let itemDescriptionText = buildDefaultDescription({
      title: seoTitle,
      sku,
      brand: brandName,
      oem: oemCode,
    });

    if (useAI) {
      const aiRes = await enrichAutopartListing({
        sku,
        title: seoTitle,
        brand: brandName,
        oem: oemCode,
        subline: sublineStr,
      });
      if (aiRes?.description) {
        itemDescriptionText = aiRes.description;
      }
    }

    const fitmentVehicles = await getVehiclesForSku(supabaseAdmin, sku);
    if (fitmentVehicles.length > 0) {
      itemDescriptionText += generateCompatibilityText(fitmentVehicles);
    }

    const officialStoreId = await getOfficialStoreId(accessToken);

    const mlPayload = {
      title: seoTitle,
      category_id: categoryId,
      price: effectivePrice,
      currency_id: "USD",
      available_quantity: stockQty,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: listingTypeId,
      pictures: picturePayloads,
      attributes: dynamicAttributes,
      shipping: { mode: "not_specified" },
    };

    if (officialStoreId) {
      mlPayload.official_store_id = Number(officialStoreId) || officialStoreId;
    }

    console.log(
      `🚀 Publicando SKU ${sku} (fotos: ${photoSource}, intel: ${useCompetitorIntel})...`
    );
    const publishRes = await publishItem(mlPayload, accessToken);

    const fitmentResult = await persistFitmentAfterPublish({
      supabase: supabaseAdmin,
      meliItemId: publishRes.id,
      productId: null,
      vehicles: fitmentVehicles,
      accessToken,
      description: itemDescriptionText,
    });

    if (fitmentResult.compatText) {
      itemDescriptionText += fitmentResult.compatText;
    }

    await setItemDescription(publishRes.id, itemDescriptionText, accessToken);

    const productData = {
      meli_item_id: publishRes.id,
      meli_account_id: accountId,
      title: publishRes.title,
      status: publishRes.status,
      price: publishRes.price,
      available_qty: publishRes.available_quantity,
      permalink: publishRes.permalink,
      thumbnail: publishRes.thumbnail,
      category_id: publishRes.category_id,
      sku,
      raw_data: {
        ...publishRes,
        photo_status: hasRealPhoto ? "real" : "placeholder",
        photo_source: photoSource,
        published_via: "api_single",
        competitor_leader_id: competitorLeader?.id || null,
        fitment_ml_api: fitmentResult.mlApiOk,
        fitment_db_stored: fitmentResult.dbStored,
      },
      updated_at: new Date(),
    };

    await productsTable().upsert(productData, { onConflict: "meli_item_id" });

    return NextResponse.json({
      success: true,
      meli_id: publishRes.id,
      permalink: publishRes.permalink,
      photoSource,
      title: publishRes.title,
      price: effectivePrice,
      warnings: preflight.warnings,
      competitor_leader_id: competitorLeader?.id || null,
    });
  } catch (error) {
    console.error("❌ Error en Publicación:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
