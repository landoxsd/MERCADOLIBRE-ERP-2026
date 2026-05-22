async function test() {
    let res = await fetch('https://api.mercadolibre.com/users/248086934');
    console.log('Status without token:', res.status);
    let data = await res.text();
    console.log('Response without token:', data.substring(0, 150));
}
test();
