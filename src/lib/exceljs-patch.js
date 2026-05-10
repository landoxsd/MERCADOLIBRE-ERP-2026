/**
 * EXCELJS MONKEY-PATCH CRÍTICO
 * 
 * Este módulo intercepta el motor interno de ExcelJS para corregir el error:
 * "Shared Formula master must exist above and or left of clone for cell..."
 * 
 * Es necesario para procesar las plantillas de Mercado Libre que contienen
 * fórmulas compartidas corruptas o huérfanas.
 */

try {
    // Intentamos requerir el componente interno de celdas
    const CellXform = require('exceljs/lib/xlsx/xform/sheet/cell-xform.js');
    
    if (CellXform && CellXform.prototype && CellXform.prototype.render) {
        const originalRender = CellXform.prototype.render;
        
        CellXform.prototype.render = function(xmlStream, model, options) {
            if (model.sharedFormula) {
                const formulae = options.formulae || {};
                const master = formulae[model.sharedFormula];
                
                if (!master) {
                    // WORKAROUND: Si el maestro de la fórmula compartida no existe,
                    // convertimos la celda en una celda de valor estático para evitar el crash.
                    // console.log(`[ExcelJS Patch] Desvinculando fórmula huérfana en ${model.address}`);
                    delete model.sharedFormula;
                }
            }
            return originalRender.call(this, xmlStream, model, options);
        };
        // console.log("✅ [ExcelJS Patch] Aplicado con éxito.");
    }
} catch (e) {
    // En algunos entornos el path puede variar o estar empaquetado diferente
    // console.error("❌ [ExcelJS Patch] No se pudo aplicar:", e.message);
}

export default {};
