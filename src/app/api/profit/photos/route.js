// ================================================================
// src/app/api/profit/photos/route.js
// Sirve imágenes de repuestos: /mnt/fotos (Linux) o Photo Bridge / UNC (Windows)
// ================================================================
import { NextResponse } from 'next/server';
import path from 'path';
import { readPhotoFile } from '@/lib/photos-fs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilename = searchParams.get('filename') || searchParams.get('file');

    if (!rawFilename) {
      return new NextResponse('Filename missing', { status: 400 });
    }

    const safeFilename = path.basename(rawFilename);
    const found = await readPhotoFile(safeFilename);

    if (!found?.buffer) {
      return new NextResponse('Photo not found', { status: 404 });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

    return new NextResponse(found.buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        'X-Photo-Source': found.source || 'unknown',
      },
    });
  } catch (error) {
    return new NextResponse('Internal Server Error: ' + error.message, { status: 500 });
  }
}
