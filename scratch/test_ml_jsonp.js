async function testJSONP() {
  const itemId = "MLV764255670";
  const url = `https://api.mercadolibre.com/items/${itemId}?callback=testCallback`;
  console.log(`🔍 Testing JSONP API: ${url}`);
  
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("Response Status:", res.status);
    console.log("Response Data:", text.substring(0, 100));
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testJSONP();
