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
  getCategoryDisplayName,
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

const SKIP_ATTR_IDS = new Set([
  "SELLER_SKU",
  "ITEM_CONDITION",
  "SELLER_ITEM_EXTRA_INFO",
  "BRAND",
  "PART_NUMBER",
  "OEM",
  "GTIN",
]);

const OWN_NICKNAMES = new Set([
  "CORPORACION RWC CA",
  "CORPORACIONRWCCA",
  "CORPORACIONRWC2",
]);

/**
 * Construye consultas inteligentes para el buscador de terceros (/sites/MLV/search vía Integraly):
 * 1) Núcleo del título SEO sin sublínea interna (primeras 4 palabras, ej. "Base Caja Fiesta 1.6")
 * 2) Primer código OEM limpio (ej. "2S65-7M121-AA")
 * 3) Núcleo corto de 3 palabras (ej. "Base Caja Fiesta")
 * 4) SKU directo
 */
function buildCandidateSearchQueries({ title = "", sku = "", oem = "" }) {
  const candidates = [];
  const cleanTitle = String(title || "")
    .replace(/\b\d{2}-\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanTitle) {
    const words = cleanTitle.split(" ").filter(Boolean);
    if (words.length >= 4) {
      candidates.push(words.slice(0, 4).join(" "));
    }
    if (words.length >= 3) {
      candidates.push(words.slice(0, 3).join(" "));
    }
    candidates.push(cleanTitle);
  }

  if (oem) {
    const oemParts = String(oem)
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 5);
    for (const part of oemParts.slice(0, 2)) {
      candidates.push(part);
    }
  }

  if (sku) {
    candidates.push(String(sku).trim());
  }

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Busca competidores en SERP (usando el Puente Integraly /sites/MLV/search), multiget top 3, elige líder.
 */
export async function analyzeCompetitorsForListing({
  title,
  sku,
  oem,
  subline,
  accountId,
  accessToken,
}) {
  const candidateQueries = buildCandidateSearchQueries({ title, sku, oem });
  if (!candidateQueries.length) {
    return { ok: false, error: "Sin query de búsqueda", query: null, leader: null };
  }

  let rawResults = [];
  let effectiveQuery = candidateQueries[0];

  try {
    const scraplingUp = await isScraplingAvailable();
    if (scraplingUp) {
      for (const q of candidateQueries) {
        const serp = await scraplingSerp({ query: q, maxResults: 20 });
        if (serp.ok && serp.results?.length) {
          const thirdParty = serp.results.filter(
            (r) => !OWN_NICKNAMES.has(String(r.seller || "").trim().toUpperCase())
          );
          if (thirdParty.length > 0) {
            effectiveQuery = q;
            rawResults = thirdParty.map((r) => ({
              id: r.id,
              title: r.title,
              price: r.price_usd ?? r.price ?? 0,
              sold_quantity: r.sold_quantity || 0,
              seller: r.seller || null,
              attributes: r.attributes || [],
              permalink: r.permalink || r.url || null,
            }));
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[quality-engine] Integraly/Scrapling search falló:", err.message);
  }

  if (!rawResults.length) {
    try {
      let token = accessToken;
      if (!token && accountId) {
        token = await getValidAccessToken(accountId);
      }
      const scraped = await scrapeMeliSearch(effectiveQuery, { maxItems: 15, accessToken: token });
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
    return { ok: false, error: "Sin resultados SERP", query: effectiveQuery, leader: null };
  }

  const sorted = sortBySoldQuantity(rawResults);
  const top3 = sorted.slice(0, 3);
  const top3Ids = top3.map((r) => r.id).filter(Boolean);

  let leader = top3[0] || null;

  // Si el primer candidato aún no trae atributos completos del multiget de Integraly, intentamos getItemsBatch
  if (leader && (!leader.attributes || leader.attributes.length === 0)) {
    let token = accessToken;
    if (!token && accountId) {
      try {
        token = await getValidAccessToken(accountId);
      } catch {
        // Sin token
      }
    }
    if (token && top3Ids.length) {
      try {
        const details = await getItemsBatch(top3Ids, token);
        const detailSorted = sortBySoldQuantity(details);
        if (detailSorted[0]) leader = detailSorted[0];
      } catch (err) {
        console.warn("[quality-engine] Multiget falló:", err.message);
      }
    }
  }

  if (!leader) {
    return { ok: false, error: "No se pudo determinar líder", query: effectiveQuery, leader: null };
  }

  return {
    ok: true,
    query: effectiveQuery,
    competitorsAnalyzed: rawResults.length,
    leader: {
      id: leader.id,
      title: leader.title,
      price: leader.price || 0,
      sold_quantity: leader.sold_quantity || 0,
      seller: leader.seller || null,
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
  const categoryInfo = categoryId ? await getCategoryDisplayName(categoryId) : null;

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
      oem,
      subline,
      accountId,
      accessToken,
    });

    if (intel.ok && intel.leader) {
      const preliminaryAttrs = [
        { id: "SELLER_SKU", value_name: sku },
        { id: "PART_NUMBER", value_name: sku },
        ...(brand ? [{ id: "BRAND", value_name: brand }] : []),
        ...(oem ? [{ id: "OEM", value_name: oem }] : []),
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
    { id: "PART_NUMBER", value_name: sku },
    ...(brand ? [{ id: "BRAND", value_name: brand }] : []),
    ...(oem ? [{ id: "OEM", value_name: oem }] : []),
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
      title,
      subline,
      extraAttrs,
    });
  }

  return {
    sku,
    title,
    seoTitle: title,
    rawTitle,
    categoryId,
    categoryName: categoryInfo?.name || null,
    categoryPath: categoryInfo?.path || null,
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
