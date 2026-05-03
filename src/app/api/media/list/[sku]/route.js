import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSettings } from '@/lib/settings';

export async function GET(req, { params }) {
  try {
    let { sku } = await params;
    sku = sku.trim();
    const settings = getSettings();
    
    if (!settings.photosPath || !fs.existsSync(settings.photosPath)) {
      return NextResponse.json({ files: [] });
    }

    const allFiles = fs.readdirSync(settings.photosPath);
    const skuLower = sku.toLowerCase();
    
    console.log(`[LIST API] Buscando fotos para SKU: "${sku}" en ${settings.photosPath}`);

    const matchingFiles = allFiles.filter(f => {
      // Usar path.parse para manejar extensiones correctamente
      const base = path.parse(f).name.toLowerCase();
      
      // Coincidencia exacta
      if (base === skuLower) return true;
      
      // Coincidencia SKU-N (ej: 058054-0)
      const lastDashIndex = base.lastIndexOf('-');
      if (lastDashIndex !== -1) {
        const prefix = base.substring(0, lastDashIndex);
        const suffix = base.substring(lastDashIndex + 1);
        const isMatch = prefix === skuLower && /^\d+$/.test(suffix);
        if (isMatch) console.log(`[LIST API] Encontrada: ${f}`);
        return isMatch;
      }
      
      return false;
    }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 10);

    console.log(`[LIST API] Total encontradas: ${matchingFiles.length}`);

    return NextResponse.json({ 
      success: true, 
      sku,
      count: matchingFiles.length,
      files: matchingFiles 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
