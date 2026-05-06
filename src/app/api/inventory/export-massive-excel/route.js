// ================================================================
// src/app/api/inventory/export-massive-excel/route.js
// Genera Excel compatible con Publicación Masiva de MercadoLibre
// ================================================================
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCategoryRequiredAttributes } from "@/lib/meli-categories";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ── Diccionario de expansión de abreviaciones ───────────────────
const ABBREVIATIONS = {
    // Delimitadores exactos con punto o sin punto
    'AMORT.': 'Amortiguador', 'AMORT': 'Amortiguador',
    'DEL.': 'Delantero', 'DEL': 'Delantero',
    'TRAS.': 'Trasero', 'TRAS': 'Trasero',
    'IZQ.': 'Izquierdo', 'IZQ': 'Izquierdo',
    'DER.': 'Derecho', 'DER': 'Derecho',
    'INF.': 'Inferior', 'INF': 'Inferior',
    'SUP.': 'Superior', 'SUP': 'Superior',
    'EXT.': 'Exterior', 'EXT': 'Exterior',
    'INT.': 'Interior', 'INT': 'Interior',
    'SUSP.': 'Suspension', 'SUSP': 'Suspension',
    'T/VALV.': 'Tapa Valvula', 'T/VALV': 'Tapa Valvula',
    'TAPA VALV.': 'Tapa Valvula', 'TAPA VALV': 'Tapa Valvula',
    'VALV.': 'Valvula', 'VALV': 'Valvula',
    'TRANSM.': 'Transmision', 'TRANSM': 'Transmision',
    'MOTOR.': 'Motor', 'MOTOR': 'Motor',
    'ELECT.': 'Electrico', 'ELECT': 'Electrico',
    'ELEC.': 'Electrico', 'ELEC': 'Electrico',
    'CHEV.': 'Chevrolet', 'CHEV': 'Chevrolet',
    'MITS.': 'Mitsubishi', 'MITS': 'Mitsubishi',
    'HYUN.': 'Hyundai', 'HYUN': 'Hyundai',
    'KIA.': 'Kia', 'KIA': 'Kia',
    'TOY.': 'Toyota', 'TOY': 'Toyota',
    'FORD.': 'Ford', 'FORD': 'Ford',
    'HONDA.': 'Honda', 'HONDA': 'Honda',
    'NISS.': 'Nissan', 'NISS': 'Nissan',
    'MAZDA.': 'Mazda', 'MAZDA': 'Mazda',
    'SUZUKI.': 'Suzuki', 'SUZUKI': 'Suzuki',
    'VW.': 'Volkswagen', 'VW': 'Volkswagen',
    'VOLKS.': 'Volkswagen', 'VOLKS': 'Volkswagen',
    'BOMBA.': 'Bomba', 'BOMBA': 'Bomba',
    'AGUA.': 'Agua', 'AGUA': 'Agua',
    'ACEITE.': 'Aceite', 'ACEITE': 'Aceite',
    'FRENO.': 'Freno', 'FRENO': 'Freno',
    'DISCO.': 'Disco', 'DISCO': 'Disco',
    'PASTILLA.': 'Pastilla', 'PASTILLA': 'Pastilla',
    'TAMBOR.': 'Tambor', 'TAMBOR': 'Tambor',
    'COJIN.': 'Cojinete', 'COJIN': 'Cojinete',
    'BUJE.': 'Buje', 'BUJE': 'Buje',
    'RODAM.': 'Rodamiento', 'RODAM': 'Rodamiento',
    'JUNTA.': 'Junta', 'JUNTA': 'Junta',
    'ESTOP.': 'Estoperol', 'ESTOP': 'Estoperol',
    'RETEN.': 'Reten', 'RETEN': 'Reten',
    'FILTRO.': 'Filtro', 'FILTRO': 'Filtro',
    'AIRE.': 'Aire', 'AIRE': 'Aire',
    'COMBUS.': 'Combustible', 'COMBUS': 'Combustible',
    'DIREC.': 'Direccion', 'DIREC': 'Direccion',
    'CAJA.': 'Caja', 'CAJA': 'Caja',
    'DIFER.': 'Diferencial', 'DIFER': 'Diferencial',
    'CARDAN.': 'Cardan', 'CARDAN': 'Cardan',
    'PIÑON.': 'Pinon', 'PIÑON': 'Pinon',
    'CORONA.': 'Corona', 'CORONA': 'Corona',
    'EJE.': 'Eje', 'EJE': 'Eje',
    'PALIER.': 'Palier', 'PALIER': 'Palier',
    'TRIPODE.': 'Tripode', 'TRIPODE': 'Tripode',
    'HOMOC.': 'Homocinetica', 'HOMOC': 'Homocinetica',
    'ROTULA.': 'Rotula', 'ROTULA': 'Rotula',
    'TERMIN.': 'Terminal', 'TERMIN': 'Terminal',
    'BARRA.': 'Barra', 'BARRA': 'Barra',
    'ESTAB.': 'Estabilizadora', 'ESTAB': 'Estabilizadora',
    'BASE.': 'Base', 'BASE': 'Base',
    'SOPORTE.': 'Soporte', 'SOPORTE': 'Soporte',
    'GUARDA.': 'Guardapolvo', 'GUARDA': 'Guardapolvo',
    'POLVO.': 'Polvo', 'POLVO': 'Polvo',
    'FUELLE.': 'Fuelle', 'FUELLE': 'Fuelle',
    'CREMALL.': 'Cremallera', 'CREMALL': 'Cremallera',
    'BOMBIN.': 'Bomba', 'BOMBIN': 'Bomba',
    'CILIND.': 'Cilindro', 'CILIND': 'Cilindro',
    'MAESTRO.': 'Maestro', 'MAESTRO': 'Maestro',
    'ESCLAVO.': 'Esclavo', 'ESCLAVO': 'Esclavo',
    'PEDAL.': 'Pedal', 'PEDAL': 'Pedal',
    'EMBRA.': 'Embrague', 'EMBRA': 'Embrague',
    'CROCHET.': 'Crochet', 'CROCHET': 'Crochet',
    'PLATO.': 'Plato', 'PLATO': 'Plato',
    'DISCO EMB.': 'Disco Embrague', 'DISCO EMB': 'Disco Embrague',
    'PRENSA.': 'Prensa', 'PRENSA': 'Prensa',
    'RULEMAN.': 'Ruleman', 'RULEMAN': 'Ruleman',
    'TENSOR.': 'Tensor', 'TENSOR': 'Tensor',
    'CORREA.': 'Correa', 'CORREA': 'Correa',
    'TIEMP.': 'Tiempo', 'TIEMP': 'Tiempo',
    'MULTI.': 'Multiple', 'MULTI': 'Multiple',
    'V.': '',  // evitar reemplazar V. suelto
    'V': '',
};

function expandAbbreviations(text) {
    if (!text) return '';
    let result = String(text);
    // Ordenar por longitud descendente para evitar reemplazos parciales
    const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        result = result.replace(regex, ABBREVIATIONS[key]);
    }
    // Limpiar espacios dobles
    result = result.replace(/\s+/g, ' ').trim();
    return result;
}

// ── Optimizador de títulos ──────────────────────────────────────
function optimizeTitle(rawTitle) {
    if (!rawTitle) return '';

    // Expandir abreviaciones
    let title = expandAbbreviations(rawTitle);

    // Title Case
    title = title.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    // Eliminar espacios extra
    title = title.replace(/\s+/g, ' ').trim();

    // Truncar a 60 si es necesario
    if (title.length > 60) {
        title = title.substring(0, 57).trim();
        // Evitar cortar a mitad de palabra
        const lastSpace = title.lastIndexOf(' ');
        if (lastSpace > 40) title = title.substring(0, lastSpace);
    }

    return title;
}

// ── Helpers Excel ───────────────────────────────────────────────
function buildBaseRow(item, photoUrls) {
    return {
        'Grupo Interno (Sublínea)': item.subcategory || 'SIN CATEGORÍA',
        'Título': optimizeTitle(item.title),
        'Cantidad de caracteres': optimizeTitle(item.title).length,
        'Condición': 'Nuevo',
        'Fotos': photoUrls.length > 0 ? photoUrls.join(',') : '',
        'SKU': item.sku,
        'Stock': item.stock || 1,
        'Precio [US$]': item.price || 0,
        'Descripción': `Producto Original. SKU: ${item.sku}. Código OEM: ${item.oem || 'N/A'}.`,
        'Tipo de publicación': 'Premium',
        'Cargo por venta': '-',
        'Forma de envío': 'Mercado Envíos',
        'Costo de envío': 'Envío gratis',
        'Retiro en persona': 'Acepto',
        'Tipo de garantía': 'Garantía del vendedor',
        'Tiempo de garantía': '30',
        'Unidad de Tiempo de garantía': 'días',
        'Marca': item.brand && item.brand !== 'Genérico' ? item.brand : 'Genérico',
        'Número de pieza': item.oem || item.sku,
    };
}

function sheetNameFromCategory(catName) {
    // Limpiar nombre para que sea válido como nombre de pestaña Excel (max 31 chars)
    return (catName || 'SIN_CATEGORIA')
        .replace(/[\\/*?[\]:]/g, '')
        .substring(0, 31);
}

// ── Main POST Handler ───────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { accountId, filters = {} } = body;

        if (!accountId) {
            return NextResponse.json({ error: 'Se requiere accountId' }, { status: 400 });
        }

        // 1. Leer caché de auditoría maestra
        const cachePath = path.join(process.cwd(), `.audit_cache_master_${accountId}.json`);
        if (!fs.existsSync(cachePath)) {
            return NextResponse.json({ error: 'No hay auditoría maestra en caché. Ejecuta una auditoría primero.' }, { status: 400 });
        }

        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        let missingItems = cacheData.missing || [];

        if (missingItems.length === 0) {
            return NextResponse.json({ error: 'No hay productos faltantes para exportar.' }, { status: 400 });
        }

        // 2. Aplicar filtros
        if (filters.withStock) {
            missingItems = missingItems.filter(i => (i.stock || 0) > 0);
        }

        if (filters.limit && filters.limit > 0) {
            missingItems = missingItems.slice(0, filters.limit);
        }

        // 3. Obtener SubLíneas de Supabase
        const allSkus = missingItems.map(i => i.sku);
        const skuSubcategoryMap = {};
        const BATCH_SIZE = 1000;

        if (allSkus.length > 0) {
            for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
                const batchSkus = allSkus.slice(i, i + BATCH_SIZE);
                const { data: invData, error: invError } = await supabaseAdmin
                    .from('internal_inventory')
                    .select('sku, subcategory')
                    .in('sku', batchSkus);

                if (!invError && invData) {
                    invData.forEach(row => {
                        skuSubcategoryMap[row.sku] = row.subcategory || 'SIN CATEGORÍA';
                    });
                }
            }
        }

        // Asignar subcategory a cada item
        missingItems = missingItems.map(item => ({
            ...item,
            subcategory: skuSubcategoryMap[item.sku] || 'SIN CATEGORÍA',
        }));

        // 4. Obtener mapeos de categorías
        const uniqueSubcategories = [...new Set(missingItems.map(i => i.subcategory))];
        const subcategoryToMlCat = {};

        for (const sub of uniqueSubcategories) {
            const { data: mapping } = await supabaseAdmin
                .from('category_mappings')
                .select('ml_category_id, ml_category_name')
                .ilike('internal_name', sub)
                .limit(1)
                .single();

            subcategoryToMlCat[sub] = mapping || { ml_category_id: null, ml_category_name: 'SIN_CATEGORIA' };
        }

        // 5. Mapeo de Fotos
        const skuPhotoMap = {};
        // Siempre obtenemos las fotos para el Excel, independientemente del filtro
        if (allSkus.length > 0) {
            for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
                const batchSkus = allSkus.slice(i, i + BATCH_SIZE);
                const { data: photoData } = await supabaseAdmin
                    .from('image_bank')
                    .select('sku, ml_url, ml_picture_id')
                    .in('sku', batchSkus)
                    .eq('sync_status', 'synced')
                    .order('image_index', { ascending: true });

                if (photoData) {
                    photoData.forEach(p => {
                        if (!skuPhotoMap[p.sku]) skuPhotoMap[p.sku] = [];
                        const photoUrl = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
                        if (photoUrl) skuPhotoMap[p.sku].push(photoUrl);
                    });
                }
            }
        }

        // Aplicar filtro de fotos si se solicita
        if (filters.withPhotos) {
            missingItems = missingItems.filter(i => skuPhotoMap[i.sku] && skuPhotoMap[i.sku].length > 0);
        }

        if (missingItems.length === 0) {
            return NextResponse.json({ error: 'No hay productos que cumplan los filtros seleccionados.' }, { status: 400 });
        }

        // 6. Agrupar por categoría ML
        const groups = {};
        for (const item of missingItems) {
            const mlCat = subcategoryToMlCat[item.subcategory];
            const catKey = mlCat?.ml_category_id || 'SIN_CATEGORIA';
            const catName = mlCat?.ml_category_name || 'SIN CATEGORÍA';

            if (!groups[catKey]) {
                groups[catKey] = { name: catName, items: [], categoryId: mlCat?.ml_category_id };
            }
            groups[catKey].items.push(item);
        }

        // 7. Obtener atributos de categorías (solo las que tienen categoryId válido)
        const categoryAttributes = {};
        for (const [catKey, group] of Object.entries(groups)) {
            if (group.categoryId && group.categoryId.startsWith('MLV')) {
                try {
                    const attrs = await getCategoryRequiredAttributes(group.categoryId);
                    categoryAttributes[catKey] = attrs;
                } catch (e) {
                    categoryAttributes[catKey] = [];
                }
            } else {
                categoryAttributes[catKey] = [];
            }
        }

        // 8. Construir el workbook
        const workbook = XLSX.utils.book_new();

        // Pestaña Ayuda (igual que la plantilla oficial de ML)
        const ayudaData = [
            ['Ayudas para completar la planilla'],
            [''],
            ['Publica varios productos a la vez'],
            [''],
            ['Completa los datos de lo que quieras vender.'],
            [''],
            ['Colores de las celdas'],
            ['Las celdas grises no las debes completar, lo haremos por ti.'],
            ['Si publicas usando datos del catálogo, este color marca aquellas celdas que completaremos por ti.'],
            ['Las celdas rojas indican que hay un error o que falta un dato.'],
            ['Revisa la información de ayuda en la parte superior de cada columna para corregir o completar el dato.'],
            [''],
            ['Links útiles'],
            ['Gestor de fotos: https://www.mercadolibre.com.ve/gestion_de_fotos'],
            ['Subir planilla: https://www.mercadolibre.com.ve/publicar-masivamente/upload'],
        ];
        const ayudaSheet = XLSX.utils.aoa_to_sheet(ayudaData);
        XLSX.utils.book_append_sheet(workbook, ayudaSheet, 'Ayuda');

        // 9. Pestaña de Resumen General (Vista Plana)
        const flatData = [];
        const flatHeaders = [
            'SKU', 
            'Título', 
            'ID Categoría', 
            'Ruta Categoría (Breadcrumb)', 
            'Precio [US$]', 
            'Stock', 
            'Fotos',
            'Forma de envío',
            'Costo de envío',
            'Tipo de garantía',
            'Tiempo de garantía',
            'Unidad de Tiempo de garantía',
            'Marca', 
            'Número de pieza',
            'Grupo Interno (Sublínea)'
        ];
        flatData.push(flatHeaders);

        for (const item of missingItems) {
            const mlCat = subcategoryToMlCat[item.subcategory];
            const photoUrls = skuPhotoMap[item.sku] || [];
            flatData.push([
                item.sku,
                optimizeTitle(item.title),
                mlCat?.ml_category_id || 'N/A',
                mlCat?.ml_category_name || 'SIN CATEGORÍA',
                item.price || 0,
                item.stock || 0,
                photoUrls.join(','),
                'Mercado Envíos',
                'Envío gratis',
                'Garantía del vendedor',
                '30',
                'días',
                item.brand || 'Genérico',
                item.oem || item.sku,
                item.subcategory || 'SIN CATEGORÍA'
            ]);
        }

        const flatSheet = XLSX.utils.aoa_to_sheet(flatData);
        // Ajustar anchos
        flatSheet['!cols'] = [
            { wch: 15 }, // SKU
            { wch: 50 }, // Título
            { wch: 15 }, // ID Cat
            { wch: 80 }, // Ruta Cat
            { wch: 12 }, // Precio
            { wch: 10 }, // Stock
            { wch: 80 }, // Fotos
            { wch: 20 }, // Forma envío
            { wch: 20 }, // Costo envío
            { wch: 20 }, // Tipo garantía
            { wch: 15 }, // Tiempo
            { wch: 15 }, // Unidad
            { wch: 20 }, // Marca
            { wch: 20 }, // Pieza
            { wch: 25 }  // Sublínea
        ];
        XLSX.utils.book_append_sheet(workbook, flatSheet, 'Resumen_General');

        // 10. Una pestaña por categoría
        for (const [catKey, group] of Object.entries(groups)) {
            const sheetRows = [];
            const attrs = categoryAttributes[catKey] || [];

            // Headers base + atributos de categoría
            const baseHeaders = [
                'Grupo Interno (Sublínea)', 'Título', 'Cantidad de caracteres', 'Condición', 'Fotos', 'SKU',
                'Stock', 'Precio [US$]', 'Descripción', 'Tipo de publicación',
                'Cargo por venta', 'Forma de envío', 'Costo de envío',
                'Retiro en persona', 'Tipo de garantía', 'Tiempo de garantía',
                'Unidad de Tiempo de garantía', 'Marca', 'Número de pieza'
            ];

            const attrHeaders = attrs.map(a => a.name);
            const allHeaders = [...baseHeaders, ...attrHeaders];

            // Fila 1: breadcrumb de categoría (3 veces para compatibilidad con plantilla ML)
            const catBreadcrumbRow = [group.name, group.name, group.name, ...new Array(allHeaders.length - 3).fill('')];
            sheetRows.push(catBreadcrumbRow);

            // Fila 2: nombre de categoría
            const catNameRow = [group.name, group.name, group.name, ...new Array(allHeaders.length - 3).fill('')];
            sheetRows.push(catNameRow);

            // Fila 3: headers reales
            sheetRows.push(allHeaders);

            // Fila 4: obligatorio / descripción
            const requiredRow = allHeaders.map(h => {
                if (['Título', 'Condición', 'Fotos', 'Stock', 'Precio [US$]', 'Tipo de publicación', 'Forma de envío', 'Costo de envío', 'Retiro en persona', 'Marca'].includes(h)) return 'Obligatorio';
                return '';
            });
            sheetRows.push(requiredRow);

            // Filas de datos
            for (const item of group.items) {
                const photoUrls = skuPhotoMap[item.sku] || [];
                const baseRow = buildBaseRow(item, photoUrls);

                // Atributos de categoría con autocompletado inteligente
                const attrRow = {};
                attrs.forEach(a => { 
                    let val = '';
                    const nameLower = (a.name || '').toLowerCase();
                    
                    if (nameLower.includes('volumen')) {
                        val = '1 L';
                    } else if (nameLower.includes('peso')) {
                        val = '1 kg';
                    } else if (nameLower.includes('marca')) {
                        val = item.brand || 'Genérico';
                    } else if (a.values && a.values.length > 0) {
                        val = a.values[0].name;
                    } else {
                        val = 'Genérico';
                    }
                    
                    attrRow[a.name] = val;
                });

                const fullRow = {};
                allHeaders.forEach(h => {
                    fullRow[h] = baseRow[h] !== undefined ? baseRow[h] : attrRow[h] || '';
                });

                sheetRows.push(allHeaders.map(h => fullRow[h]));
            }

            const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

            // Ajustar anchos de columna
            worksheet['!cols'] = allHeaders.map(h => ({
                wch: h === 'Título' ? 50 : h === 'Descripción' ? 60 : h === 'Fotos' ? 80 : 20
            }));

            let safeSheetName = sheetNameFromCategory(group.name);
            
            // Asegurar que el nombre sea único en el libro (Workbook)
            let counter = 1;
            const originalName = safeSheetName;
            while (workbook.SheetNames.includes(safeSheetName)) {
                counter++;
                // Los nombres de pestañas en Excel tienen un límite de 31 caracteres
                const suffix = ` (${counter})`;
                safeSheetName = originalName.substring(0, 31 - suffix.length) + suffix;
            }

            XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
        }

        // 10. Generar buffer y responder
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `Publicacion_Masiva_ML_${timestamp}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('❌ Export Massive Excel Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
