const token = 'APP_USR-2657663366318591-052123-28ce76202a0a8ccaed3a9e1b347c69ef-248086934';
async function test() {
    const res = await fetch('https://api.mercadolibre.com/visits/items?ids=MLV581037829,MLV574087854', { headers: { 'Authorization': 'Bearer ' + token } });
    console.log('Status with token:', res.status);
    const data = await res.text();
    console.log('Response:', data.substring(0, 200));
}
test();
