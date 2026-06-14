import pool from './db.js';

async function run() {
  try {
    console.log('Restaurando colunas e tabelas criadas recentemente...');

    // 1. Reset Senha
    await pool.query(`
      ALTER TABLE auth.users 
      ADD COLUMN IF NOT EXISTS reset_password_token TEXT, 
      ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP WITH TIME ZONE;
    `);

    // 2. 2FA (Two Factor Authentication)
    await pool.query(`
      ALTER TABLE auth.users 
      ADD COLUMN IF NOT EXISTS two_factor_preference BOOLEAN DEFAULT NULL, 
      ADD COLUMN IF NOT EXISTS two_factor_code VARCHAR(6), 
      ADD COLUMN IF NOT EXISTS two_factor_expires_at TIMESTAMP WITH TIME ZONE;
    `);

    // 3. Roles e Tabela Config
    await pool.query(`
      ALTER TABLE auth.users 
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      INSERT INTO public.config (key, value)
      VALUES ('monthly_fee', '17.90')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 4. Módulo de Cupons
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

    // 5. Módulo de Despesas e Receitas - usa_media e categoria
    await pool.query(`
      ALTER TABLE public.despesas 
      ADD COLUMN IF NOT EXISTS usa_media BOOLEAN DEFAULT false;
    `);
    
    await pool.query(`
      ALTER TABLE public.receitas 
      ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Outros';
    `);
    
    await pool.query(`
      ALTER TABLE public.despesas 
      ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Outros';
    `);

    console.log('Restauracao concluida com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('Erro na restauracao:', err);
    process.exit(1);
  }
}

run();
