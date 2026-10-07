// ================================================================
// src/app/api/profit/missing/export/route.js
// Exportación a Excel de artículos faltantes por lote o sublínea completa
// Compatible con formato Mercado Libre e Integraly Excel Addin
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

    // Formatear filas para Excel
    const rows = data.items.map((item) => ({
      'SKU Oficial (Profit co_art)': item.sku,
      'Título / Descripción': item.descripcion,
      'Modelo / Aplicación': item.modelo || '',
      'Tipo / Marca Sugerida': item.is_generic_e ? 'Genérico / Multimarca (Termina en E)' : 'Genérico',
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

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = (data.sublinea || 'Faltantes').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 22 }, // SKU Oficial
      { wch: 55 }, // Descripción
      { wch: 25 }, // Modelo
      { wch: 18 }, // Referencia
      { wch: 22 }, // OEM
      { wch: 18 }, // Alterno 2
      { wch: 45 }, // Equivalencias
      { wch: 16 }, // Stock
      { wch: 16 }, // Precio
      { wch: 14 }, // Costo
      { wch: 16 }, // Tiene foto
      { wch: 12 }, // Cant fotos
      { wch: 25 }, // Archivo foto
      { wch: 30 }, // Sublínea
      { wch: 15 }, // Código sublínea
    ];

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const batchLabel = limit === 'all' ? 'Completo' : `Lote_${page}`;
    const safeSubName = (data.sublinea || co_subl).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Faltantes_${safeSubName}_${batchLabel}.xlsx`;

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
