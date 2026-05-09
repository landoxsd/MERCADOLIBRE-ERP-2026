const fs = require('fs');
const code = fs.readFileSync('node_modules/exceljs/lib/xlsx/xform/sheet/cell-xform.js', 'utf8');
const lines = code.split('\n');
const matchIdx = lines.findIndex(l => l.includes('Shared Formula master must exist'));
if (matchIdx !== -1) {
    console.log(lines.slice(matchIdx - 5, matchIdx + 5).join('\n'));
}
