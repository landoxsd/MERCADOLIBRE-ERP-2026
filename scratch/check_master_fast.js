const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const buffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const lines = xml.split('><');
    const masters = lines.filter(l => l.includes('t="shared"') && l.includes('ref='));
    const si27 = masters.filter(l => l.includes('si="27"'));
    console.log('Masters with si=27:', si27);
    
    // Also find ALL si=27
    const allSi27 = lines.filter(l => l.includes('si="27"'));
    console.log('Total si=27 found:', allSi27.length);
}
test().catch(console.error);
