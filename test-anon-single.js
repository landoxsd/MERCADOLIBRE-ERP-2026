const url = 'https://api.mercadolibre.com/items/MLV581037829';
async function test() {
    const res = await fetch(url);
    console.log('Status without token:', res.status);
    const data = await res.text();
    console.log('Response:', data.substring(0, 200));
}
test();
