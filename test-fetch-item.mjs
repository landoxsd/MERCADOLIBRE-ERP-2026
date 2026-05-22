import { getValidAccessToken } from './src/lib/meli-auth-helper.js';

async function testWithToken() {
    try {
        const token = await getValidAccessToken();
        console.log('Token fetched:', token ? token.substring(0, 15) + '...' : 'null');
        
        const url = 'https://api.mercadolibre.com/items/MLV581037829';
        const headers = {
            'Authorization': Bearer 
        };
        const res = await fetch(url, { headers });
        console.log('Status:', res.status);
        const data = await res.text();
        console.log('Response:', data.substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
testWithToken();
