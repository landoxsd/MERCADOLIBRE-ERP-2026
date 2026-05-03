async function testPredictor() {
  const title = "bases de amortiguador delantera hyundai accent getz 16";
  const url = `https://api.mercadolibre.com/sites/MLV/category_predictor/predict?title=${encodeURIComponent(title)}`;
  console.log(`🔍 Testing Predictor API: ${url}`);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Data:", data);
  } catch (e) {
    console.error("Fetch failed:", e.message);
  }
}
testPredictor();
