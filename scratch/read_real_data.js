
const XLSX = require('xlsx');

function readData(filename, sheetName) {
    const workbook = XLSX.readFile(filename);
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`--- Headers for ${filename} [Sheet: ${sheetName}] ---`);
    console.log(rows[0]?.slice(0, 30)); 
    console.log(rows[1]?.slice(0, 30)); 
    console.log(rows[2]?.slice(0, 30)); 
    console.log(rows[3]?.slice(0, 30)); 
    console.log('---------------------------');
}

readData('aceite para motor.xlsx', 'Para Motor');
readData('soporte para motor.xlsx', 'Soportes');
