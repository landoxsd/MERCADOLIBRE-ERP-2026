const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://listado.mercadolibre.com.ve/spark-matiz-wagon-r-brazo-oscilante-meseta-munon-delivery-_JM');
    const html = await page.content();
    console.log(html.includes('seller_id'));
    const match = html.match(/seller_id['"]?\s*[:=]\s*['"]?(\d+)/i) || html.match(/"sellerId":\s*(\d+)/i) || html.match(/sellerId=(\d+)/i) || html.match(/seller=(\d+)/i);
    console.log('seller_id match:', match ? match[1] : null);
    await browser.close();
})();
