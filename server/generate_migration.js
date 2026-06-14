import fs from 'fs';
import path from 'path';
import pool from './db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_ID = 'c2583860-d1f5-4d8a-b084-28660df2c2f7';

const catMap = {
  'Outros': 'Cartão de Credito',
  'Moradia': 'Moradia',
  'Lazer': 'Lazer',
  'Cartão de Credito': 'Cartão de Credito',
  'Transporte': 'Transporte'
};

const descMap = {
  'Cartão (Nubank - Herik)': 'Nubank (Herik)',
  'Cartão (Nubank - Ana)': 'Nubank (Ana)',
  'Cartão (Amazon - Herik)': 'Amazon (Herik)',
  'Cartão (BMG - Herik)': 'BMG (Herik)',
  'Cartão (Inter - Herik)': 'INTER (Herik)',
  'Cartão (Havan - Herik)': 'HAVAN (Herik)',
  'Cartão Shoppe': 'Shoppe (Herik)',
  'Cartão (Mercado Pago - Herik)': 'Mercado Pago (Herik)',
  'Energia elétrica (CELESC)': 'Energia Elétrica (CELESC)',
  'Agua (VISAN)': 'Agua (VISAN)',
  'CAIXA (Casa)': 'Casa (CAIXA)',
  'BKUP (Internet)': 'Internet (BKUP)',
  'TIM (Herik & Juliana)': 'TIM (Herik)',
  'TIM (Ana)': 'TIM (Ana)',
  'TIM (Herik)': 'TIM (Herik)',
  'Seguro Carro (Pioneira)': 'Seguro Carro (PIONEIRO)',
  'Taxa Cartão Magazine Luiza': 'Taxa Magazine Luiza',
  'Magazine Luiza': 'Magazine Luiza (Herik)'
};

async function run() {
  try {
    const dbCategoriasRes = await pool.query('SELECT id, nome FROM categorias WHERE user_id = $1 OR user_id IS NULL', [USER_ID]);
    const categoriasDb = dbCategoriasRes.rows;
    
    const jsonPath = path.join(__dirname, '..', 'base_old.json');
    const oldData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    const filteredData = oldData.filter(d => {
      if (!d.data_vencimento) return false;
      return d.data_vencimento <= '2026-03-31';
    });
    
    const sqlStatements = [];
    sqlStatements.push('-- SCRIPT DE IMPORTAÇÃO (APENAS INSERT)');
    sqlStatements.push('-- IMPORTANTE: Este script NÃO apaga nenhum dado do banco atual.');
    sqlStatements.push(`-- Histórico importado para o usuário ${USER_ID}`);
    sqlStatements.push('-- Dados filtrados até 31/03/2026');
    sqlStatements.push('');
    
    for (const d of filteredData) {
      const bestCategoria = catMap[d.categoria] || d.categoria;
      const catMatch = categoriasDb.find(c => c.nome === bestCategoria);
      const categoria_id = catMatch ? catMatch.id : null;
      
      const bestDescricao = descMap[d.descricao] || d.descricao;
      
      const escapeStr = (str) => {
        if (str === null || str === undefined) return 'NULL';
        return "'" + String(str).replace(/'/g, "''") + "'";
      };
      
      const numOrNull = (val) => {
        if (val === null || val === undefined || val === '') return 'NULL';
        return val;
      };
      
      const boolOrFalse = (val) => val ? 'true' : 'false';
      
      const catIdVal = categoria_id ? escapeStr(categoria_id) : 'NULL';
      
      const sql = `INSERT INTO public.despesas (user_id, descricao, valor, categoria_id, categoria, data_vencimento, pago, data_pagamento, observacoes, tipo, numero_parcelas, valor_total, parcela_atual, is_modelo, created_at, updated_at) VALUES ('${USER_ID}', ${escapeStr(bestDescricao)}, ${numOrNull(d.valor)}, ${catIdVal}, ${escapeStr(bestCategoria)}, ${escapeStr(d.data_vencimento)}, ${boolOrFalse(d.pago)}, ${escapeStr(d.data_pagamento)}, ${escapeStr(d.observacoes)}, ${escapeStr(d.tipo)}, ${numOrNull(d.numero_parcelas)}, ${numOrNull(d.valor_total)}, ${numOrNull(d.parcela_atual)}, ${boolOrFalse(d.is_modelo)}, ${escapeStr(d.created_at)}, ${escapeStr(d.updated_at)});`;
      
      sqlStatements.push(sql);
    }
    
    const outPath = path.join(__dirname, '..', 'import_old_data.sql');
    fs.writeFileSync(outPath, sqlStatements.join('\n'));
    console.log('Script de importação gerado no arquivo import_old_data.sql');
    process.exit(0);
    
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

run();
