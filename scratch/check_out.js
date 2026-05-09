const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const buffer = fs.readFileSync('test_amortiguadores_out.xlsx');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const matches = xml.match(/<c r="B631".*?<\/c>/g);
    console.log('B631 xml in out file:', matches);
}
test().catch(console.error);
