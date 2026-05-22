import { getValidAccessToken } from './src/lib/meli-auth-helper.js';

async function testWithToken() {
    const token = await getValidAccessToken();
    const url = 'https://api.mercadolibre.com/items/MLV581037829';
    console.log('Fetching with token...');
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    console.log(data);
}
testWithToken();
