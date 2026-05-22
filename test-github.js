async function test() {
    const res = await fetch('https://api.github.com/repos/FedeSobre/meli-challenge/readme');
    const data = await res.json();
    console.log(Buffer.from(data.content, 'base64').toString('utf8'));
}
test();
