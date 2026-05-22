const fs = require('fs');
const content = fs.readFileSync('src/lib/mlv-playwright-scraper.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('seller') || line.includes('CustId')) {
        console.log(i + 1, line);
    }
});
