import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SANDBOX_DIR = path.join(process.cwd(), "public", "hunter-sandbox");

function ensureDir() {
    if (!fs.existsSync(SANDBOX_DIR)) {
        fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    }
}

// GET — lista todas las imagenes en la bandeja
export async function GET() {
    try {
        ensureDir();
        const files = fs.readdirSync(SANDBOX_DIR).filter(f => f.endsWith('.jpg'));

        const images = files.map(filename => {
            const filePath = path.join(SANDBOX_DIR, filename);
            const stats = fs.statSync(filePath);
            // Parsear SKU e indice del nombre: "KE5009-0.jpg" -> sku="KE5009", index=0
            const match = filename.match(/^(.+)-(\d+)\.jpg$/);
            return {
                filename,
                url: `/hunter-sandbox/${filename}`,
                sku: match ? match[1] : filename.replace('.jpg', ''),
                index: match ? parseInt(match[2]) : 0,
                size_bytes: stats.size,
                created_at: stats.mtime.toISOString()
            };
        }).sort((a, b) => a.filename.localeCompare(b.filename));

        return NextResponse.json({ success: true, count: images.length, images });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — elimina una imagen o toda la bandeja
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const file = searchParams.get('file');
        const clear = searchParams.get('clear');

        ensureDir();

        if (clear === 'all') {
            const files = fs.readdirSync(SANDBOX_DIR).filter(f => f.endsWith('.jpg'));
            files.forEach(f => fs.unlinkSync(path.join(SANDBOX_DIR, f)));
            return NextResponse.json({ success: true, deleted: files.length, message: "Bandeja vaciada." });
        }

        if (file) {
            // Sanitizar el nombre de archivo (solo permite SKU-N.jpg)
            const safeName = path.basename(file);
            if (!/^[a-zA-Z0-9_\-]+-\d+\.jpg$/.test(safeName)) {
                return NextResponse.json({ error: "Nombre de archivo invalido." }, { status: 400 });
            }
            const filePath = path.join(SANDBOX_DIR, safeName);
            if (!fs.existsSync(filePath)) {
                return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
            }
            fs.unlinkSync(filePath);
            return NextResponse.json({ success: true, deleted: safeName });
        }

        return NextResponse.json({ error: "Especifica ?file=SKU-0.jpg o ?clear=all" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
