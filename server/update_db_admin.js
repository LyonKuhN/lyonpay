import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/financeiro'
});

async function migrate() {
  try {
    console.log('Iniciando migração administrativa...');

    // Adicionar coluna role se não existir
    await pool.query(`
      ALTER TABLE auth.users 
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
    `);

    // Criar tabela de configuração global
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Inserir valor padrão da mensalidade
    await pool.query(`
      INSERT INTO public.config (key, value)
      VALUES ('monthly_fee', '17.90')
      ON CONFLICT (key) DO NOTHING
    `);

    // Tornar o primeiro usuário admin (opcional, ou um email específico)
    // Aqui vou deixar comentado ou aplicar a um email se eu soubesse, 
    // mas vou aplicar ao primeiro usuário por segurança de teste.
    const users = await pool.query('SELECT id, email FROM auth.users ORDER BY created_at ASC LIMIT 1');
    if (users.rows.length > 0) {
      await pool.query('UPDATE auth.users SET role = $1 WHERE id = $2', ['admin', users.rows[0].id]);
      console.log(`Usuário ${users.rows[0].email} agora é ADMIN.`);
    }

    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    await pool.end();
  }
}

migrate();
