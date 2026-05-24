import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
    console.log('--- Iniciando Prueba de Big Data Export ---');

    // 1. Obtener al menos 2 sesiones de espionaje existentes
    const { data: sessions, error: sErr } = await supabase
        .from('seller_spy_sessions')
        .select('id, seller_nickname, scanned_at, total_items')
        .order('scanned_at', { ascending: false })
        .limit(2);

    if (sErr) {
        console.error('Error obteniendo sesiones:', sErr);
        return;
    }

    if (!sessions || sessions.length === 0) {
        console.log('No hay sesiones de espionaje en la base de datos para probar.');
        console.log('Por favor entra a "Seller Spy" en el dashboard y escanea a un competidor primero.');
        return;
    }

    console.log(`✅ Se encontraron ${sessions.length} sesiones:`);
    sessions.forEach(s => console.log(`   - ${s.seller_nickname} (${s.total_items} ítems)`));

    const session_ids = sessions.map(s => s.id);

    // 2. Simular la lógica de la API /api/tools/export/combined
    console.log('\n--- Ejecutando lógica de fusión y deduplicación ---');
    const { data: items, error: iErr } = await supabase
        .from('seller_spy_items')
        .select('ml_item_id, title, price_usd, session_id')
        .in('session_id', session_ids);

    if (iErr) {
        console.error('Error obteniendo ítems:', iErr);
        return;
    }

    console.log(`📦 Ítems brutos recuperados: ${items.length}`);

    // Deduplicación
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    
    const sortedItems = [...items].sort((a, b) => {
        const dateA = new Date(sessionMap.get(a.session_id)?.scanned_at || 0).getTime();
        const dateB = new Date(sessionMap.get(b.session_id)?.scanned_at || 0).getTime();
        return dateB - dateA; // Más reciente primero
    });

    const deduplicatedMap = new Map();
    let duplicatesFound = 0;

    for (const item of sortedItems) {
        if (!deduplicatedMap.has(item.ml_item_id)) {
            const sessionInfo = sessionMap.get(item.session_id);
            item.seller_nickname = sessionInfo ? sessionInfo.seller_nickname : "Desconocido";
            deduplicatedMap.set(item.ml_item_id, item);
        } else {
            duplicatesFound++;
        }
    }

    const finalItems = Array.from(deduplicatedMap.values());

    console.log(`✅ Ítems finales tras deduplicación: ${finalItems.length}`);
    console.log(`🔄 Duplicados eliminados: ${duplicatesFound}`);

    if (finalItems.length > 0) {
        console.log('\n--- Muestra de los primeros 3 ítems exportables ---');
        finalItems.slice(0, 3).forEach((item, i) => {
            console.log(`${i+1}. [${item.ml_item_id}] ${item.title.substring(0, 40)}... | $${item.price_usd} | Vendedor: ${item.seller_nickname}`);
        });
    }

    console.log('\n--- Prueba Exitosa 🚀 ---');
}

runTest();
