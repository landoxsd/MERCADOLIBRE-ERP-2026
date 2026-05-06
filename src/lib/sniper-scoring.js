// ================================================================
// src/lib/sniper-scoring.js
// Algoritmo de Scoring Contextual: Fitment vs Price
// Listing Sniper V3 — MercadoLibre Venezuela (MLV)
// ================================================================

/**
 * Calcula el score competitivo completo entre nuestro ítem y el líder.
 * @param {Object} ourItem — Nuestro ítem (de products o internal_inventory)
 * @param {Object} leader — El ítem líder (snapshot enriquecido)
 * @param {Array} allCompetitors — Todos los competidores analizados
 * @param {String} mode — 'auto' | 'fitment' | 'price'
 * @returns {Object} { mode, score_total, score_breakdown, action_plan, gaps }
 */
export function calculateCompetitiveScore(ourItem, leader, allCompetitors, mode = "auto") {
    // --- 1. DETECTAR MODO AUTOMÁTICAMENTE ---
    if (mode === "auto") {
        const query = leader.search_query?.toLowerCase() || "";
        const hasVehicleTerms = /\b(toyota|ford|chevrolet|mitsubishi|nissan|hyundai|corolla|hilux|fortuner|explorer|ranger|lancer|201[0-9]|202[0-9])\b/.test(query);
        const hasPartNumber = /\b[0-9]{5,}\b/.test(query);
        mode = hasVehicleTerms && !hasPartNumber ? "fitment" : "price";
    }

    // --- 2. PESOS POR MODO ---
    const weights = mode === "fitment" ? {
        fitment: 0.35,
        seo_title: 0.20,
        price: 0.15,
        photos: 0.15,
        logistics: 0.10,
        reputation: 0.05,
    } : {
        price: 0.30,
        seo_title: 0.25,
        photos: 0.20,
        fitment: 0.10,
        attributes: 0.10,
        reputation: 0.05,
    };

    const scores = {};
    const actions = [];

    // --- 3. FITMENT / ATRIBUTOS CRÍTICOS ---
    if (mode === "fitment") {
        const requiredAttrs = ["BRAND", "MODEL", "PART_NUMBER"];
        const ourAttrs = new Set((ourItem.attributes || []).map((a) => a.id));
        const leaderAttrs = new Set((leader.attributes || leader.raw_api_response?.attributes || []).map((a) => a.id));

        const missingCritical = requiredAttrs.filter((a) => !ourAttrs.has(a) && leaderAttrs.has(a));
        const hasAllCritical = missingCritical.length === 0;

        scores.fitment = hasAllCritical ? 100 : Math.max(0, 100 - (missingCritical.length * 30));

        if (missingCritical.includes("BRAND")) {
            actions.push({
                priority: "high",
                type: "attributes",
                action_code: "add_brand",
                detail: "Añade atributo BRAND (Marca del vehículo)",
                impact_estimate: "+20% visibilidad en búsquedas por modelo",
                current_value: "No especificado",
                target_value: leader.attributes?.find((a) => a.id === "BRAND")?.value_name || "OEM",
            });
        }
        if (missingCritical.includes("PART_NUMBER")) {
            const leaderPartNumber = leader.attributes?.find((a) => a.id === "PART_NUMBER")?.value_name
                || leader.raw_api_response?.attributes?.find((a) => a.id === "PART_NUMBER")?.value_name;
            actions.push({
                priority: "high",
                type: "attributes",
                action_code: "add_part_number",
                detail: `Añade el número de parte: ${leaderPartNumber || "OEM"}`,
                impact_estimate: "+15% conversiones (búsquedas específicas)",
                current_value: "No especificado",
                target_value: leaderPartNumber || "Ver líder",
            });
        }
        if (missingCritical.includes("MODEL")) {
            actions.push({
                priority: "medium",
                type: "attributes",
                action_code: "add_model",
                detail: "Añade atributo MODEL (Modelo del vehículo compatible)",
                impact_estimate: "+10% visibilidad en búsquedas por modelo",
            });
        }
    } else {
        // Modo price: solo evaluar atributos técnicos básicos
        const ourAttrs = new Set((ourItem.attributes || []).map((a) => a.id));
        const leaderAttrs = new Set((leader.attributes || leader.raw_api_response?.attributes || []).map((a) => a.id));
        const missingAttrs = [...leaderAttrs].filter((id) => !ourAttrs.has(id));
        const attrCoverage = leaderAttrs.size > 0 ? (ourAttrs.size / leaderAttrs.size) * 100 : 100;
        scores.attributes = Math.min(100, attrCoverage);

        if (missingAttrs.includes("PART_NUMBER")) {
            actions.push({
                priority: "high",
                type: "attributes",
                action_code: "add_part_number",
                detail: "Falta atributo PART_NUMBER (Número de parte OEM)",
                impact_estimate: "+15% búsquedas por OEM",
            });
        }
        if (missingAttrs.includes("BRAND")) {
            actions.push({
                priority: "high",
                type: "attributes",
                action_code: "add_brand",
                detail: "Falta atributo BRAND (Marca del repuesto)",
                impact_estimate: "+10% búsquedas",
            });
        }
    }

    // --- 4. PRECIO ---
    const ourPrice = ourItem.price || ourItem.price_usd || 0;
    const leaderPrice = leader.price_usd || leader.price || 0;
    const priceDiff = ourPrice - leaderPrice;
    const pricePct = leaderPrice > 0 ? (priceDiff / leaderPrice) * 100 : 0;

    if (priceDiff <= 0) {
        scores.price = 100;
    } else if (pricePct <= 5) {
        scores.price = 80;
        actions.push({
            priority: "low",
            type: "price",
            action_code: "adjust_price",
            current_value: ourPrice,
            target_value: leaderPrice,
            detail: `Estás $${priceDiff.toFixed(2)} más caro. Considera igualar para ganar Buy Box.`,
            impact_estimate: "+5% visibilidad",
        });
    } else if (pricePct <= 15) {
        scores.price = 50;
        actions.push({
            priority: "medium",
            type: "price",
            action_code: "reduce_price",
            current_value: ourPrice,
            target_value: parseFloat((leaderPrice * 0.98).toFixed(2)),
            detail: `Baja el precio un ${pricePct.toFixed(0)}% para ser competitivo`,
            impact_estimate: "+15% visibilidad",
        });
    } else {
        scores.price = 20;
        actions.push({
            priority: "high",
            type: "price",
            action_code: "urgent_price_drop",
            current_value: ourPrice,
            target_value: parseFloat((leaderPrice * 0.95).toFixed(2)),
            detail: `¡URGENTE! Estás ${pricePct.toFixed(0)}% más caro que el líder.`,
            impact_estimate: "+25% visibilidad, evita pérdida de posición",
        });
    }

    // --- 5. SEO TÍTULO ---
    let seoScore = 100;
    const ourTitle = ourItem.title || "";
    const leaderTitle = leader.title || "";

    // Longitud óptima MLV: 50-60 caracteres
    if (ourTitle.length < 40) {
        seoScore -= 30;
        actions.push({
            priority: "high",
            type: "seo",
            action_code: "extend_title",
            detail: `Título muy corto (${ourTitle.length} chars). Añade especificaciones técnicas.`,
            current_value: ourTitle.length,
            target_value: 55,
            impact_estimate: "+20% búsquedas",
        });
    } else if (ourTitle.length > 70) {
        seoScore -= 10;
        actions.push({
            priority: "low",
            type: "seo",
            action_code: "shorten_title",
            detail: `Título largo (${ourTitle.length} chars). Optimiza para móviles.`,
            impact_estimate: "+5% clicks móviles",
        });
    }

    // Mayúsculas (penalización fuerte en MLV)
    if (ourTitle === ourTitle.toUpperCase() && ourTitle.length > 0) {
        seoScore -= 40;
        actions.push({
            priority: "high",
            type: "seo",
            action_code: "fix_title_case",
            detail: "Quita las MAYÚSCULAS. Usa formato 'Inicial Mayúscula'.",
            impact_estimate: "+15% profesionalismo",
        });
    }

    // Palabras spam detectadas en nuestro título
    const ourSpam = detectSpamInTitle(ourTitle);
    if (ourSpam.length > 0) {
        seoScore -= 20;
        actions.push({
            priority: "high",
            type: "seo",
            action_code: "remove_spam",
            detail: `Elimina palabras penalizadas: ${ourSpam.join(", ")}`,
            impact_estimate: "+10% visibilidad (evita penalización ML)",
        });
    }

    // Keywords del líder que nosotros no tenemos
    const missingKeywords = extractMissingKeywords(ourTitle, leaderTitle);
    if (missingKeywords.length > 0) {
        seoScore -= 15;
        actions.push({
            priority: "medium",
            type: "seo",
            action_code: "add_keywords",
            detail: `Considera añadir: ${missingKeywords.join(", ")}`,
            impact_estimate: "+10% búsquedas relacionadas",
        });
    }

    scores.seo_title = Math.max(0, seoScore);

    // --- 6. FOTOS ---
    const ourPhotos = ourItem.pictures?.length || ourItem.pictures_count || 0;
    const leaderPhotos = leader.pictures_count || leader.pictures?.length || 0;

    if (ourPhotos >= leaderPhotos && ourPhotos >= 6) {
        scores.photos = 100;
    } else if (ourPhotos >= leaderPhotos) {
        scores.photos = 80;
    } else {
        const diff = leaderPhotos - ourPhotos;
        scores.photos = Math.max(0, 100 - (diff * 15));
        actions.push({
            priority: diff > 3 ? "high" : "medium",
            type: "content",
            action_code: "add_photos",
            current_value: ourPhotos,
            target_value: Math.min(10, leaderPhotos + 1),
            detail: `Añade ${diff} foto(s) más. El líder usa ${leaderPhotos}.`,
            impact_estimate: `+${diff * 5}% clicks`,
        });
    }

    // --- 7. LOGÍSTICA (Pickup zones para MLV) ---
    const leaderZones = leader.logistics_data?.pickup_zones || [];
    const ourZones = ourItem.logistics_data?.pickup_zones || [];

    if (leaderZones.length > 0 && ourZones.length === 0) {
        scores.logistics = 40;
        actions.push({
            priority: "high",
            type: "logistics",
            action_code: "enable_pickup",
            detail: `Habilita pickup en: ${leaderZones.join(", ")}. 80% de ventas MLV son pickup.`,
            impact_estimate: "+30% conversiones locales",
        });
    } else if (leaderZones.length > 0 && ourZones.length < leaderZones.length) {
        scores.logistics = 70;
        actions.push({
            priority: "medium",
            type: "logistics",
            action_code: "expand_pickup",
            detail: `Añade más zonas de pickup. El líder cubre: ${leaderZones.join(", ")}`,
            impact_estimate: "+15% alcance local",
        });
    } else {
        scores.logistics = 90;
    }

    // --- 8. REPUTACIÓN / HEALTH ---
    scores.reputation = 80; // Placeholder, se puede enriquecer con datos reales
    scores.health = ourItem.health_score || 50;

    // --- 9. CÁLCULO TOTAL PONDERADO ---
    const totalScore = Math.round(
        Object.entries(scores).reduce((sum, [key, val]) => {
            return sum + (val * (weights[key] || 0));
        }, 0)
    );

    // --- 10. ORDENAR ACCIONES POR PRIORIDAD ---
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
        mode,
        score_total: totalScore,
        score_breakdown: scores,
        action_plan: actions,
        gaps: {
            price_percent: parseFloat(pricePct.toFixed(2)),
            missing_attributes: mode === "fitment"
                ? ["BRAND", "MODEL", "PART_NUMBER"].filter((a) =>
                    !(ourItem.attributes || []).find((attr) => attr.id === a))
                : [],
            photo_gap: Math.max(0, leaderPhotos - ourPhotos),
            missing_keywords: extractMissingKeywords(ourTitle, leaderTitle),
            spam_words: ourSpam,
        },
    };
}

// ================================================================
// HELPERS INTERNOS
// ================================================================

const HIGH_VALUE_KEYWORDS = [
    "original", "generico", "alterno", "oem",
    "delantero", "trasero", "izquierdo", "derecho", "conductor", "copiloto",
    "amortiguador", "bumper", "guardafango", "faro", "stop", "catalítico",
];

function extractMissingKeywords(ourTitle, leaderTitle) {
    const ourLower = ourTitle.toLowerCase();
    const leaderLower = leaderTitle.toLowerCase();
    return HIGH_VALUE_KEYWORDS.filter((kw) =>
        leaderLower.includes(kw) && !ourLower.includes(kw)
    );
}

const SPAM_WORDS = [
    "remate", "urgente", "ultimo", "!!!!", "oferton",
    "aprovecha", "unico", "liquidacion", "barato", "regalo",
    "imperdible", "ultima unidad", "ultimas unidades", "oferta",
];

function detectSpamInTitle(title) {
    const lower = title.toLowerCase();
    return SPAM_WORDS.filter((w) => lower.includes(w));
}
