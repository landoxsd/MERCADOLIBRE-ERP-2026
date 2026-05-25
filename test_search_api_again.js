require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: accounts } = await supabase.from('meli_accounts').select('access_token').limit(1);
    const token = accounts[0].access_token;
    
    const res = await fetch('https://api.mercadolibre.com/sites/MLV/search?seller_id=1613638274', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Search API status:', res.status);
    const json = await res.json();
    console.log(json.results ? 'Got results: ' + json.results.length : json);
})();
