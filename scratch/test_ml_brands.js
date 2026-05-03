const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U'; // Replace with service role key if needed, wait the env has it
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testMe() {
  const { data, error } = await supabase.from('meli_accounts').select('*').eq('nickname', 'CORPORACIONRWCCA').single();
  if (error || !data) {
    console.error("Error fetching token:", error);
    return;
  }
  const token = data.access_token;
  const userId = data.meli_user_id;
  
  const res = await fetch(`https://api.mercadolibre.com/users/${userId}/brands`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const brandsData = await res.json();
  console.log("USER BRANDS ENDPOINT:");
  console.log(JSON.stringify(brandsData, null, 2));
}
testMe();
