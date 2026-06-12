import pool from './db.js';

async function migrate() {
  try {
    console.log('Iniciando migração de Cupons...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cupons (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        codigo text NOT NULL UNIQUE,
        desconto_percentual numeric NOT NULL CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
        max_usos integer DEFAULT NULL,
        usos_atuais integer DEFAULT 0,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        PRIMARY KEY (id)
      );

      CREATE TABLE IF NOT EXISTS public.cupons_usados (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
        cupom_id uuid NOT NULL REFERENCES public.cupons (id) ON DELETE CASCADE,
        usado_em timestamp with time zone NOT NULL DEFAULT now(),
        PRIMARY KEY (id),
        UNIQUE (user_id, cupom_id)
      );
    `);
    
    console.log('Tabelas de cupons criadas com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  }
}

migrate();
