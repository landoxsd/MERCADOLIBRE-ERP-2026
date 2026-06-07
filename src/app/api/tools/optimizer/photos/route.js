import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

/**
 * POST /api/tools/optimizer/photos
 * Body: { accountId, itemId, sku, action }
 *
 * action = "list"   → devuelve fotos del banco para ese SKU
 * action = "apply"  → adjunta una foto del banco al ítem en ML
 *                     body extra: { pictureId }   (ml_picture_id ya subido)
 *                   → o sube desde URL: { pictureUrl }
 */
export async function POST(request) {
    try {
        const { accountId, itemId, sku, action, pictureId, pictureUrl } = await request.json();

        if (!accountId || !itemId) {
            return NextResponse.json({ error: "Faltan accountId o itemId" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);

        // ─── LISTAR FOTOS DEL BANCO ────────────────────────────────────
        if (action === "list") {
            if (!sku) return NextResponse.json({ success: true, photos: [] });

            const { data, error } = await supabaseAdmin
                .from("image_bank")
                .select("ml_picture_id, ml_url, image_index")
                .eq("sku", sku)
                .eq("sync_status", "synced")
                .order("image_index", { ascending: true });

            if (error) throw error;

            const photos = (data || []).map(p => ({
                pictureId: p.ml_picture_id,
                url: p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null),
                index: p.image_index
            })).filter(p => p.url);

            return NextResponse.json({ success: true, photos });
        }

        // ─── APLICAR FOTO AL ÍTEM EN ML ──────────────────────────────────
        if (action === "apply") {
            // Obtener fotos actuales del ítem
            const itemRes = await fetch(`${MELI_BASE_URL}/items/${itemId}?attributes=id,pictures`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!itemRes.ok) throw new Error("No se pudo obtener el ítem");
            const itemData = await itemRes.json();

            const currentPictures = itemData.pictures || [];

            // Construir nueva lista de fotos — añadir al final
            let newPicture;
            if (pictureId) {
                // Ya está subida a ML — solo referenciar por ID
                newPicture = { id: pictureId };
            } else if (pictureUrl) {
                // Subir desde URL al servidor de imágenes de ML primero
                const uploadRes = await fetch(`${MELI_BASE_URL}/pictures/items/upload?access_token=${accessToken}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: pictureUrl })
                });
                if (!uploadRes.ok) {
                    const uploadErr = await uploadRes.json().catch(() => ({}));
                    throw new Error(uploadErr.message || "Error al subir la foto a ML");
                }
                const uploadData = await uploadRes.json();
                newPicture = { id: uploadData.id };
            } else {
                return NextResponse.json({ error: "Se requiere pictureId o pictureUrl" }, { status: 400 });
            }

            // Verificar que no esté duplicada
            const alreadyExists = currentPictures.some(p => p.id === newPicture.id);
            if (alreadyExists) {
                return NextResponse.json({ success: true, message: "La foto ya estaba en la publicación", pictures: currentPictures });
            }

            const updatedPictures = [...currentPictures, newPicture];

            // Actualizar el ítem con la nueva lista de fotos
            const putRes = await fetch(`${MELI_BASE_URL}/items/${itemId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ pictures: updatedPictures })
            });

            if (!putRes.ok) {
                const putErr = await putRes.json().catch(() => ({}));
                const causes = putErr.cause?.map(c => c.message).join(", ") || "";
                throw new Error(`${putErr.message || "Error al actualizar fotos"} ${causes ? `(${causes})` : ""}`);
            }

            const putData = await putRes.json();
            return NextResponse.json({
                success: true,
                message: "Foto añadida correctamente",
                picturesCount: putData.pictures?.length || updatedPictures.length,
                pictures: putData.pictures || updatedPictures
            });
        }

        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });

    } catch (error) {
        console.error("Error en /api/tools/optimizer/photos:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
