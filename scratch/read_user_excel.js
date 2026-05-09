
const XLSX = require('xlsx');

function readHeaders(filename) {
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`--- Headers for ${filename} ---`);
    console.log(rows[0]); // Pestaña 1 headers
    console.log(rows[1]); 
    console.log(rows[2]);
    console.log('---------------------------');
}

try {
    readHeaders('aceite para motor.xlsx');
    readHeaders('soporte para motor.xlsx');
} catch (e) {
    console.error(e);
}
