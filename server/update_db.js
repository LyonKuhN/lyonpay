import pool from './db.js';

async function update() {
  console.log("Iniciando atualização do banco...");
  try {
    // 1. Criar tabela de categorias (Garantindo colunas)
    await pool.query(`DROP TABLE IF EXISTS public.categorias CASCADE`);
    await pool.query(`
      CREATE TABLE public.categorias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
        cor TEXT DEFAULT '#a3ff12',
        icone TEXT DEFAULT 'Tag',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("Tabela categorias ok.");

    // 2. Adicionar coluna de categoria nas tabelas principais
    await pool.query(`ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Outros'`);
    await pool.query(`ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Outros'`);
    console.log("Colunas de categoria adicionadas.");

    // 3. Inserir categorias padrão
    const defaultCategories = [
      { nome: 'Alimentação', tipo: 'despesa', cor: '#FF4D4D', icone: 'Utensils' },
      { nome: 'Transporte', tipo: 'despesa', cor: '#FFD700', icone: 'Car' },
      { nome: 'Moradia', tipo: 'despesa', cor: '#00D1FF', icone: 'Home' },
      { nome: 'Lazer', tipo: 'despesa', cor: '#FF00FF', icone: 'Gamepad' },
      { nome: 'Saúde', tipo: 'despesa', cor: '#a3ff12', icone: 'Activity' },
      { nome: 'Salário', tipo: 'receita', cor: '#a3ff12', icone: 'DollarSign' },
      { nome: 'Investimentos', tipo: 'receita', cor: '#00D1FF', icone: 'TrendingUp' },
      { nome: 'Extra', tipo: 'receita', cor: '#FFD700', icone: 'Plus' },
    ];

    for (const cat of defaultCategories) {
      await pool.query(
        `INSERT INTO public.categorias (nome, tipo, cor, icone) VALUES ($1, $2, $3, $4)`,
        [cat.nome, cat.tipo, cat.cor, cat.icone]
      );
    }
    console.log("Categorias padrão inseridas.");

    console.log("Banco atualizado com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("Erro na atualização:", err);
    process.exit(1);
  }
}

update();
