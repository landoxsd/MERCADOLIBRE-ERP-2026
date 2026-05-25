(async () => {
    const res = await fetch('https://listado.mercadolibre.com.ve/pagina/paca20231228094206', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-VE,es;q=0.9,en-US;q=0.8',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('Hubo error?', html.includes('Hubo un error'));
    console.log('Items?', html.includes('ui-search-layout__item'));
})();
