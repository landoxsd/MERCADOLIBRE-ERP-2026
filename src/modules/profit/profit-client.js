// ================================================================
// src/modules/profit/profit-client.js
// Cliente de conexión SOLO LECTURA a Profit Plus (SQL Server)
// ⚠️ ESTE CLIENTE NUNCA DEBE EJECUTAR OPERACIONES DE ESCRITURA
// ================================================================
import './promise-polyfill.js';
import sql from 'mssql';

const profitConfig = {
  user: process.env.PROFIT_USER || 'profit',
  password: process.env.PROFIT_PASSWORD || 'profit',
  server: process.env.PROFIT_SERVER?.split(',')[0] || '192.168.1.10',
  port: parseInt(process.env.PROFIT_PORT || '1433', 10),
  database: process.env.PROFIT_DATABASE || 'RWC20_A',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    readOnlyIntent: true, // Solicitar conexión explícitamente en modo solo lectura
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 60000,
};

let poolPromise = null;

export async function getProfitPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(profitConfig).catch((err) => {
      poolPromise = null;
      console.error('❌ Error conectando a Profit Plus SQL Server:', err.message);
      throw err;
    });
  }
  return poolPromise;
}

/**
 * Ejecuta una consulta SOLO LECTURA con NOLOCK.
 * Lanza un error si la consulta contiene comandos que alteran datos.
 */
export async function queryProfit(queryText, params = {}) {
  const normalized = queryText.trim().toUpperCase();
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'EXEC'];
  for (const word of dangerous) {
    // Si la palabra aparece como comando (no como parte de una cadena o columna)
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalized)) {
      throw new Error(`OPERACIÓN DENEGADA: El cliente de Profit es estrictamente SOLO LECTURA. Comando prohibido: ${word}`);
    }
  }

  const pool = await getProfitPool();
  const request = pool.request();
  for (const [key, val] of Object.entries(params)) {
    request.input(key, val);
  }
  const result = await request.query(queryText);
  return result.recordset;
}
