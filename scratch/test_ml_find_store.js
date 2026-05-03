async function findStore() {
  let url = `https://api.mercadolibre.com/sites/MLV/search?official_store_id=all`;
  // Actually, there is an endpoint for all official stores: https://api.mercadolibre.com/users/official_stores
  // But wait, there is no such public endpoint. 
  // We can query /sites/MLV/search?q=Corporacion+R.W.C
  const searchUrl = `https://api.mercadolibre.com/sites/MLV/search?q=alarma+scorpions`;
  const res = await fetch(searchUrl);
  const data = await res.json();
  
  if (data.results) {
    const rwcItems = data.results.filter(i => i.seller && i.seller.id === 248086934);
    if (rwcItems.length > 0) {
      console.log("FOUND ITEM FROM SELLER:", rwcItems[0].id);
      console.log("STORE ID:", rwcItems[0].official_store_id);
    } else {
      console.log("No items found for seller in search.");
    }
  }
}
findStore();
