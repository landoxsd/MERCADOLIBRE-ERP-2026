import { scrapeMeliSearch } from './src/lib/mlv-playwright-scraper.js';
import fs from 'fs';

async function testScrape() {
    const items = await scrapeMeliSearch('amortiguador delantero aveo');
    fs.writeFileSync('test-scraper-output.json', JSON.stringify(items, null, 2));
    console.log('Saved to test-scraper-output.json');
}
testScrape();
