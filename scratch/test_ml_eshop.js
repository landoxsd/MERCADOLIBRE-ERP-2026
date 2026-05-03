async function checkEshop() {
  const url = 'https://eshops.mercadolibre.com.ve/CORPORACIONRWCCA';
  const res = await fetch(url);
  const html = await res.text();
  
  // Extract official_store_id or store_id using regex
  const match = html.match(/official_store_id["']?\s*[:=]\s*["']?(\d+)/i) || 
                html.match(/store_id["']?\s*[:=]\s*["']?(\d+)/i) ||
                html.match(/officialStoreId["']?\s*[:=]\s*["']?(\d+)/i);
                
  if (match) {
    console.log("FOUND OFFICIAL STORE ID IN HTML:", match[1]);
  } else {
    console.log("NO OFFICIAL STORE ID FOUND IN HTML.");
  }
}
checkEshop();
