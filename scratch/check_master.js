const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const buffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const matches = xml.match(/<c r="[A-Z]+[0-9]+".*?<f t="shared".*?si="27".*?>.*?<\/f>.*?<\/c>/g);
    console.log('Master for si=27:', matches);
}
test().catch(console.error);
