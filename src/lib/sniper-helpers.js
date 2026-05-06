// ================================================================
// src/lib/sniper-helpers.js
// Helpers de scraping lógico y procesamiento para Listing Sniper V3
// Específicos para MercadoLibre Venezuela (MLV)
// ================================================================

const MELI_BASE_URL = "https://api.mercadolibre.com";

// -----------------------------------------------------------------
// ZONAS DE PICKUP MLV (detectadas en títulos/descripciones)
// -----------------------------------------------------------------
const ZONE_KEYWORDS = {
    chacao: ["chacao", "altamira", "los palos grandes"],
    sabana_grande: ["sabana grande", "chacaito"],
    los_cortijos: ["los cortijos", "la california"],
    valencia: ["valencia", "naguanagua"],
    maracaibo: ["maracaibo", "5 de julio"],
    las_mercedes: ["las mercedes", "baruta"],
    bello_monte: ["bello monte"],
};

// -----------------------------------------------------------------
// PALABRAS SPAM PENALIZADAS POR MLV
// -----------------------------------------------------------------
const SPAM_KEYWORDS = [
    "remate", "urgente", "ultimo", "!!!!", "oferton",
    "aprovecha", "unico", "liquidacion", "barato", "regalo",
    "imperdible", "ultima unidad", "ultimas unidades", "oferta"
];

// -----------------------------------------------------------------
// MÉTODOS DE ENVÍO TRADICIONALES (MLV no tiene ME Full)
// -----------------------------------------------------------------
const DELIVERY_KEYWORDS = {
    zoom: ["zoom"],
    tealca: ["tealca"],
    mrw: ["mrw"],
    liberty_express: ["liberty express"],
    envio_nacional: ["envío nacional", "envio nacional", "envio a todo el pais", "envío a todo el país"],
};

/**
 * Extrae zonas de pickup mencionadas en título/descripción
 */
export function extractPickupZones(title = "", description = "") {
    const text = (title + " " + description).toLowerCase();
    const zones = [];

    Object.entries(ZONE_KEYWORDS).forEach(([zone, keywords]) => {
        if (keywords.some((k) => text.includes(k))) {
            zones.push(zone);
        }
    });

    return zones;
}

/**
 * Extrae métodos de envío mencionados en título/descripción
 */
export function extractDeliveryMethods(title = "", description = "") {
    const text = (title + " " + description).toLowerCase();
    const methods = [];

    Object.entries(DELIVERY_KEYWORDS).forEach(([method, keywords]) => {
        if (keywords.some((k) => text.includes(k))) {
            methods.push(method);
        }
    });

    return methods;
}

/**
 * Detecta palabras spam penalizadas en el título
 */
export function detectSpamWords(title = "") {
    const titleLower = title.toLowerCase();
    const found = [];

    SPAM_KEYWORDS.forEach((word) => {
        if (titleLower.includes(word)) {
            found.push(word);
        }
    });

    return found;
}

/**
 * Procesa un snapshot enriquecido a partir de datos crudos de ML
 */
export function processSnapshot(item, detail, description, meta) {
    const titleLower = (item.title || "").toLowerCase();
    const descLower = (description || "").toLowerCase();

    const pickupZones = extractPickupZones(item.title, description);
    const deliveryMethods = extractDeliveryMethods(item.title, description);
    const spamWords = detectSpamWords(item.title);

    return {
        snapshot_batch_id: meta.batchId,
        search_query: meta.query,
        our_product_sku: meta.sku || null,
        our_ml_item_id: meta.ourItemId || null,

        ml_item_id: item.id,
        title: item.title,
        price_usd: item.price,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity || detail.sold_quantity || 0,
        sold_since: detail.date_created ? detail.date_created.split("T")[0] : null,
        condition: item.condition,
        listing_type_id: item.listing_type_id,
        permalink: item.permalink,

        seller_id: item.seller?.id?.toString() || null,
        seller_nickname: item.seller?.nickname || null,
        seller_reputation_level: item.seller?.seller_reputation?.level_id || null,
        seller_power_seller: item.seller?.seller_reputation?.power_seller_status || null,

        health_score: detail.health_score || null,
        health_level: detail.health_level || null,
        pictures_count: detail.pictures?.length || 0,
        attributes_count: detail.attributes?.length || 0,
        has_description: description.length > 100,
        description_text: description.substring(0, 500),

        logistics_data: {
            pickup_zones: pickupZones,
            delivery_methods: deliveryMethods,
            seller_city: item.seller_address?.city?.name || null,
            seller_state: item.seller_address?.state?.name || null,
            local_pickup: item.shipping?.local_pick_up || false,
            spam_words_detected: spamWords,
        },

        raw_api_response: detail,
        search_position: meta.position,
        search_sort_used: "relevance_then_sales",
    };
}

/**
 * Fetch de descripción de un ítem (plain_text)
 */
export async function fetchItemDescription(itemId) {
    try {
        const res = await fetch(`${MELI_BASE_URL}/items/${itemId}/description`);
        if (!res.ok) return "";
        const data = await res.json();
        return data.plain_text || "";
    } catch {
        return "";
    }
}

/**
 * Fetch de performance/health de un ítem
 * Usa /item/{id}/performance (nueva API post-feb 2025)
 * Fallback a /items/{id}/health para categorías de vehículos
 */
export async function fetchItemPerformance(itemId, accessToken) {
    try {
        // Nueva API de Performance
        const res = await fetch(`${MELI_BASE_URL}/item/${itemId}/performance`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
            const data = await res.json();
            return {
                score: data.score || null,
                level: data.level || null,
                buckets: data.buckets || [],
            };
        }
    } catch {
        // Silencioso, probamos fallback
    }

    // Fallback: API legacy /health (para vehículos en MLV)
    try {
        const res = await fetch(`${MELI_BASE_URL}/items/${itemId}/health`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
            const data = await res.json();
            return {
                score: data.health_score || null,
                level: data.status || null,
                buckets: data.goals || [],
            };
        }
    } catch {
        // Silencioso
    }

    return { score: null, level: null, buckets: [] };
}

/**
 * Ordena resultados por sold_quantity descendente (simula sort=sold_quantity_desc)
 */
export function sortBySoldQuantity(results) {
    return [...results].sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0));
}

/**
 * Divide array en chunks para multiget (máx 20 IDs por llamada)
 */
export function chunkArray(arr, size = 20) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Detecta automáticamente el modo de análisis basado en la query
 * - fitment: si incluye marca/modelo/año sin número de parte
 * - price: si incluye número de parte o es query genérica
 */
export function detectAnalysisMode(query = "") {
    const q = query.toLowerCase();
    const hasVehicleTerms = /\b(toyota|ford|chevrolet|corolla|hilux|201[0-9]|202[0-9])\b/.test(q);
    const hasPartNumber = /\b[0-9]{5,}\b/.test(q);

    return hasVehicleTerms && !hasPartNumber ? "fitment" : "price";
}
