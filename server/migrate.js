import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    console.log('Iniciando migração...');
    const schemaPath = path.join(__dirname, '..', 'database_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Executa o SQL. Nota: Se o arquivo for muito grande ou tiver comandos complexos 
    // que o pg não suporte em uma única chamada, pode ser necessário separar por ';'.
    // Mas para o schema padrão geralmente funciona.
    await pool.query(sql);
    
    console.log('Tabelas criadas com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  }
}

migrate();
