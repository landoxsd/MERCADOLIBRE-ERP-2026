const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U'; // Replace with service role key if needed, wait the env has it
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getUserItems() {
  const { data, error } = await supabase.from('meli_accounts').select('access_token').eq('nickname', 'CORPORACIONRWCCA').single();
  const token = data.access_token;

  const url = `https://api.mercadolibre.com/users/248086934/items/search`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const resData = await res.json();
  
  if (resData.results && resData.results.length > 0) {
    console.log("FOUND ITEMS:", resData.results.slice(0, 5));
    
    // Fetch details of the first item
    const itemUrl = `https://api.mercadolibre.com/items/${resData.results[0]}`;
    const itemRes = await fetch(itemUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const itemData = await itemRes.json();
    console.log("FIRST ITEM DETAILS:");
    console.log("ID:", itemData.id);
    console.log("OFFICIAL STORE ID:", itemData.official_store_id);
    console.log("DOMAIN ID:", itemData.domain_id);
  } else {
    console.log("NO ITEMS FOUND USING USER SEARCH ENDPOINT.");
  }
}
getUserItems();
