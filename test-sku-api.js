const token = 'APP_USR-2657663366318591-052123-28ce76202a0a8ccaed3a9e1b347c69ef-248086934';
async function test() {
    let res = await fetch('https://api.mercadolibre.com/items/MLV828925364', { headers: { 'Authorization': 'Bearer ' + token } });
    console.log('Status with token:', res.status);
    let data = await res.json();
    if (data.attributes) {
        console.log('Attributes:', data.attributes.filter(a => a.id.includes('SKU') || a.id.includes('PART_NUMBER')));
    }
    console.log('Seller ID:', data.seller_id);
}
test();
