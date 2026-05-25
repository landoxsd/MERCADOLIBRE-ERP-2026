require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

(async () => {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: accounts } = await supabase.from('meli_accounts').select('access_token').limit(1);
        if (accounts && accounts.length > 0) {
            const token = accounts[0].access_token;
            const res = await fetch('https://api.mercadolibre.com/items/MLV798324952', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            console.log('Status with token:', res.status);
            const data = await res.json();
            console.log('Seller ID:', data.seller_id);
        }
    } catch(e) { console.log(e); }
})();
