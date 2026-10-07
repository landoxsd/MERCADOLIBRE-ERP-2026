// ================================================================
// src/app/api/profit/photos/route.js
// Endpoint seguro para servir imágenes locales de repuestos (F:\ o Pictures\FOTOS)
// ================================================================
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CANDIDATE_DIRS = [
  'F:\\',
  'C:\\Users\\ORLANDO\\Pictures\\FOTOS',
  '\\\\Servidor\\e\\FOTOS',
  process.env.PHOTOS_PATH || '',
  '/mnt/fotos',
  '/fotos',
].filter(Boolean);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilename = searchParams.get('filename') || searchParams.get('file');

    if (!rawFilename) {
      return new NextResponse('Filename missing', { status: 400 });
    }

    // Prevenir directory traversal
    const safeFilename = path.basename(rawFilename);

    for (const baseDir of CANDIDATE_DIRS) {
      try {
        const fullPath = path.join(baseDir, safeFilename);
        if (fs.existsSync(fullPath)) {
          const fileBuffer = await fs.promises.readFile(fullPath);
          const ext = path.extname(safeFilename).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
            },
          });
        }
      } catch (err) {
        // Continuar con el siguiente directorio
      }
    }

    return new NextResponse('Photo not found', { status: 404 });
  } catch (error) {
    return new NextResponse('Internal Server Error: ' + error.message, { status: 500 });
  }
}
