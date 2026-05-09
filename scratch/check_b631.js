const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const buffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const lines = xml.split('><');
    const b631 = lines.filter(l => l.includes('B631'));
    console.log('B631 xml tags:', b631);
}
test().catch(console.error);
