import { scrapeMeliSearch } from './src/lib/mlv-playwright-scraper.js';

async function testScrape() {
    const items = await scrapeMeliSearch('amortiguador delantero aveo');
    console.log(items.slice(0, 3));
    
    if (items.length > 0) {
        const url = 'https://api.mercadolibre.com/items/' + items[0].id;
        console.log('Fetching detail:', url);
        const res = await fetch(url);
        const data = await res.json();
        console.log('title:', data.title);
        console.log('sold_quantity:', data.sold_quantity);
        console.log('seller_id:', data.seller_id);
        console.log('pictures count:', data.pictures?.length);
    }
}
testScrape();
