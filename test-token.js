require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkToken() {
    const { data } = await supabase.from('meli_accounts').select('*').limit(1);
    if (!data || data.length === 0) {
        console.log('NO ACCOUNTS IN DB');
        return;
    }
    const token = data[0].access_token;
    console.log('Token exists:', !!token);
    
    // Try fetch
    const url = 'https://api.mercadolibre.com/items/MLV581037829';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    console.log('Code:', res.status);
    console.log('Item Title:', json.title);
    console.log('sold_quantity:', json.sold_quantity);
    console.log('seller_id:', json.seller_id);
}
checkToken();
