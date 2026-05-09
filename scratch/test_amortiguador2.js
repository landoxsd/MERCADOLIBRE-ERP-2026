const ExcelJS = require('exceljs');

async function test() {
    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile('AMORTIGUADOR1.xlsx');
        const ws = wb.worksheets[0];

        // NO WORKAROUND THIS TIME
        // I want to see if writing to specific columns triggers the error

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
                if (!header) return;

                if (header === 'título' || header.includes('título: incluye')) row.getCell(colIdx).value = 'Test';
                else if (header === 'sku' || header.includes('sku / código')) row.getCell(colIdx).value = 'TEST';
                else if (header === 'stock' || header.includes('cantidad')) row.getCell(colIdx).value = 10;
                else if (header === 'precio' || header.includes('precio [us$]')) row.getCell(colIdx).value = 100;
                else if (header === 'fotos' || header.includes('fotos (url)')) row.getCell(colIdx).value = 'http://test';
                else if (header === 'descripción') row.getCell(colIdx).value = 'Test desc';
                else if (header === 'condición') row.getCell(colIdx).value = 'Nuevo';
                else if (header === 'marca') row.getCell(colIdx).value = 'Test';
                else if (header === 'número de pieza') row.getCell(colIdx).value = 'Test';
                else if (header.includes('tipo de publicación')) row.getCell(colIdx).value = 'Premium';
                else if (header.includes('forma de envío')) row.getCell(colIdx).value = 'Mercado Envíos';
                else if (header.includes('costo de envío')) row.getCell(colIdx).value = 'Envío gratis';
                else if (header.includes('retiro en persona')) row.getCell(colIdx).value = 'Acepto';
                else if (header.includes('tipo de garantía')) row.getCell(colIdx).value = 'Garantía del vendedor';
                else if (header.includes('tiempo de garantía')) row.getCell(colIdx).value = 30;
                else if (header.includes('unidad de tiempo de garantía')) row.getCell(colIdx).value = 'días';
            });
            row.commit();
            currentRow++;
        }

        const buf = await wb.xlsx.writeBuffer();
        console.log('writeBuffer success, length:', buf.length);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
