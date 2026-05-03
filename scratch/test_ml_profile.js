const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U'; // Replace with service role key if needed, wait the env has it
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testMe() {
  const { data, error } = await supabase.from('meli_accounts').select('access_token').eq('nickname', 'CORPORACIONRWCCA').single();
  if (error || !data) {
    console.error("Error fetching token:", error);
    return;
  }
  const token = data.access_token;
  const res = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const userData = await res.json();
  console.log("USER PROFILE:", JSON.stringify(userData, null, 2));
}
testMe();
