const https = require('https');

async function testHTML() {
  const url = "https://articulo.mercadolibre.com.ve/MLV-764255670-bases-de-amortiguador-delantera-hyundai-accent-getz-16-_JM";
  console.log(`🔍 Testing HTML fetch: ${url}`);
  
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-VE,es;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  };

  https.get(url, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("Status:", res.statusCode);
      // Try to find category ID
      const match = data.match(/"category_id":"(MLV\d+)"/);
      if (match) {
        console.log("✅ Category ID found in HTML:", match[1]);
      } else {
        console.log("❌ Not found. HTML Length:", data.length);
      }
    });
  }).on('error', e => console.error("Error:", e.message));
}
testHTML();
