import { NextResponse } from "next/server";
import archiver from "archiver";
import fs from "fs";
import path from "path";

export async function GET(request) {
    try {
        const sandboxDir = path.join(process.cwd(), "public", "hunter-sandbox");
        
        if (!fs.existsSync(sandboxDir)) {
            return NextResponse.json({ error: "No hay imágenes en la bandeja de aprobación." }, { status: 404 });
        }

        const files = fs.readdirSync(sandboxDir).filter(file => file.endsWith('.jpg'));

        if (files.length === 0) {
            return NextResponse.json({ error: "La bandeja está vacía." }, { status: 404 });
        }

        const zip = archiver("zip", {
            zlib: { level: 9 } // Nivel máximo de compresión
        });

        const passThrough = new TransformStream();
        
        // Vamos a hacer streaming del archivo ZIP directamente al cliente
        // en Node.js puro usando Web Streams
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        zip.on("data", (data) => writer.write(data));
        zip.on("end", () => writer.close());
        zip.on("error", (err) => writer.abort(err));

        for (const file of files) {
            const filePath = path.join(sandboxDir, file);
            zip.file(filePath, { name: file });
        }

        zip.finalize();

        return new NextResponse(readable, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="PROFIT_IMAGES_${new Date().toISOString().split('T')[0]}.zip"`,
            }
        });

    } catch (error) {
        console.error("❌ Error exportando ZIP:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
