const { scrapeMeliSearch } = require('./src/lib/mlv-playwright-scraper.js');

(async () => {
    try {
        console.log("Fetching page 1 with CustId");
        const p1_custId = await scrapeMeliSearch('_CustId_1613638274', { maxItems: 50 });
        console.log("CustId P1 count:", p1_custId.length);

        console.log("Fetching page 2 with CustId");
        const p2_custId = await scrapeMeliSearch('_Desde_51_CustId_1613638274_NoIndex_True', { maxItems: 50 });
        console.log("CustId P2 count:", p2_custId.length);
        
        console.log("Fetching page 1 with Nickname");
        const p1_nick = await scrapeMeliSearch('PACA20231228094206', { maxItems: 50 });
        console.log("Nick P1 count:", p1_nick.length);

        console.log("Fetching page 2 with Nickname");
        const p2_nick = await scrapeMeliSearch('PACA20231228094206_Desde_51_NoIndex_True', { maxItems: 50 });
        console.log("Nick P2 count:", p2_nick.length);
        
        // Print an ID from p1_nick and p2_nick to see if they are different
        if (p1_nick.length > 0) console.log("P1 Nick first ID:", p1_nick[0].id);
        if (p2_nick.length > 0) console.log("P2 Nick first ID:", p2_nick[0].id);
        
    } catch (e) {
        console.error(e);
    }
})();
