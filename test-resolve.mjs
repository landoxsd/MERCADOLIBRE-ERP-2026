import dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function test() {
    const accessToken = "APP_USR-2657663366318591-052323-93f0cf0526a1ba758236f8583d60a324-1539376793";
    const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
    };

    const itemId = "MLV722271126";
    console.log(`Buscando reviews del item: ${itemId}`);
    try {
        const res = await fetch(`https://api.mercadolibre.com/reviews/item/${itemId}`, { headers });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Reviews data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
