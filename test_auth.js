require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { getValidAccessToken } = require('./src/lib/meli-auth-helper.js');

(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: accounts } = await supabase.from('meli_accounts').select('id').limit(1);
    if (accounts && accounts.length > 0) {
        const token = await getValidAccessToken(accounts[0].id);
        console.log("Got token:", token.substring(0, 10) + "...");
        
        const res = await fetch('https://api.mercadolibre.com/sites/MLV/search?nickname=LOS+CHAMOS+BRG', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        console.log("Status:", res.status);
        if (data.seller) {
            console.log("Seller ID:", data.seller.id);
        } else if (data.results && data.results.length > 0) {
            console.log("Results[0] seller id:", data.results[0].seller.id);
        } else {
            console.log("Data:", data);
        }
    }
})();
