async function test() {
    const url = 'https://api.mercadolibre.com/items/MLV581037829';
    const res = await fetch(url);
    console.log('Status without token:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 300));
}
test();
