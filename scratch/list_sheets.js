
const XLSX = require('xlsx');

function listSheets(filename) {
    const workbook = XLSX.readFile(filename);
    console.log(`Sheets in ${filename}:`, workbook.SheetNames);
}

listSheets('aceite para motor.xlsx');
listSheets('soporte para motor.xlsx');
