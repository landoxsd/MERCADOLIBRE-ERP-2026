const token = 'APP_USR-2657663366318591-052123-28ce76202a0a8ccaed3a9e1b347c69ef-248086934';
async function test() {
    let res = await fetch('https://api.mercadolibre.com/users/248086934', { headers: { 'Authorization': 'Bearer ' + token } });
    console.log('Status with token:', res.status);
    let data = await res.text();
    console.log('Response with token:', data.substring(0, 150));
}
test();
