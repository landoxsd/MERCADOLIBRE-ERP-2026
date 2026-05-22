const token = 'APP_USR-2657663366318591-052123-28ce76202a0a8ccaed3a9e1b347c69ef-248086934';
const seller_id = '248086934';
async function test() {
    const url = 'https://api.mercadolibre.com/users/' + seller_id + '/items/search';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    console.log('User Items:', data.results ? data.results.slice(0, 3) : data);
}
test();
