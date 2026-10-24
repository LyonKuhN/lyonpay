import pool from '../db.js';
import { vencimentoFatura } from './datas.js';

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Carrega as regras de categoria do usuário (termo → categoria). */
export async function carregarRegras(ownerId) {
  const r = await pool.query('SELECT termo, categoria, tipo FROM public.regras_categoria WHERE user_id = $1 ORDER BY length(termo) DESC', [ownerId]);
  return r.rows.map((x) => ({ ...x, termoNorm: normalizar(x.termo) }));
}

export function categoriaPorRegras(regras, descricao, tipo) {
  const d = normalizar(descricao);
  const regra = regras.find((r) => (!r.tipo || r.tipo === tipo) && r.termoNorm && d.includes(r.termoNorm));
  return regra?.categoria || null;
}

/**
 * Grava itens importados (extrato, fatura ou Pluggy) sem duplicar: o import_id é único por usuário.
 * destino: { tipo: 'conta'|'cartao', id }
 * itens: [{ import_id, tipo: 'despesa'|'receita', descricao, valor, data, categoria }]
 */
export async function gravarImportacao(ownerId, destino, itens) {
  const client = await pool.connect();
  let inseridos = 0;
  let ignorados = 0;
  try {
    let conta = null;
    let cartao = null;
    if (destino?.tipo === 'conta') {
      conta = (await client.query('SELECT * FROM public.contas WHERE id = $1 AND user_id = $2', [destino.id, ownerId])).rows[0];
      if (!conta) throw Object.assign(new Error('Conta inválida.'), { status: 400 });
    } else if (destino?.tipo === 'cartao') {
      cartao = (await client.query('SELECT * FROM public.cartoes WHERE id = $1 AND user_id = $2', [destino.id, ownerId])).rows[0];
      if (!cartao) throw Object.assign(new Error('Cartão inválido.'), { status: 400 });
    } else {
      throw Object.assign(new Error('Escolha a conta ou o cartão de destino.'), { status: 400 });
    }
    const escopo = (conta || cartao).escopo || 'pessoal';

    await client.query('BEGIN');
    for (const it of itens) {
      const valor = Math.abs(Number(it.valor));
      if (!it.import_id || !it.descricao || !(valor > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(it.data || '')) {
        ignorados++;
        continue;
      }
      const categoria = it.categoria || 'Outros';
      let r;
      if (it.tipo === 'receita') {
        if (cartao) { ignorados++; continue; } // estornos/pagamentos de fatura não viram receita
        r = await client.query(
          `INSERT INTO public.receitas (user_id, descricao, valor, data_recebimento, categoria, conta_id, escopo, pendente, import_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
           ON CONFLICT (user_id, import_id) WHERE import_id IS NOT NULL DO NOTHING`,
          [ownerId, it.descricao.slice(0, 200), valor, it.data, categoria, conta.id, escopo, it.import_id],
        );
      } else if (cartao) {
        r = await client.query(
          `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, data_compra, tipo, categoria, cartao_id, escopo, pago, import_id)
           VALUES ($1, $2, $3, $4, $5, 'variavel', $6, $7, $8, false, $9)
           ON CONFLICT (user_id, import_id) WHERE import_id IS NOT NULL DO NOTHING`,
          [ownerId, it.descricao.slice(0, 200), valor, vencimentoFatura(it.data, cartao.dia_fechamento, cartao.dia_vencimento), it.data, categoria, cartao.id, escopo, it.import_id],
        );
      } else {
        r = await client.query(
          `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, data_pagamento, tipo, categoria, conta_id, escopo, pago, import_id)
           VALUES ($1, $2, $3, $4, $4, 'variavel', $5, $6, $7, true, $8)
           ON CONFLICT (user_id, import_id) WHERE import_id IS NOT NULL DO NOTHING`,
          [ownerId, it.descricao.slice(0, 200), valor, it.data, categoria, conta.id, escopo, it.import_id],
        );
      }
      if (r.rowCount) inseridos++;
      else ignorados++;
    }
    await client.query('COMMIT');
    return { inseridos, ignorados };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
