async function getHTML() {
    const res = await fetch('https://listado.mercadolibre.com.ve/amortiguador-delantero-aveo');
    const html = await res.text();
    // find a card
    const idx = html.indexOf('ui-search-result__wrapper');
    if (idx > -1) {
        console.log(html.substring(idx, idx + 2000));
    }
}
getHTML();
