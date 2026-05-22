async function testMeliItem() {
    const url = 'https://api.mercadolibre.com/items/MLV581037829';
    console.log('Fetching', url);
    const res = await fetch(url);
    const data = await res.json();
    console.log(data);
}
testMeliItem();
