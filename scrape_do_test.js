const url = "https://articulo.mercadolibre.com.ve/MLV-817488516-rodamientos-delanteros-y-traseros-aveo-_JM";
const token = "7956a5c796c24f45af6661a909ffe7ccbf3af4b1c0d";
const targetUrl = encodeURIComponent(url);
const apiUrl = `http://api.scrape.do?token=${token}&url=${targetUrl}&render=true`;

console.log(`Calling Scrape.do API...`);
const start = Date.now();

fetch(apiUrl)
    .then(res => res.text())
    .then(html => {
        const time = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`Received ${html.length} bytes in ${time} seconds.`);
        
        // Simple regex extraction for testing
        const soldMatch = html.match(/(?:más de|\+)?\s*(\d+)\s*(?:productos\s+)?vendidos/i);
        console.log("Ventas:", soldMatch ? soldMatch[1] : "No encontradas");
        
        // Basic breadcrumb extraction
        const breadcrumbRegex = /<a[^>]*class="andes-breadcrumb__link"[^>]*>(.*?)<\/a>/g;
        let match;
        const breadcrumbs = [];
        while ((match = breadcrumbRegex.exec(html)) !== null) {
            breadcrumbs.push(match[1].trim());
        }
        console.log("Categorías:", breadcrumbs.length > 0 ? breadcrumbs.join(" > ") : "No encontradas");
        
        if (html.includes("verifyChallenge()")) {
            console.log("WARNING: Scrape.do fue bloqueado por el Captcha Anubis (necesita mejor configuración de JS/proxies).");
        } else {
            console.log("SUCCESS: Página renderizada correctamente sin Captcha visible en el HTML final.");
        }
    })
    .catch(err => console.error("Error:", err));
