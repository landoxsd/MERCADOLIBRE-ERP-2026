import { chromium } from 'playwright';

async function testFetchPDPPlaywright() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log('Navigating...');
    await page.goto('https://articulo.mercadolibre.com.ve/MLV-581037829-amortiguador-delantero-chevrolet-aveo-_JM');
    
    console.log('Waiting for network idle...');
    await page.waitForLoadState('networkidle');
    
    console.log('Evaluating...');
    const html = await page.content();
    console.log('Contains disponibles?', html.includes('disponibles'));
    console.log('Contains captcha?', html.includes('captcha') || html.includes('micro-landing'));
    
    await browser.close();
}
testFetchPDPPlaywright();
