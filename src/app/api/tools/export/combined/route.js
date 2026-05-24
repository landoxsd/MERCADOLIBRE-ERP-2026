import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request) {
    try {
        const { session_ids } = await request.json();

        if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
            return NextResponse.json(
                { error: "Se requiere un array de session_ids válido." },
                { status: 400 }
            );
        }

        // 1. Obtener la metadata de las sesiones solicitadas
        const { data: sessions, error: sessionsErr } = await supabaseAdmin
            .from("seller_spy_sessions")
            .select("id, seller_id, seller_nickname, scanned_at")
            .in("id", session_ids);

        if (sessionsErr) throw sessionsErr;

        if (!sessions || sessions.length === 0) {
            return NextResponse.json(
                { error: "No se encontraron sesiones válidas." },
                { status: 404 }
            );
        }

        // 2. Obtener todos los ítems de esas sesiones
        const { data: items, error: itemsErr } = await supabaseAdmin
            .from("seller_spy_items")
            .select("*")
            .in("session_id", session_ids);

        if (itemsErr) throw itemsErr;

        // 3. Deduplicación por ml_item_id
        // Si el mismo ítem aparece en más de una sesión (poco probable a menos que
        // se exporten 2 sesiones del mismo vendedor, pero posible), nos quedamos con el más reciente.
        // Como no tenemos un "scanned_at" a nivel de ítem explícitamente en la tabla (está en la sesión),
        // cruzamos el item con su sesión para saber la fecha.
        
        const sessionMap = new Map(sessions.map(s => [s.id, s]));
        
        // Ordenar items del más reciente al más antiguo basado en la fecha de la sesión
        const sortedItems = [...items].sort((a, b) => {
            const dateA = new Date(sessionMap.get(a.session_id)?.scanned_at || 0).getTime();
            const dateB = new Date(sessionMap.get(b.session_id)?.scanned_at || 0).getTime();
            return dateB - dateA;
        });

        const deduplicatedMap = new Map();
        for (const item of sortedItems) {
            if (!deduplicatedMap.has(item.ml_item_id)) {
                // Inyectar nickname del vendedor para facilitar el análisis exportado
                const sessionInfo = sessionMap.get(item.session_id);
                item.seller_nickname = sessionInfo ? sessionInfo.seller_nickname : "Desconocido";
                deduplicatedMap.set(item.ml_item_id, item);
            }
        }

        const finalItems = Array.from(deduplicatedMap.values());

        // 4. Retornar los ítems combinados y estadísticas
        return NextResponse.json({
            success: true,
            stats: {
                total_sessions: sessions.length,
                total_raw_items: items.length,
                total_deduplicated_items: finalItems.length
            },
            sessions_included: sessions,
            items: finalItems
        });

    } catch (error) {
        console.error("Error en exportación combinada:", error);
        return NextResponse.json(
            { error: "Error al procesar la exportación masiva." },
            { status: 500 }
        );
    }
}
