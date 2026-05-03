import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';

export async function POST(req) {
  try {
    const { skus } = await req.json();
    if (!skus || !Array.isArray(skus)) {
      return NextResponse.json({ error: "Faltan SKUs" }, { status: 400 });
    }

    const settings = getSettings();
    if (!settings.photosPath || !fs.existsSync(settings.photosPath)) {
      return NextResponse.json({ photoMap: {} });
    }

    // Escanear carpeta una sola vez
    const files = fs.readdirSync(settings.photosPath);
    const photoMap = {};

    // Crear un SET de bases de archivos NORMALIZADOS (sin caracteres especiales)
    const normalizedFileBases = new Set(files.map(f => f.split('.')[0].toLowerCase().replace(/[^a-z0-9]/gi, '')));

    skus.forEach(skuRaw => {
      const sku = skuRaw.trim();
      const skuLower = sku.toLowerCase();

      // Coincidencia estricta: SKU exacto o SKU-N (donde N es número)
      const hasMatch = files.some(f => {
        const base = f.split('.')[0].toLowerCase();
        if (base === skuLower) return true;
        
        const lastDashIndex = base.lastIndexOf('-');
        if (lastDashIndex !== -1) {
          const prefix = base.substring(0, lastDashIndex);
          const suffix = base.substring(lastDashIndex + 1);
          return prefix === skuLower && /^\d+$/.test(suffix);
        }
        return false;
      });

      photoMap[sku] = hasMatch;
    });

    return NextResponse.json({ photoMap });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
