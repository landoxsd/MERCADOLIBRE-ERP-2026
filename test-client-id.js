require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data: accounts } = await supabase.from('meli_accounts').select('client_id').limit(1);
    console.log('Client ID:', accounts[0]?.client_id);
}
test();
