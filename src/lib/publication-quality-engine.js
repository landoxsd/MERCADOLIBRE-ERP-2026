// ================================================================
// publication-quality-engine.js
// Inteligencia competitiva pre-publicación + validación pre-flight
// Publicador de Calidad v2 — Sprint 3
// ================================================================
import { scraplingSerp, isScraplingAvailable } from "@/lib/scrapling-client";
import { scrapeMeliSearch } from "@/lib/mlv-playwright-scraper";
import { getItemsBatch } from "@/lib/meli";
import { sortBySoldQuantity } from "@/lib/sniper-helpers";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import {
  formatSEOTitle,
  resolvePicturesForSku,
  resolveCategoryId,
  buildDynamicAttributes,
  injectVehiclePhoto,
} from "@/lib/publish-helpers";
import { getVehiclesForSku, resolveVehiclePicture } from "@/lib/vehicle-catalog";

const STOP_WORDS = new Set([
  "de",
  "la",
  "el",
  "para",
  "con",
  "y",
  "en",
  "del",
  "los",
  "las",
  "un",
  "una",
  "por",
  "al",
]);

const SKIP_ATTR_IDS = new Set(["SELLER_SKU", "ITEM_CONDITION", "SELLER_ITEM_EXTRA_INFO"]);

/**
 * Busca competidores en SERP, multiget top 3, elige líder por sold_quantity.
 */
export async function analyzeCompetitorsForListing({
  title,
  sku,
  subline,
  accountId,
  accessToken,
}) {
  const query = [title, subline].filter(Boolean).join(" ").trim() || String(sku || "").trim();
  if (!query) {
    return { ok: false, error: "Sin query de búsqueda", query: null, leader: null };
  }

  let rawResults = [];

  try {
    const scraplingUp = await isScraplingAvailable();
    if (scraplingUp) {
      const serp = await scraplingSerp({ query, maxResults: 20 });
      if (serp.ok && serp.results?.length) {
        rawResults = serp.results.map((r) => ({
          id: r.id,
          title: r.title,
          price: r.price_usd ?? r.price ?? 0,
          sold_quantity: r.sold_quantity || 0,
        }));
      }
    }
  } catch (err) {
    console.warn("[quality-engine] Scrapling falló:", err.message);
  }

  if (!rawResults.length) {
    try {
      let token = accessToken;
      if (!token && accountId) {
        token = await getValidAccessToken(accountId);
      }
      const scraped = await scrapeMeliSearch(query, { maxItems: 15, accessToken: token });
      rawResults = (scraped || []).map((r) => ({
        id: r.id,
        title: r.title,
        price: r.price || 0,
        sold_quantity: r.sold_quantity || 0,
      }));
    } catch (err) {
      console.warn("[quality-engine] Playwright scraper falló:", err.message);
    }
  }

  if (!rawResults.length) {
    return { ok: false, error: "Sin resultados SERP", query, leader: null };
  }

  const sorted = sortBySoldQuantity(rawResults);
  const top3Ids = sorted.slice(0, 3).map((r) => r.id).filter(Boolean);

  let token = accessToken;
  if (!token && accountId) {
    try {
      token = await getValidAccessToken(accountId);
    } catch {
      // Sin token — usamos datos del scraper
    }
  }

  let leader = null;
  if (token && top3Ids.length) {
    try {
      const details = await getItemsBatch(top3Ids, token);
      const detailSorted = sortBySoldQuantity(details);
      leader = detailSorted[0] || null;
    } catch (err) {
      console.warn("[quality-engine] Multiget falló:", err.message);
      leader = sorted[0];
    }
  } else {
    leader = sorted[0];
  }

  if (!leader) {
    return { ok: false, error: "No se pudo determinar líder", query, leader: null };
  }

  return {
    ok: true,
    query,
    competitorsAnalyzed: top3Ids.length || sorted.slice(0, 3).length,
    leader: {
      id: leader.id,
      title: leader.title,
      price: leader.price || 0,
      sold_quantity: leader.sold_quantity || 0,
      attributes: leader.attributes || [],
      permalink: leader.permalink || null,
    },
  };
}

/**
 * Fusiona insights del líder: keywords de título, atributos faltantes, precio -3%.
 */
export function mergeLeaderInsights({ ourTitle, ourPrice, ourAttrs = [], leader }) {
  if (!leader) {
    return {
      suggestedTitle: ourTitle,
      suggestedPrice: ourPrice,
      missingAttributes: [],
      titleKeywords: [],
    };
  }

  const ourTitleLower = (ourTitle || "").toLowerCase();
  const leaderWords = (leader.title || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-záéíóúñ0-9/-]/gi, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const titleKeywords = [...new Set(leaderWords.filter((w) => !ourTitleLower.includes(w)))];

  let suggestedTitle = ourTitle || "";
  for (const kw of titleKeywords.slice(0, 4)) {
    const candidate = `${suggestedTitle} ${kw}`.trim();
    if (candidate.length <= 60) {
      suggestedTitle = candidate;
    } else {
      break;
    }
  }
  suggestedTitle = formatSEOTitle(suggestedTitle) || suggestedTitle;

  const ourAttrIds = new Set((ourAttrs || []).map((a) => a.id));
  const missingAttributes = (leader.attributes || [])
    .filter((a) => a.id && a.value_name && !ourAttrIds.has(a.id))
    .filter((a) => !SKIP_ATTR_IDS.has(a.id))
    .map((a) => ({ id: a.id, value_name: a.value_name }))
    .slice(0, 8);

  const leaderPrice = parseFloat(leader.price);
  const suggestedPrice =
    !isNaN(leaderPrice) && leaderPrice > 0
      ? Math.round(leaderPrice * 0.97 * 100) / 100
      : ourPrice;

  return {
    suggestedTitle,
    suggestedPrice,
    missingAttributes,
    titleKeywords: titleKeywords.slice(0, 6),
  };
}

/**
 * Validación pre-flight antes de publicar.
 */
export function validatePublishItem(item, categoryId, pictures) {
  const errors = [];
  const warnings = [];

  const sku = String(item?.sku || "").trim();
  const title = String(item?.title || "").trim();
  const price = parseFloat(item?.price);

  if (!sku) errors.push("SKU requerido");
  if (!title) errors.push("Título requerido");
  if (isNaN(price) || price < 2) {
    errors.push("Precio mínimo $2.00 USD (requerido por Mercado Libre)");
  }
  if (!categoryId) warnings.push("Categoría ML no resuelta");
  if (pictures != null) {
    if (!pictures.length) {
      errors.push("Se requiere al menos 1 foto");
    } else if (pictures.length < 3) {
      warnings.push("Menos de 3 fotos — los líderes suelen usar 6");
    }
  }
  if (title.length > 60) warnings.push(`Título largo (${title.length}/60 caracteres)`);
  if (title.length > 0 && title.length < 15) {
    warnings.push("Título corto — pocos keywords para SEO");
  }

  const stock = parseInt(item?.stock, 10);
  if (isNaN(stock) || stock < 1) warnings.push("Stock bajo o inválido");

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Construye vista previa pre-flight sin publicar (primer ítem o resumen de lote).
 */
export async function buildPublishPreview({
  supabaseAdmin,
  accountId,
  item,
  accessToken,
  settings,
  photosPath,
  localFiles = [],
  vehiclePhotosPath = null,
  usePlaceholderIfNoPhoto = true,
  useCompetitorIntel = true,
  injectVehiclePhotos = true,
  preferLocalPhotos = false,
  categoryAttributesCache = new Map(),
  getCategoryAttributesFn,
}) {
  const sku = String(item?.sku || "").trim();
  const rawTitle = item?.title || "";
  const price = parseFloat(item?.price);
  const stock = parseInt(item?.stock, 10) || 1;
  const subline = String(item?.subline || "").trim();
  const brand = item?.brand || "Original";
  const oem = item?.oem || "";

  let title = formatSEOTitle(rawTitle) || rawTitle;
  let effectivePrice = price;
  const photoSources = [];
  let vehiclePhoto = null;

  const {
    picturePayloads,
    photoSource,
    matchingFiles,
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

  if (photoSource) {
    photoSources.push({
      type: photoSource,
      count: picturePayloads.length,
      files: matchingFiles || undefined,
    });
  }

  let finalPictures = [...picturePayloads];

  if (injectVehiclePhotos && sku) {
    const vehicles = await getVehiclesForSku(supabaseAdmin, sku);
    if (vehicles.length > 0) {
      const vp = await resolveVehiclePicture(supabaseAdmin, vehicles[0], {
        accessToken,
        photosPath: photosPath || vehiclePhotosPath,
      });
      if (vp) {
        vehiclePhoto = {
          make: vehicles[0].make,
          model: vehicles[0].model,
          year_from: vehicles[0].year_from,
          year_to: vehicles[0].year_to,
          picture: vp,
        };
        finalPictures = injectVehiclePhoto(finalPictures, vp);
        photoSources.push({
          type: "vehicle_application",
          position: 2,
          vehicle: `${vehicles[0].make} ${vehicles[0].model}`,
        });
      }
    }
  }

  const categoryId = await resolveCategoryId(supabaseAdmin, { subline, title, settings });

  const preflight = validatePublishItem(
    { sku, title, price: effectivePrice, stock },
    categoryId,
    finalPictures
  );

  let competitorIntel = null;
  let extraAttrs = [];

  if (useCompetitorIntel && title) {
    const intel = await analyzeCompetitorsForListing({
      title,
      sku,
      subline,
      accountId,
      accessToken,
    });

    if (intel.ok && intel.leader) {
      const preliminaryAttrs = [
        { id: "SELLER_SKU", value_name: sku },
        ...(brand ? [{ id: "BRAND", value_name: brand }] : []),
        ...(oem ? [{ id: "PART_NUMBER", value_name: oem }] : []),
      ];
      const merged = mergeLeaderInsights({
        ourTitle: title,
        ourPrice: effectivePrice,
        ourAttrs: preliminaryAttrs,
        leader: intel.leader,
      });

      title = merged.suggestedTitle || title;
      if (merged.suggestedPrice && merged.suggestedPrice >= 2) {
        effectivePrice = merged.suggestedPrice;
      }
      extraAttrs = merged.missingAttributes || [];

      competitorIntel = {
        query: intel.query,
        leader: intel.leader,
        titleKeywords: merged.titleKeywords,
        attributesAdded: extraAttrs.length,
        suggestedTitle: title,
        suggestedPrice: effectivePrice,
      };
    } else if (intel.error) {
      preflight.warnings.push(`Intel competencia: ${intel.error}`);
    }
  }

  let attributes = [
    { id: "SELLER_SKU", value_name: sku },
    ...(brand ? [{ id: "BRAND", value_name: brand }] : []),
    ...(oem ? [{ id: "PART_NUMBER", value_name: oem }] : []),
    ...extraAttrs,
  ];

  if (categoryId && getCategoryAttributesFn) {
    if (!categoryAttributesCache.has(categoryId)) {
      categoryAttributesCache.set(categoryId, await getCategoryAttributesFn(categoryId));
    }
    const requiredAttributes = categoryAttributesCache.get(categoryId);
    attributes = buildDynamicAttributes({
      requiredAttributes,
      sku,
      brand,
      oem,
      extraAttrs,
    });
  }

  return {
    sku,
    title,
    seoTitle: title,
    rawTitle,
    categoryId,
    photoSources,
    photoCount: finalPictures.length,
    vehiclePhoto,
    competitorIntel,
    suggestedPrice: effectivePrice,
    originalPrice: price,
    attributes,
    warnings: preflight.warnings,
    errors: preflight.errors,
    ok: preflight.ok,
  };
}
