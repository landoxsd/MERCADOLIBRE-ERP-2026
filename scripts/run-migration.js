require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILE = process.argv[2] || path.join(__dirname, '..', 'supabase', 'migration_2026-05-03.sql');

// Usar DIRECT_URL (sin pgbouncer) para DDL
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ No se encontró DIRECT_URL ni DATABASE_URL en .env');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log('📡 Conectando a Supabase...');
    await client.connect();
    console.log('✅ Conectado.\n');

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
    console.log(`📄 Ejecutando migración: ${path.basename(MIGRATION_FILE)}`);
    console.log(`📏 Tamaño: ${sql.length} caracteres\n`);

    try {
        await client.query(sql);
        console.log('✅ Migración ejecutada exitosamente.\n');

        // Verificar tablas creadas
        const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('ml_notifications', 'category_mappings')
      ORDER BY table_name;
    `);

        console.log('📋 Tablas verificadas:');
        for (const row of rows) {
            console.log(`   ✅ ${row.table_name}`);
        }

        // Verificar columnas nuevas en meli_accounts
        const { rows: cols } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'meli_accounts' 
        AND column_name IN ('needs_reauth', 'reauth_error')
      ORDER BY column_name;
    `);

        console.log('\n📋 Columnas nuevas en meli_accounts:');
        for (const row of cols) {
            console.log(`   ✅ ${row.column_name}`);
        }

    } catch (err) {
        console.error('\n❌ Error ejecutando migración:');
        console.error(err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n🔌 Conexión cerrada.');
    }
}

run();