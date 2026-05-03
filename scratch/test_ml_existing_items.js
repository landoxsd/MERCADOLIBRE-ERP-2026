async function getSellerItems() {
  const url = `https://api.mercadolibre.com/sites/MLV/search?seller_id=248086934`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.results && data.results.length > 0) {
    console.log("FIRST ITEM:", data.results[0].id);
    console.log("OFFICIAL STORE ID ON ITEM:", data.results[0].official_store_id);
    
    // Check all items to see if any have an official store id
    const storeIds = new Set(data.results.map(i => i.official_store_id).filter(id => id !== null && id !== undefined));
    console.log("UNIQUE STORE IDS FOUND:", Array.from(storeIds));
  } else {
    console.log("NO ITEMS FOUND FOR SELLER.");
  }
}
getSellerItems();
