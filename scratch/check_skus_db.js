const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Faltan variables de entorno Supabase.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkus() {
    const skus = ['223420', '22343', '223540'];
    const { data, error } = await supabase
        .from('internal_inventory')
        .select('sku, subcategory')
        .in('sku', skus);

    if (error) {
        console.error('Error DB:', error);
    } else {
        console.log('Resultados de SKUs:');
        console.log(JSON.stringify(data, null, 2));
    }
}

checkSkus();
