import pool from './db.js';

async function run() {
  try {
    await pool.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT NULL;`);
    console.log('Coluna two_factor_enabled adicionada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao adicionar coluna:', err);
    process.exit(1);
  }
}

run();
