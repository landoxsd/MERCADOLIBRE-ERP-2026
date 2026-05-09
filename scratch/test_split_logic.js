
const VEHICLE_MODELS = [
    'FIESTA', 'ECOSPORT', 'AVEO', 'CORSA', 'VITARA', 'OPTRA', 'SPARK', 'CRUZE', 'ORLANDO', 
    'LUV DMAX', 'D-MAX', 'KADETT', 'MONZA', 'SILVERADO', 'TAHOE', 'GRAND VITARA', 'SWIFT', 
    'ESTEEM', 'JIMNY', 'SAMURAI', 'EXPLORER', 'FOCUS', 'FUSION', 'RANGER', 'TRITON', 'HILUX',
    'COROLLA', 'YARIS', 'FORTUNER', 'CELICA', 'CAMRY', 'TERIOS', 'MERU', 'PRADO'
];

function splitApplications(rawTitle) {
    let title = String(rawTitle).toUpperCase().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    
    // Encontrar posiciones de los modelos
    let findings = [];
    VEHICLE_MODELS.forEach(model => {
        let pos = title.indexOf(model);
        while (pos !== -1) {
            findings.push({ model, pos });
            pos = title.indexOf(model, pos + 1);
        }
    });

    // Ordenar por posición
    findings.sort((a, b) => a.pos - b.pos);

    // Si no hay modelos o solo hay uno, no hay nada que separar
    if (findings.length <= 1) return [rawTitle];

    // Identificar el prefijo (lo que está antes del primer modelo)
    const firstModelPos = findings[0].pos;
    const prefix = title.substring(0, firstModelPos).trim();

    // Crear los segmentos
    let segments = [];
    for (let i = 0; i < findings.length; i++) {
        const start = findings[i].pos;
        const end = (i + 1 < findings.length) ? findings[i+1].pos : title.length;
        segments.push(title.substring(start, end).trim());
    }

    // Retornar títulos combinados
    return segments.map(seg => `${prefix} ${seg}`.trim());
}

const testTitle = "BASE MOTOR, DER.FIESTA 1.6 03-11 ECOSPORT 1.6 03-05 (INSERTO)";
console.log("Original:", testTitle);
console.log("Splitted Titles:");
splitApplications(testTitle).forEach(t => console.log("-", t));
