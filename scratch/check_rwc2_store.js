const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAccount2() {
  const { data, error } = await supabase.from('meli_accounts').select('*').eq('nickname', 'CORPORACIONRWC2').single();
  if (error || !data) {
    console.error("Error fetching token for CORPORACIONRWC2:", error);
    return;
  }
  const token = data.access_token;
  const userId = data.meli_user_id;

  // Try /users/me first
  const resMe = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const userData = await resMe.json();
  console.log("CORPORACIONRWC2 PROFILE ID:", userData.id);
  console.log("BRANDS IN ME:", userData.brands);

  // Try /users/{id}/brands
  const resBrands = await fetch(`https://api.mercadolibre.com/users/${userData.id}/brands`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const brandsData = await resBrands.json();
  console.log("CORPORACIONRWC2 BRANDS ENDPOINT:", JSON.stringify(brandsData, null, 2));
}
checkAccount2();
