async function testItemsIds() {
  const itemId = "MLV764255670";
  const url = `https://api.mercadolibre.com/items?ids=${itemId}`;
  console.log(`🔍 Testing Items IDs API: ${url}`);
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testItemsIds();
