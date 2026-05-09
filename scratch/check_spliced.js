const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const buffer = fs.readFileSync('scratch/spliced.xlsx');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const matches = xml.match(/<c r="B631".*?<\/c>/g);
    console.log('B631 exists?', !!matches, matches);
}
test().catch(console.error);
