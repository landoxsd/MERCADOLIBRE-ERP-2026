import { NextResponse } from "next/server";
const archiver = require("archiver");
import fs from "fs";
import path from "path";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const clearAfter = searchParams.get('clear') === 'true';

        const sandboxDir = path.join(process.cwd(), "public", "hunter-sandbox");

        if (!fs.existsSync(sandboxDir)) {
            return NextResponse.json({ error: "No hay imagenes en la bandeja." }, { status: 404 });
        }

        const files = fs.readdirSync(sandboxDir).filter(f => f.endsWith('.jpg'));
        if (files.length === 0) {
            return NextResponse.json({ error: "La bandeja esta vacia." }, { status: 404 });
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        const zip = archiver("zip", { zlib: { level: 9 } });
        zip.on("data", (chunk) => writer.write(chunk));
        zip.on("end", () => {
            writer.close();
            // Limpiar bandeja si se solicita
            if (clearAfter) {
                try {
                    files.forEach(file => {
                        fs.unlinkSync(path.join(sandboxDir, file));
                    });
                } catch(e) {
                    console.error("Error limpiando bandeja:", e);
                }
            }
        });
        zip.on("error", (err) => writer.abort(err));

        for (const file of files) {
            zip.file(path.join(sandboxDir, file), { name: file });
        }
        zip.finalize();

        const today = new Date().toISOString().split('T')[0];
        return new NextResponse(readable, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="PROFIT_IMAGES_${today}.zip"`,
            }
        });

    } catch (error) {
        console.error("Error exportando ZIP:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
