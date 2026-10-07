// ================================================================
// src/app/api/profit/missing/export/route.js
// Exportación a Excel de artículos faltantes por lote o sublínea completa
// Usa exactamente las reglas de SEO y plantilla de ML_Desktop_Publisher
// Genera Libro con 2 Hojas:
//   1. "Publicar en Mercado Libre" (Listo para carga masiva oficial)
//   2. "Ficha Profit y Auditoría" (Datos internos, costos y equivalencias)
// ================================================================
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getMissingItemsBySubline } from '@/modules/profit/missing-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const co_subl = searchParams.get('co_subl');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = searchParams.get('limit') === 'all' ? 'all' : parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const photoFilter = searchParams.get('photoFilter') || 'all';

    if (!co_subl) {
      return NextResponse.json(
        { success: false, error: 'Parámetro co_subl requerido' },
        { status: 400 }
      );
    }

    const data = await getMissingItemsBySubline(co_subl, {
      page,
      limit,
      search,
      photoFilter,
    });

    // 1. Hoja "Publicar en Mercado Libre" (Formato exacto de ML_Desktop_Publisher)
    const meliRows = data.items.map((item) => ({
      'Título': item.titulo_seo || item.descripcion,
      'Condición': 'Nuevo',
      'Fotos': item.photo_filename || '',
      'SKU': item.sku,
      'Stock': item.stock_total || 0,
      'Precio [US$]': item.precio || 0,
      'Descripción': item.descripcion_ml,
      'Tipo de publicación': 'Premium',
      'Forma de envío': 'Mercado Envíos',
      'Costo de envío': 'Envío gratis',
      'Retiro en persona': 'Acepto',
      'Tipo de garantía': 'Garantía del vendedor',
      'Tiempo de garantía': '90',
      'Unidad de tiempo de garantía': 'días',
      'Marca': item.brand_suggested || 'Genérico',
      'Número de pieza': item.oem || item.sku,
      'Origen': 'Importado',
    }));

    // 2. Hoja "Ficha Profit y Auditoría" (Para control interno)
    const auditRows = data.items.map((item) => ({
      'SKU Oficial (Profit co_art)': item.sku,
      'Título Profit Original': item.descripcion,
      'Título Optimizado Mercado Libre': item.titulo_seo,
      'Modelo / Aplicación': item.modelo || '',
      'Tipo / Marca': item.brand_suggested,
      'Referencia': item.referencia || '',
      'Código OEM (Campo 7)': item.campo7 || '',
      'Alterno 2 (Campo 6)': item.campo6 || '',
      'Equivalencias y Cruces': (item.equivalencias || []).join(', '),
      'Stock Disponible': item.stock_total,
      'Precio Venta (USD)': item.precio,
      'Costo (USD)': item.costo_usd,
      'Tiene Foto Local': item.has_photo ? 'SÍ' : 'NO',
      'Cant. Fotos': item.photos_count,
      'Archivo Foto Principal': item.photo_filename || '',
      'Sublínea': item.sublinea,
      'Código Sublínea': item.co_subl,
    }));

    const workbook = XLSX.utils.book_new();

    // Crear Hoja 1
    const wsMeli = XLSX.utils.json_to_sheet(meliRows);
    wsMeli['!cols'] = [
      { wch: 55 }, // Título
      { wch: 12 }, // Condición
      { wch: 25 }, // Fotos
      { wch: 18 }, // SKU
      { wch: 10 }, // Stock
      { wch: 14 }, // Precio
      { wch: 45 }, // Descripción
      { wch: 20 }, // Tipo publicación
      { wch: 16 }, // Forma envío
      { wch: 14 }, // Costo envío
      { wch: 16 }, // Retiro persona
      { wch: 22 }, // Tipo garantía
      { wch: 18 }, // Tiempo garantía
      { wch: 25 }, // Unidad garantía
      { wch: 22 }, // Marca
      { wch: 22 }, // Número de pieza
      { wch: 14 }, // Origen
    ];
    XLSX.utils.book_append_sheet(workbook, wsMeli, 'Publicar Mercado Libre');

    // Crear Hoja 2
    const wsAudit = XLSX.utils.json_to_sheet(auditRows);
    wsAudit['!cols'] = [
      { wch: 20 }, // SKU
      { wch: 45 }, // Título Profit
      { wch: 45 }, // Título Optimizado
      { wch: 22 }, // Modelo
      { wch: 25 }, // Tipo/Marca
      { wch: 18 }, // Referencia
      { wch: 20 }, // OEM
      { wch: 18 }, // Alterno 2
      { wch: 45 }, // Equivalencias
      { wch: 16 }, // Stock
      { wch: 16 }, // Precio
      { wch: 14 }, // Costo
      { wch: 16 }, // Foto
      { wch: 12 }, // Cant
      { wch: 25 }, // Archivo
      { wch: 25 }, // Sublínea
      { wch: 15 }, // Código sublínea
    ];
    XLSX.utils.book_append_sheet(workbook, wsAudit, 'Auditoría y Costos');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const batchLabel = limit === 'all' ? 'Completo' : `Lote_${page}`;
    const safeSubName = (data.sublinea || co_subl).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MercadoLibre_${safeSubName}_${batchLabel}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error en /api/profit/missing/export:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
