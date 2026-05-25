const nickname = 'Los Chamos BRG';
const slug = nickname.toLowerCase().trim().replace(/ /g, '-');
const urls = [
    `https://www.mercadolibre.com.ve/tienda/${slug}`,
    `https://perfil.mercadolibre.com.ve/vendedor/${slug}`,
    `https://perfil.mercadolibre.com.ve/${slug}`
];
(async () => {
    for(const url of urls) {
        try {
            const r = await fetch(url);
            console.log(url, r.status);
            const text = await r.text();
            console.log("length:", text.length);
        } catch(e) { console.log(e.message); }
    }
})();
