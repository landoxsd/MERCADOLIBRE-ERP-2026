const ExcelJS = require('exceljs');

async function test() {
    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile('AMORTIGUADOR1.xlsx');
        const ws = wb.worksheets[0];

        // WORKAROUND
        ws.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (cell.type === 6 && cell.sharedFormula) {
                    delete cell.sharedFormula;
                }
            });
        });

        const headerRow = ws.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || '').toLowerCase(), index: colNumber });
        });

        let currentRow = 5;
        for(let i=0; i<650; i++) {
            const row = ws.getRow(currentRow);
            columns.forEach(col => {
                if(col.name === 'título') row.getCell(col.index).value = 'Amortiguador Test ' + i;
                else if(col.name === 'sku') row.getCell(col.index).value = 'TEST-' + i;
                else if(col.name === 'stock') row.getCell(col.index).value = 10;
            });
            row.commit();
            currentRow++;
        }

        await wb.xlsx.writeFile('test_amortiguadores_out.xlsx');
        console.log('Success! No B631 error.');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
