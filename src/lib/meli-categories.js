lgu================================================================
// src/lib/meli-categories.js
// Módulo de Mapeo de Categorías Internas → MercadoLibre
// Usa domain_discovery y attributes de la API oficial de ML
// ================================================================

const MELI_BASE_URL = "https://api.mercadolibre.com";

/**
 * Sugiere la categoría de MercadoLibre más adecuada para un título/producto.
 * Fuente: GET /sites/MLV/domain_discovery/search?q={query}
 */
export async function suggestCategoryByTitle(title, limit = 3) {
    if (!title || typeof title !== "string") {
        throw new Error("Se requiere un título válido para sugerir categoría");
    }

    const url = `${MELI_BASE_URL}/sites/MLV/domain_discovery/search?limit=${limit}&q=${encodeURIComponent(title)}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`ML Domain Discovery Error: ${err.message || res.status}`);
    }

    const data = await res.json();

    // Normalizar respuesta
    return data.map((item) => ({
        domain_id: item.domain_id,
        domain_name: item.domain_name,
        category_id: item.category_id,
        category_name: item.category_name,
        attributes: item.attributes || [],
    }));
}

/**
 * Obtiene los atributos obligatorios de una categoría específica.
 * Fuente: GET /categories/{category_id}/attributes
 * Filtra solo los que tienen tags.required = true
 */
export async function getCategoryRequiredAttributes(categoryId) {
    if (!categoryId) return [];

    try {
        const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}/attributes`, {
            cache: "no-store",
        });

        if (!res.ok) return [];

        const attributes = await res.json();
        return attributes.filter(
            (a) => a.tags && (a.tags.required || a.tags.catalog_required)
        );
    } catch (err) {
        console.error("Error obteniendo atributos de categoría:", err);
        return [];
    }
}

/**
 * Obtiene información completa de una categoría (settings, paths, etc.)
 * Fuente: GET /categories/{category_id}
 */
export async function getCategoryInfo(categoryId) {
    if (!categoryId) return null;

    try {
        const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}`, {
            cache: "no-store",
        });

        if (!res.ok) return null;
        return res.json();
    } catch (err) {
        console.error("Error obteniendo info de categoría:", err);
        return null;
    }
}

/**
 * Verifica si una categoría es "hoja" (leaf) del árbol.
 * Solo se puede publicar en categorías hoja.
 */
export function isLeafCategory(categoryInfo) {
    if (!categoryInfo) return false;
    // Una categoría hoja no tiene children_categories o está vacía
    return !categoryInfo.children_categories || categoryInfo.children_categories.length === 0;
}

/**
 * Obtiene los sale_terms (garantía, etc.) disponibles para una categoría.
 * Fuente: GET /categories/{category_id}/sale_terms
 */
export async function getCategorySaleTerms(categoryId) {
    if (!categoryId) return [];

    try {
        const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}/sale_terms`, {
            cache: "no-store",
        });

        if (!res.ok) return [];
        return res.json();
    } catch (err) {
        console.error("Error obteniendo sale terms:", err);
        return [];
    }
}

/**
 * Flujo completo de validación pre-publicación:
 * 1. Sugiere categoría por título (si no hay mapeo)
 * 2. Obtiene atributos obligatorios
 * 3. Verifica que sea categoría hoja
 * 4. Obtiene sale_terms relevantes
 */
export async function validateCategoryForPublish({
    title,
    categoryId,
    useDomainDiscovery = true,
}) {
    const result = {
        category_id: categoryId,
        category_suggestions: [],
        required_attributes: [],
        sale_terms: [],
        is_valid: false,
        is_leaf: false,
        errors: [],
        warnings: [],
    };

    try {
        // Si no hay categoryId pero hay título, sugerir
        if (!categoryId && title && useDomainDiscovery) {
            result.category_suggestions = await suggestCategoryByTitle(title, 3);
            if (result.category_suggestions.length > 0) {
                result.category_id = result.category_suggestions[0].category_id;
                result.warnings.push(
                    `Categoría sugerida automáticamente: ${result.category_suggestions[0].category_name}`
                );
            } else {
                result.errors.push("No se pudo sugerir una categoría para el título proporcionado");
                return result;
            }
        }

        if (!result.category_id) {
            result.errors.push("Se requiere category_id o un título válido para sugerir categoría");
            return result;
        }

        // Obtener info de la categoría
        const catInfo = await getCategoryInfo(result.category_id);
        if (!catInfo) {
            result.errors.push(`La categoría ${result.category_id} no existe en MercadoLibre`);
            return result;
        }

        result.is_leaf = isLeafCategory(catInfo);
        if (!result.is_leaf) {
            result.errors.push(
                `La categoría ${catInfo.name} no es una categoría hoja. Debes seleccionar una subcategoría.`
            );
        }

        // Obtener atributos obligatorios
        result.required_attributes = await getCategoryRequiredAttributes(result.category_id);

        // Obtener sale terms
        result.sale_terms = await getCategorySaleTerms(result.category_id);

        // Determinar validez
        result.is_valid = result.is_leaf && result.errors.length === 0;

        return result;
    } catch (err) {
        result.errors.push(`Error en validación: ${err.message}`);
        return result;
    }
}

/**
 * Mapea una SubLínea interna a una categoría de ML usando la tabla category_mappings.
 * Si no existe mapeo, sugiere una usando domain_discovery.
 * Requiere cliente de Supabase.
 */
export async function resolveCategoryForSubline(supabase, { lineCode, sublineCode, sublineName, title }) {
    const result = {
        mapping: null,
        category_id: null,
        category_name: null,
        is_validated: false,
        suggestions: [],
        required_attributes: [],
    };

    try {
        // 1. Buscar mapeo existente
        const { data: mapping, error: mapError } = await supabase
            .from("category_mappings")
            .select("*")
            .eq("internal_line_code", lineCode)
            .eq("internal_subline_code", sublineCode)
            .single();

        if (!mapError && mapping) {
            result.mapping = mapping;
            result.category_id = mapping.ml_category_id;
            result.category_name = mapping.ml_category_name;
            result.is_validated = mapping.is_validated;
        }

        // 2. Si no hay mapeo válido, sugerir por nombre o título
        if (!result.category_id) {
            const query = sublineName || title;
            if (query) {
                result.suggestions = await suggestCategoryByTitle(query, 3);
                if (result.suggestions.length > 0) {
                    result.category_id = result.suggestions[0].category_id;
                    result.category_name = result.suggestions[0].category_name;
                }
            }
        }

        // 3. Si tenemos categoría, obtener atributos obligatorios
        if (result.category_id) {
            result.required_attributes = await getCategoryRequiredAttributes(result.category_id);
        }

        return result;
    } catch (err) {
        console.error("Error resolviendo categoría:", err);
        return result;
    }
}

/**
 * Guarda un mapeo de categoría en Supabase (para validación manual del usuario)
 */
export async function saveCategoryMapping(supabase, {
    lineCode,
    sublineCode,
    sublineName,
    mlCategoryId,
    mlCategoryName,
    mlDomainId,
    mlDomainName,
    validatedBy,
}) {
    const { data, error } = await supabase
        .from("category_mappings")
        .upsert({
            internal_line_code: lineCode,
            internal_subline_code: sublineCode,
            internal_name: sublineName,
            ml_category_id: mlCategoryId,
            ml_category_name: mlCategoryName,
            ml_domain_id: mlDomainId,
            ml_domain_name: mlDomainName,
            is_validated: true,
            validated_by: validatedBy,
            validated_at: new Date().toISOString(),
        }, {
            onConflict: "internal_line_code,internal_subline_code",
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}
