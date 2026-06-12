import pool from './db.js';

async function run() {
  console.log("Adicionando coluna usa_media...");
  try {
    await pool.query(`ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS usa_media BOOLEAN DEFAULT false;`);
    console.log("Coluna adicionada com sucesso.");
    process.exit(0);
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  }
}
run();
