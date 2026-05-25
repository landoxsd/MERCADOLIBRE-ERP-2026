import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import path from "path";

export async function POST(request) {
    try {
        const { imageUrl, sku, index } = await request.json();

        if (!imageUrl || !sku || index === undefined) {
            return NextResponse.json({ error: "Faltan parámetros (imageUrl, sku, index)" }, { status: 400 });
        }

        // Definir carpeta de destino
        const sandboxDir = path.join(process.cwd(), "public", "hunter-sandbox");
        if (!fs.existsSync(sandboxDir)) {
            fs.mkdirSync(sandboxDir, { recursive: true });
        }

        const fileName = `${sku}-${index}.jpg`;
        const filePath = path.join(sandboxDir, fileName);

        console.log(`🖼️ Procesando imagen para SKU ${sku}: ${imageUrl}`);

        // Descargar la imagen a memoria
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Error descargando la imagen: ${response.statusText}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Procesar con Sharp (Igual que el script de Python pero más rápido)
        await sharp(buffer)
            .resize({
                width: 1500,
                height: 1500,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 } // Fondo blanco
            })
            .sharpen({
                sigma: 1.5, // Radio del efecto de nitidez (equivalente a enhance en Pillow)
                m1: 2.0,    // Intensidad
                m2: 1.0     // Umbral
            })
            .jpeg({ quality: 95 })
            .toFile(filePath);

        return NextResponse.json({ 
            success: true, 
            message: "Imagen procesada exitosamente",
            fileName: fileName,
            url: `/hunter-sandbox/${fileName}`
        });

    } catch (error) {
        console.error("❌ Error procesando imagen:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
