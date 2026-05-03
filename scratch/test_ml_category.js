async function testExtract() {
  const itemId = "MLV764255670";
  const url = `https://api.mercadolibre.com/items/${itemId}`;
  console.log(`Fetching ${url}...`);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Category ID:", data.category_id);
    console.log("Title:", data.title);
    if (data.error) {
      console.log("Error from ML:", data.error, data.message);
    }
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testExtract();
