
const VEHICLE_MODELS = [
    'FIESTA', 'ECOSPORT', 'AVEO', 'CORSA', 'VITARA', 'OPTRA', 'SPARK', 'CRUZE', 'ORLANDO', 
    'LUV DMAX', 'D-MAX', 'KADETT', 'MONZA', 'SILVERADO', 'TAHOE', 'GRAND VITARA', 'SWIFT', 
    'ESTEEM', 'JIMNY', 'SAMURAI', 'EXPLORER', 'FOCUS', 'FUSION', 'RANGER', 'TRITON', 'HILUX',
    'COROLLA', 'YARIS', 'FORTUNER', 'CELICA', 'CAMRY', 'TERIOS', 'MERU', 'PRADO', 'BORA', 'GOL',
    'JETTA', 'PASSAT', 'TIGUAN', 'POLO', 'AMAROK', 'SENTRA', 'TIIDA', 'ALMERA', 'FRONTIER', 
    'PATHFINDER', 'PATROL', 'XTERRA', 'CIVIC', 'ACCORD', 'FIT', 'CRV', 'ODYSSEY', 'PILOT',
    'TUCSON', 'SANTA FE', 'ELANTRA', 'GETZ', 'ACCENT', 'SPORTAGE', 'RIO', 'PICANTO', 'SORENTO',
    'CERATO', 'K2700', 'CANTER', 'L300', 'L200', 'MONTERO', 'DAKAR', 'SIGNUM', 'LANCER',
    'LOGAN', 'SYMBOL', 'MEGANE', 'KANGOO', 'TWINGO', 'CLIO', 'DUSTER', 'SANDERO', 'CAPTUR',
    'GRAN CHEROKEE', 'CHEROKEE', 'LIBERTY', 'WRANGLER', 'WAGONEER', 'COMPASS', 'RENEGADE',
    'GRAND WAGONEER', 'COMMANDER', 'CALIBER', 'JOURNEY', 'RAM', 'DAKOTA', 'NEON', 'STRATUS',
    'BLAZER', 'S10', 'TRAILBLAZER', 'ASTRA', 'MERIVA', 'MONTANA', 'ZAFIRA', 'IMPALA', 'MALIBU',
    'COLORADO', 'CAPRICE', 'CELEBRITY', 'CAVALIER', 'CHEVETTE', 'KODIAK', 'NHR', 'NPR', 'NKR',
    'FVR', 'EXPRESS', 'VENTURE', 'LUMINA', 'MONTE CARLO', 'LEBARON', 'ASPEN', 'ENCAVA', 'IVECO',
    'MACK', 'SCANIA', 'VOLVO', 'FREIGHTLINER', 'INTERNATIONAL'
];

function getSplitTitles(rawTitle) {
    if (!rawTitle) return [];
    const cleanTitle = String(rawTitle).toUpperCase().replace(/[,().]/g, " ").replace(/\s+/g, " ").trim();
    console.log('Cleaned:', cleanTitle);
    let findings = [];
    VEHICLE_MODELS.forEach(model => {
        let pos = cleanTitle.indexOf(model);
        while (pos !== -1) {
            const isStart = pos === 0 || cleanTitle[pos-1] === ' ';
            const isEnd = pos + model.length === cleanTitle.length || cleanTitle[pos + model.length] === ' ';
            if (isStart && isEnd) {
                console.log('Found:', model, 'at', pos);
                findings.push({ model, pos });
            }
            pos = cleanTitle.indexOf(model, pos + 1);
        }
    });
    // Evitar que modelos cortos dentro de largos se dupliquen (ej. Cherokee dentro de Grand Cherokee)
    findings = findings.filter(f => !findings.some(other => 
        other !== f && 
        other.pos <= f.pos && 
        (other.pos + other.model.length) >= (f.pos + f.model.length) && 
        other.model.length > f.model.length
    ));
    findings.sort((a, b) => a.pos - b.pos);
    console.log('Findings:', findings);
    if (findings.length <= 1) return [rawTitle];

    const prefix = cleanTitle.substring(0, findings[0].pos).trim();
    console.log('Prefix:', prefix);
    let segments = [];
    for (let i = 0; i < findings.length; i++) {
        const start = findings[i].pos;
        const end = (i + 1 < findings.length) ? findings[i+1].pos : cleanTitle.length;
        segments.push(cleanTitle.substring(start, end).trim());
    }
    return segments.map(seg => `${prefix} ${seg}`.trim());
}

console.log('--- TEST 1 ---');
console.log(getSplitTitles('AMORTIGUADOR, DELT.IZQ.CALIBER 06-12 COMPASS 07-10 PATRIOT 07-10'));
