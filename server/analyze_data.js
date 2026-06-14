import fs from 'fs';
import path from 'path';
import pool from './db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_ID = 'c2583860-d1f5-4d8a-b084-28660df2c2f7';

async function run() {
  try {
    const dbCategorias = await pool.query('SELECT nome FROM categorias WHERE user_id = $1 OR user_id IS NULL', [USER_ID]);
    const dbDespesas = await pool.query('SELECT DISTINCT descricao FROM despesas WHERE user_id = $1', [USER_ID]);
    
    const jsonPath = path.join(__dirname, '..', 'base_old.json');
    const oldData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const filteredData = oldData.filter(d => d.data_vencimento && d.data_vencimento <= '2026-03-31');
    
    const oldCategorias = [...new Set(filteredData.map(d => d.categoria))];
    const oldDespesas = [...new Set(filteredData.map(d => d.descricao))];
    
    console.log("=== CATEGORIAS NO BANCO ATUAL ===");
    console.log(dbCategorias.rows.map(r => r.nome).join(', '));
    
    console.log("\n=== DESPESAS NO BANCO ATUAL ===");
    console.log(dbDespesas.rows.map(r => r.descricao).join(', '));
    
    console.log("\n=== CATEGORIAS NO ARQUIVO ANTIGO (<= 03/26) ===");
    console.log(oldCategorias.join(', '));
    
    console.log("\n=== DESPESAS NO ARQUIVO ANTIGO (<= 03/26) ===");
    console.log(oldDespesas.join(', '));
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
