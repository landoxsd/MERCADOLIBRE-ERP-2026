import { chromium } from 'playwright';

async function testExtract() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://listado.mercadolibre.com.ve/amortiguador-delantero-aveo', { waitUntil: 'domcontentloaded' });
    
    // give it a second
    await page.waitForTimeout(2000);
    
    const items = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('li.ui-search-layout__item, .poly-card');
        
        cards.forEach((card, idx) => {
            if (idx > 1) return;
            
            // image
            const img = card.querySelector('img.poly-component__picture');
            const imgUrl = img ? img.src || img.getAttribute('data-src') : null;
            
            // seller
            const sellerEl = card.querySelector('.poly-component__seller');
            const sellerText = sellerEl ? sellerEl.textContent.trim() : null;
            
            // seller link
            const sellerLinkEl = card.querySelector('a.poly-component__seller-link, .ui-search-item__group__element--seller');
            const sellerHref = sellerLinkEl ? sellerLinkEl.href : null;
            
            // reviews or sales (poly-reviews)
            const reviewsEl = card.querySelector('.poly-reviews__total');
            const reviewsText = reviewsEl ? reviewsEl.textContent.trim() : null;
            
            results.push({ imgUrl, sellerText, sellerHref, reviewsText });
        });
        return results;
    });
    
    console.log(items);
    await browser.close();
}
testExtract();
