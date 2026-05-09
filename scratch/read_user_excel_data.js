
const XLSX = require('xlsx');

function readDataSheet(filename) {
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[1]; // Try the second sheet
    if (!sheetName) {
        console.log(`No second sheet in ${filename}`);
        return;
    }
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`--- Data Headers for ${filename} [Sheet: ${sheetName}] ---`);
    console.log(rows[0]?.slice(0, 20)); // First few columns of row 0
    console.log(rows[1]?.slice(0, 20)); // Row 1
    console.log(rows[2]?.slice(0, 20)); // Row 2
    console.log('---------------------------');
}

try {
    readDataSheet('aceite para motor.xlsx');
    readDataSheet('soporte para motor.xlsx');
} catch (e) {
    console.error(e);
}
