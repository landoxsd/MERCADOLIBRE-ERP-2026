import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';

export async function GET(req, { params }) {
  try {
    let { sku } = await params;
    sku = sku.trim();
    const { searchParams } = new URL(req.url);
    const index = searchParams.get('index') || '0';
    const filename = searchParams.get('filename');
    
    const settings = getSettings();
    if (!settings.photosPath) {
      return NextResponse.json({ error: "Ruta de fotos no configurada en Ajustes" }, { status: 400 });
    }

    // Escanear carpeta
    const files = fs.readdirSync(settings.photosPath);
    
    const skuLower = sku.toLowerCase();

    let fileName = filename;
    
    if (!fileName) {
      fileName = files.find(f => {
        const base = f.split('.')[0].toLowerCase();
        
        // 1. Coincidencia exacta: 058054
        if (base === skuLower) return true;
        
        // 2. Coincidencia con índice: 058054-0, 058054-1, etc.
        const lastDashIndex = base.lastIndexOf('-');
        if (lastDashIndex !== -1) {
          const prefix = base.substring(0, lastDashIndex);
          const suffix = base.substring(lastDashIndex + 1);
          return prefix === skuLower && suffix === index.toString();
        }
        return false;
      });
    }

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
