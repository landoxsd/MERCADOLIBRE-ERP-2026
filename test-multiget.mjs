import fetch from 'node-fetch'; // fallback
async function testMultiGet() {
    const idsParam = 'MLV758066860,MLV736413233'; // Just test a couple
    const url = 'https://api.mercadolibre.com/items?ids=' + idsParam;
    console.log('Fetching', url);
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data[0].body.title));
    console.log(data[0].body.seller_id);
    console.log(data[0].body.sold_quantity);
    console.log('Pictures:', data[0].body.pictures?.length);
}
testMultiGet();
