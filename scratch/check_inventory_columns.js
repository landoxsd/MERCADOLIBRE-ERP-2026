
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'MUESTRAAMORTIGUADORES07052026.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(worksheet);

console.log('--- HEADERS ---');
if (json.length > 0) {
    console.log(Object.keys(json[0]));
} else {
    console.log('No data found');
}
console.log('--- FIRST ROW ---');
console.log(json[0]);
