async function test() {
    const res = await fetch('https://api.mercadolibre.com/visits/items?ids=MLV581037829');
    console.log('Status without token:', res.status);
    const data = await res.text();
    console.log('Response:', data.substring(0, 200));
}
test();
