import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVisits() {
    // Get token
    const { data: account } = await supabase.from('meli_accounts').select('access_token').limit(1).single();
    const token = account.access_token;
    
    // Pick a competitor item ID (we'll fetch one dynamically to be sure it's valid)
    const searchUrl = 'https://api.mercadolibre.com/sites/MLV/search?q=amortiguador&limit=1';
    const searchRes = await fetch(searchUrl, { headers: { 'Authorization': 'Bearer ' + token } });
    const searchData = await searchRes.json();
    
    if (searchData.results && searchData.results.length > 0) {
        const itemId = searchData.results[0].id;
        const url = "https://api.mercadolibre.com/visits/items?ids=" + itemId;
        console.log('Fetching visits for:', itemId);
        
        const res = await fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    }
}

testVisits();
