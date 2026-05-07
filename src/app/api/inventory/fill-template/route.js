
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCategoryInfo, getCategoryRequiredAttributes } from "@/lib/meli-categories";

export const maxDuration = 300;

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const accountId = formData.get("accountId");

        if (!file || !accountId) {
            return NextResponse.json({ error: "Faltan datos (archivo o accountId)" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: "buffer" });

        // 1. Identificar la hoja de datos (buscamos la que no es Ayuda ni extra info)
        const dataSheetName = workbook.SheetNames.find(name => name !== 'Ayuda' && name !== 'extra info');
        if (!dataSheetName) {
            return NextResponse.json({ error: "No se encontró una hoja de datos válida en la plantilla" }, { status: 400 });
        }

        const worksheet = workbook.Sheets[dataSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 2. Extraer categoría de la plantilla (Fila 0 breadcrumb o Fila 1 nombre)
        let mlCategoryName = rawRows[1] && rawRows[1][0] ? String(rawRows[1][0]).trim() : null;
        
        // Si no hay en fila 1, intentar extraer el último segmento de la fila 0 (breadcrumb)
        if (!mlCategoryName && rawRows[0] && rawRows[0][1]) {
            const breadcrumb = String(rawRows[0][1]);
            const parts = breadcrumb.split(' > ');
            mlCategoryName = parts[parts.length - 1].trim();
        }

        if (!mlCategoryName) {
            return NextResponse.json({ error: "No se pudo identificar la categoría en la plantilla (Revisar Filas 0 y 1)" }, { status: 400 });
        }

        // 3. Buscar mapeos (Búsqueda flexible por nombre de categoría ML)
        const { data: mappings } = await supabaseAdmin
            .from('category_mappings')
            .select('internal_subline_code, internal_name, ml_category_id')
            .or(`ml_category_name.ilike.%${mlCategoryName}%,internal_name.ilike.%${mlCategoryName}%`);

        if (!mappings || mappings.length === 0) {
            return NextResponse.json({ error: `No hay mapeos configurados para la categoría: ${mlCategoryName}. Por favor mapea primero tus sublíneas a esta categoría en el panel de Configuración.` }, { status: 400 });
        }

        const sublineNames = mappings.map(m => m.internal_name.toUpperCase());
        const sublineCodes = mappings.map(m => m.internal_subline_code);

        // 4. Obtener SKUs ya publicados para esta cuenta para excluirlos
        const { data: publishedItems } = await supabaseAdmin
            .from('publications')
            .select('sku')
            .eq('account_id', accountId);
        
        const publishedSkus = new Set(publishedItems?.map(p => p.sku) || []);

        // 5. Obtener productos de Profit
        const { data: items } = await supabaseAdmin
            .from('internal_inventory')
            .select('*')
            .or(`subcategory.in.(${sublineNames.map(s => `"${s}"`).join(',')})`)
            .gt('stock', 0)
            .limit(2000);

        if (!items || items.length === 0) {
            return NextResponse.json({ error: "No hay productos con stock en Profit para esta categoría" }, { status: 400 });
        }

        // Filtrar los que ya están publicados
        const missingItems = items.filter(item => !publishedSkus.has(item.sku));

        if (missingItems.length === 0) {
            return NextResponse.json({ error: "Todos los productos de esta categoría ya están publicados en esta cuenta." }, { status: 400 });
        }

        // 6. Mapeo de Fotos
        const allSkus = missingItems.map(i => i.sku);
        const { data: photoData } = await supabaseAdmin
            .from('image_bank')
            .select('sku, ml_url, ml_picture_id')
            .in('sku', allSkus)
            .eq('sync_status', 'synced');

        const skuPhotoMap = {};
        if (photoData) {
            photoData.forEach(p => {
                if (!skuPhotoMap[p.sku]) skuPhotoMap[p.sku] = [];
                const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
                if (url) skuPhotoMap[p.sku].push(url);
            });
        }

        // 7. Configuración de SEO y Descripción
        const descriptionFooter = `
--------------------------------------------------
🏢 TIENDA OFICIAL - CALIDAD GARANTIZADA
--------------------------------------------------
✅ PRODUCTO 100% ORIGINAL Y NUEVO
✅ FACTURA FISCAL DISPONIBLE
✅ ENVIOS GRATIS A TODO EL PAIS (MRW, ZOOM, TEALCA)
✅ RETIRO EN PERSONA (VALENCIA / CARACAS)

⚠️ IMPORTANTE: 
Por favor verifique la compatibilidad con su vehículo antes de ofertar. 
Realice todas sus preguntas, estamos para servirle.
`;

        const ABBREVIATIONS = {
            'AMORT.': 'AMORTIGUADOR', 'AMORT': 'AMORTIGUADOR',
            'DEL.': 'DELANTERO', 'DEL': 'DELANTERO',
            'TRAS.': 'TRASERO', 'TRAS': 'TRASERO',
            'IZQ.': 'IZQUIERDO', 'IZQ': 'IZQUIERDO',
            'DER.': 'DERECHO', 'DER': 'DERECHO',
            'SUP.': 'SUPERIOR', 'SUP': 'SUPERIOR',
            'INF.': 'INFERIOR', 'INF': 'INFERIOR',
            'ART.': 'ARTICULO', 'ART': 'ARTICULO',
            'DESC.': 'DESCRIPCION', 'DESC': 'DESCRIPCION',
            'PAST.': 'PASTILLAS', 'PAST': 'PASTILLAS',
            'BOMB.': 'BOMBA', 'BOMB': 'BOMBA',
            'BUJ.': 'BUJE', 'BUJ': 'BUJE',
            'ROT.': 'ROTULA', 'ROT': 'ROTULA',
            'TERM.': 'TERMINAL', 'TERM': 'TERMINAL',
            'KIT.': 'KIT', 'KIT': 'KIT',
            'EMP.': 'EMPACADURA', 'EMP': 'EMPACADURA',
            'ESTOP.': 'ESTOPERA', 'ESTOP': 'ESTOPERA',
            'ROD.': 'RODAMIENTO', 'ROD': 'RODAMIENTO',
            'CHEV.': 'CHEVROLET', 'CHEV': 'CHEVROLET',
            'TOY.': 'TOYOTA', 'TOY': 'TOYOTA',
            'MIT.': 'MITSUBISHI', 'MIT': 'MITSUBISHI',
            'HYU.': 'HYUNDAI', 'HYU': 'HYUNDAI',
            'FOR.': 'FORD', 'FOR': 'FORD',
            'MAZ.': 'MAZDA', 'MAZ': 'MAZDA',
            'REN.': 'RENAULT', 'REN': 'RENAULT'
        };

        // 7. Configuración de SEO, Descripción y División de Títulos
        const VEHICLE_MODELS = [
            'FIESTA', 'ECOSPORT', 'AVEO', 'CORSA', 'VITARA', 'OPTRA', 'SPARK', 'CRUZE', 'ORLANDO', 
            'LUV DMAX', 'D-MAX', 'KADETT', 'MONZA', 'SILVERADO', 'TAHOE', 'GRAND VITARA', 'SWIFT', 
            'ESTEEM', 'JIMNY', 'SAMURAI', 'EXPLORER', 'FOCUS', 'FUSION', 'RANGER', 'TRITON', 'HILUX',
            'COROLLA', 'YARIS', 'FORTUNER', 'CELICA', 'CAMRY', 'TERIOS', 'MERU', 'PRADO', 'BORA', 'GOL'
        ];

        const descriptionFooter = `
--------------------------------------------------
🏢 TIENDA OFICIAL - CALIDAD GARANTIZADA
--------------------------------------------------
✅ PRODUCTO 100% ORIGINAL Y NUEVO
✅ FACTURA FISCAL DISPONIBLE
✅ ENVIOS GRATIS A TODO EL PAIS (MRW, ZOOM, TEALCA)
✅ RETIRO EN PERSONA (VALENCIA / CARACAS)
        const optimizeSEO = (title) => {
            let seoTitle = String(title).toUpperCase();
            const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
            const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            // Usamos \b al inicio y un lookahead para el final que acepte punto o espacio
            const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
            
            seoTitle = seoTitle.replace(regex, (matched) => {
                const upperMatched = matched.toUpperCase();
                const expansion = ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'];
                return expansion ? expansion : matched;
            });

            seoTitle = seoTitle
                .replace(/[,()]/g, "")
                .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
                .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE/gi, "")
                .replace(/\s+/g, " ")
                .trim();
            
            return seoTitle.substring(0, 60).trim();
        };

        const getSplitTitles = (rawTitle) => {
            const cleanTitle = String(rawTitle).toUpperCase().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
            let findings = [];
            VEHICLE_MODELS.forEach(model => {
                let pos = cleanTitle.indexOf(model);
                while (pos !== -1) {
                    // Verificar que sea palabra completa
                    const isStart = pos === 0 || cleanTitle[pos-1] === ' ';
                    const isEnd = pos + model.length === cleanTitle.length || cleanTitle[pos + model.length] === ' ';
                    if (isStart && isEnd) {
                        findings.push({ model, pos });
                    }
                    pos = cleanTitle.indexOf(model, pos + 1);
                }
            });

            findings.sort((a, b) => a.pos - b.pos);
            if (findings.length <= 1) return [rawTitle];

            const firstModelPos = findings[0].pos;
            const prefix = cleanTitle.substring(0, firstModelPos).trim();
            
            // Intentar capturar un sufijo (info después del último modelo)
            // Por simplicidad, tomamos lo que sobre del último segmento
            let segments = [];
            for (let i = 0; i < findings.length; i++) {
                const start = findings[i].pos;
                const end = (i + 1 < findings.length) ? findings[i+1].pos : cleanTitle.length;
                segments.push(cleanTitle.substring(start, end).trim());
            }

            return segments.map(seg => `${prefix} ${seg}`.trim());
        };

        // 8. Rellenar la plantilla
        const headers = rawRows[2]; 
        const filledRows = [...rawRows.slice(0, 4)]; 

        for (const item of missingItems) {
            const variantTitles = getSplitTitles(item.title);
            
            for (const vTitle of variantTitles) {
                const row = headers.map(h => {
                    const header = String(h || "").toLowerCase();
                    if (header.includes('título')) return optimizeSEO(vTitle);
                    if (header.includes('sku')) return item.sku;
                    if (header.includes('stock')) return item.stock;
                    if (header.includes('precio')) return item.price;
                    if (header.includes('fotos')) return (skuPhotoMap[item.sku] || []).join(',');
                    if (header.includes('descripción')) {
                        const mainDesc = `Producto Original. \nSKU: ${item.sku}. \nOEM: ${item.oem || 'N/A'}. \nMarca: ${item.brand || 'Genérico'}.\n\nAplicación: ${vTitle}`;
                        return mainDesc + descriptionFooter;
                    }
                    if (header.includes('condición')) return 'Nuevo';
                    if (header.includes('marca')) return item.brand || 'Genérico';
                    if (header.includes('número de pieza')) return item.oem || item.sku;
                    if (header.includes('tipo de publicación')) return 'Premium';
                    if (header.includes('forma de envío')) return 'Mercado Envíos';
                    if (header.includes('costo de envío')) return 'Envío gratis';
                    if (header.includes('retiro en persona')) return 'Acepto';
                    if (header.includes('tipo de garantía')) return 'Garantía del vendedor';
                    if (header.includes('tiempo de garantía')) return '30';
                    if (header.includes('unidad de tiempo de garantía')) return 'días';
                    return "";
                });
                filledRows.push(row);
            }
        }

        const newWorksheet = XLSX.utils.aoa_to_sheet(filledRows);
        workbook.Sheets[dataSheetName] = newWorksheet;

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${file.name}"`,
            },
        });

    } catch (error) {
        console.error('❌ Fill Template Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
