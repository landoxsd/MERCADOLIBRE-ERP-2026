const crypto = require("crypto");

/** Normaliza montos de Banesco (1.234,56 -> 1234.56) */
function parseVenezuelanNumber(s) {
  if (!s) return 0;
  // Quitar puntos de miles y cambiar coma decimal por punto
  const cleaned = String(s).trim().replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Convierte DD/MM/YYYY a YYYY-MM-DD */
function parseFechaToIso(fechaRaw) {
  const t = String(fechaRaw || "").trim();
  if (!t) return null;
  const partes = t.split(/[/.\-]/);
  if (partes.length !== 3) return null;
  const [dd, mm, yyyy] = partes.map(x => x.trim().padStart(2, '0'));
  return `${yyyy}-${mm}-${dd}`;
}

/** Genera el hash único igual que SoloMotor */
function generateRowHash(cols) {
  // cols[0]: Fecha, cols[1]: Referencia, cols[3]: Monto
  const data = `${cols[0]}|${cols[1]}|${cols[3]}`;
  return crypto.createHash("md5").update(data).digest("hex");
}

/** Procesa el contenido del TXT de Banesco */
function parseBanescoTxt(txtContent) {
  const lines = txtContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const movements = [];
  
  // Banesco suele usar ";" o "|" como delimitador
  const delimiter = lines[0].includes("|") ? "|" : ";";

  for (const line of lines) {
    const cols = line.split(delimiter).map(c => c.trim());
    if (cols.length < 4) continue;

    const txDate = parseFechaToIso(cols[0]);
    if (!txDate) continue;

    const amount = parseVenezuelanNumber(cols[3]);
    if (amount <= 0) continue; // Solo nos interesan los créditos (ingresos)

    movements.push({
      tx_date: txDate,
      reference_number: cols[1],
      description: cols[2],
      amount: amount,
      tx_type: "CREDIT",
      row_hash: generateRowHash(cols)
    });
  }
  
  return movements;
}

module.exports = { parseBanescoTxt };
