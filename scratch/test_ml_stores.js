async function checkStores() {
  const userId = '248086934';
  const url = `https://api.mercadolibre.com/stores/search?user_id=${userId}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("STORES SEARCH:", JSON.stringify(data, null, 2));
}

checkStores();
