
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'MUESTRAAMORTIGUADORES07052026.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const raw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- TARGET ROWS (5-12) ---');
raw.slice(5, 13).forEach((row, i) => {
    console.log(`Row ${i+5}:`, JSON.stringify(row));
});
