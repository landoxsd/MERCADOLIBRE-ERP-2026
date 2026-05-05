import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkErrors() {
    console.log("--- ANALISIS DE ERRORES EN EL BANCO ---");
    
    const { data: errors, error } = await supabase
        .from('image_bank')
        .select('error_message')
        .eq('sync_status', 'error')
        .limit(100);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (errors.length === 0) {
        console.log("✅ No hay registros con estado 'error'.");
    } else {
        console.log(`❌ Se encontraron ${errors.length} ejemplos de errores (total en DB):`);
        const summary = errors.reduce((acc, curr) => {
            acc[curr.error_message] = (acc[curr.error_message] || 0) + 1;
            return acc;
        }, {});
        console.table(summary);
    }

    // Ver si hay fotos en estado 'uploading' bloqueadas
    const { count: uploading } = await supabase
        .from('image_bank')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'uploading');
    
    console.log("\nFotos en estado 'uploading' (posiblemente trabadas):", uploading);
}

checkErrors();
