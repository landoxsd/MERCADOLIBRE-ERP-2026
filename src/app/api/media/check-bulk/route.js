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

    skus.forEach(sku => {
      const normalizedSku = sku.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const cleanSku = sku.replace(/^0+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

      // Verificar si el SKU normalizado existe en nuestra colección de archivos
      if (
        normalizedFileBases.has(normalizedSku) || 
        normalizedFileBases.has(`${normalizedSku}0`) ||
        (cleanSku && normalizedFileBases.has(cleanSku)) ||
        (cleanSku && normalizedFileBases.has(`${cleanSku}0`))
      ) {
        photoMap[sku] = true;
      } else {
        photoMap[sku] = false;
      }
    });

    return NextResponse.json({ photoMap });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
