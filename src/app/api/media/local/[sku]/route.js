import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';

export async function GET(req, { params }) {
  try {
    const { sku } = await params;
    const { searchParams } = await new URL(req.url);
    const index = searchParams.get('index') || '0';
    
    const settings = getSettings();
    if (!settings.photosPath) {
      return NextResponse.json({ error: "Ruta de fotos no configurada en Ajustes" }, { status: 400 });
    }

    // Escanear carpeta
    const files = fs.readdirSync(settings.photosPath);
    
    // Normalizar SKU: eliminar guiones, puntos y espacios
    const normalizedSku = sku.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const cleanSku = sku.replace(/^0+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    const fileName = files.find(f => {
      const base = f.split('.')[0].toLowerCase().replace(/[^a-z0-9]/gi, '');
      // Coincidencia si el nombre del archivo contiene el SKU normalizado
      return base === normalizedSku || 
             base === `${normalizedSku}${index}` || 
             (cleanSku && base === cleanSku) ||
             base.startsWith(`${normalizedSku}-`);
    });

    if (!fileName) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const foundPath = path.join(settings.photosPath, fileName);
    const imageBuffer = fs.readFileSync(foundPath);
    const base64Image = imageBuffer.toString('base64');
    
    return NextResponse.json({ 
      success: true,
      sku,
      fileName,
      data: `data:image/jpeg;base64,${base64Image}`
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
