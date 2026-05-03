const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zqxesjcchykncxpekmbz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U'; // Replace with service role key if needed, wait the env has it
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testPublish() {
  const { data, error } = await supabase.from('meli_accounts').select('*').eq('nickname', 'CORPORACIONRWCCA').single();
  const token = data.access_token;
  
  const payload = {
    title: "Item de Prueba (No Comprar) - " + Date.now(),
    category_id: "MLV446358",
    price: 10,
    currency_id: "USD",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_special",
    pictures: [{ source: "https://http2.mlstatic.com/D_Q_NP_2X_784153-MLA48831969429_012022-V.webp" }],
    attributes: [
      { id: "SELLER_SKU", value_name: "TEST-123" },
      { id: "BRAND", value_name: "RPC" },
      { id: "MODEL", value_name: "Genérico" }
    ],
    shipping: { mode: "not_specified" }
  };

  const res = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const resData = await res.json();
  if (res.ok) {
    console.log(`SUCCESS: Item ${resData.id}`);
    // delete it immediately
    await fetch(`https://api.mercadolibre.com/items/${resData.id}`, {
      method: 'PUT',
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" })
    });
  } else {
    console.log(`FAILED:`, JSON.stringify(resData, null, 2));
  }
}
testPublish();
