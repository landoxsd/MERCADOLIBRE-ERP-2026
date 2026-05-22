const token = 'APP_USR-2657663366318591-052123-28ce76202a0a8ccaed3a9e1b347c69ef-248086934';
async function test() {
    const url = 'https://api.mercadolibre.com/items/MLV574087854';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Title:', data.title);
    console.log('Sold:', data.sold_quantity);
}
test();
