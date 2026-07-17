import pool from './db.js';

async function createComprasTable() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS compras (
        id SERIAL PRIMARY KEY,
        item VARCHAR(255) NOT NULL,
        grupo VARCHAR(255),
        prioridade VARCHAR(50) NOT NULL,
        valor DECIMAL(10, 2) NOT NULL,
        comprado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
    console.log('Tabela compras criada com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar tabela compras:', error);
    process.exit(1);
  }
}

createComprasTable();
