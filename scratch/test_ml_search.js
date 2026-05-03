async function testSearch() {
  const itemId = "MLV764255670";
  const url = `https://api.mercadolibre.com/sites/MLV/search?q=${itemId}`;
  console.log(`🔍 Testing Search API: ${url}`);
  
  try {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    console.log("Response Status:", res.status);
    if (data.results && data.results.length > 0) {
      console.log("✅ Success! Category:", data.results[0].category_id);
    } else {
      console.log("❌ No results found or blocked.");
    }
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testSearch();
