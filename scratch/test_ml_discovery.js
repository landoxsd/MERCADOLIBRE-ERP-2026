async function testPredictor() {
  const title = "bases de amortiguador delantera hyundai accent getz 16";
  const url = `https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q=${encodeURIComponent(title)}`;
  console.log(`🔍 Testing Discovery API: ${url}`);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testPredictor();
