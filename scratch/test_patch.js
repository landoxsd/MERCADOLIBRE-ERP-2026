const ExcelJS = require('exceljs');
const fs = require('fs');

// MONKEY PATCH
const CellXform = require('exceljs/lib/xlsx/xform/sheet/cell-xform.js');
const originalRender = CellXform.prototype.render;
CellXform.prototype.render = function(xmlStream, model, options) {
    if (model.sharedFormula) {
        const master = options.formulae[model.sharedFormula];
        if (!master) {
            console.log('Intercepted broken shared formula clone:', model.address);
            delete model.sharedFormula;
        }
    }
    return originalRender.call(this, xmlStream, model, options);
};

async function test() {
    try {
        const wb = new ExcelJS.Workbook();
        const buffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];

        const headerRow = ws.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || '').toLowerCase(), index: colNumber });
        });

        let currentRow = 5;
        for(let i=0; i<650; i++) {
            const row = ws.getRow(currentRow);
            columns.forEach(col => {
                const header = col.name;
                const colIdx = col.index;
                if (header === 'título') row.getCell(colIdx).value = 'Test';
            });
            row.commit();
            currentRow++;
        }
        
        // Let's also do a spliceRows just to be evil
        ws.spliceRows(currentRow, 10001 - currentRow + 1);

        const outBuf = await wb.xlsx.writeBuffer();
        console.log('writeBuffer success, length:', outBuf.length);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
