const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U'; // Replace with service role key if needed, wait the env has it
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getItem() {
  const { data, error } = await supabase.from('meli_accounts').select('access_token').eq('nickname', 'CORPORACIONRWCCA').single();
  const token = data.access_token;

  const itemUrl = `https://api.mercadolibre.com/items/MLV574087854`;
  const itemRes = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const itemData = await itemRes.json();
  console.log("ITEM ATTRIBUTES:");
  console.log(JSON.stringify(itemData.attributes, null, 2));
}
getItem();
