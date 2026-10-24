import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { autenticado } from '../lib/sessao.js';
import { hojeSP, somarMeses, vencimentoFatura } from '../lib/datas.js';
import { gerarMes, lancarModeloNoMes } from '../geracao.js';

const router = Router();

const erro = (res, err, msg = 'Não foi possível concluir a operação.') => {
  console.error('ERRO:', err);
  res.status(500).json({ error: msg });
};

const numero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const escopoValido = (e) => (e === 'empresa' ? 'empresa' : 'pessoal');

async function pertence(tabela, id, ownerId) {
  if (!id) return true;
  const r = await pool.query(`SELECT 1 FROM public.${tabela} WHERE id = $1 AND user_id = $2`, [id, ownerId]);
  return r.rows.length > 0;
}

async function cartaoDoDono(id, ownerId) {
  if (!id) return null;
  const r = await pool.query('SELECT * FROM public.cartoes WHERE id = $1 AND user_id = $2', [id, ownerId]);
  return r.rows[0] || null;
}

// ---------------------------------------------------------------- Categorias
router.get('/categorias', autenticado, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM public.categorias WHERE user_id IS NULL OR user_id = $1 ORDER BY nome ASC', [req.ownerId]);
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.post('/categorias', autenticado, async (req, res) => {
  const { nome, tipo, cor, icone } = req.body;
  if (!nome || !['despesa', 'receita'].includes(tipo)) return res.status(400).json({ error: 'Informe nome e tipo da categoria.' });
  try {
    const r = await pool.query('INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.ownerId, nome.trim(), tipo, cor, icone]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Busca
router.get('/search', autenticado, async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  try {
    const d = await pool.query(`SELECT *, 'despesa' AS row_type FROM public.despesas WHERE user_id = $1 AND descricao ILIKE $2 AND is_modelo = false ORDER BY data_vencimento DESC LIMIT 100`, [req.ownerId, q]);
    const r = await pool.query(`SELECT *, 'receita' AS row_type FROM public.receitas WHERE user_id = $1 AND descricao ILIKE $2 ORDER BY data_recebimento DESC LIMIT 100`, [req.ownerId, q]);
    res.json([...d.rows, ...r.rows]);
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Receitas
router.get('/receitas', autenticado, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM public.receitas WHERE user_id = $1 ORDER BY data_recebimento DESC', [req.ownerId]);
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.post('/receitas', autenticado, async (req, res) => {
  const { descricao, valor, data_recebimento, categoria, conta_id, escopo, pendente } = req.body;
  if (!descricao || !(Number(valor) > 0) || !data_recebimento) return res.status(400).json({ error: 'Informe descrição, valor e data.' });
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `INSERT INTO public.receitas (user_id, descricao, valor, data_recebimento, categoria, conta_id, escopo, pendente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.ownerId, descricao, valor, data_recebimento, categoria || 'Outros', conta_id || null, escopoValido(escopo), !!pendente],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/receitas/:id', autenticado, async (req, res) => {
  const { descricao, valor, data_recebimento, categoria, conta_id, escopo, pendente } = req.body;
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `UPDATE public.receitas SET descricao = $1, valor = $2, data_recebimento = $3, categoria = $4, conta_id = $5, escopo = $6,
         pendente = COALESCE($7, pendente)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [descricao, valor, data_recebimento, categoria || 'Outros', conta_id || null, escopoValido(escopo), pendente === undefined ? null : !!pendente, req.params.id, req.ownerId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Receita não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.patch('/receitas/:id/valor', autenticado, async (req, res) => {
  try {
    await pool.query('UPDATE public.receitas SET valor = $1 WHERE id = $2 AND user_id = $3', [req.body.valor, req.params.id, req.ownerId]);
    res.json({ message: 'Valor atualizado' });
  } catch (err) { erro(res, err); }
});

/** Confirma que uma receita prevista entrou (data e conta reais). */
router.patch('/receitas/:id/receber', autenticado, async (req, res) => {
  const { data, conta_id, valor } = req.body || {};
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `UPDATE public.receitas SET pendente = false, data_recebimento = COALESCE($1::date, data_recebimento),
         conta_id = COALESCE($2, conta_id), valor = COALESCE($3, valor)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [data || null, conta_id || null, numero(valor), req.params.id, req.ownerId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Receita não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.patch('/receitas/:id/pendente', autenticado, async (req, res) => {
  try {
    await pool.query('UPDATE public.receitas SET pendente = true WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

router.delete('/receitas/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.receitas WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ message: 'Receita excluída' });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Despesas
router.get('/despesas', autenticado, async (req, res) => {
  const { month, year } = req.query;
  let sql = 'SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = false';
  const params = [req.ownerId];
  if (year) {
    if (month && month !== 'all' && month !== '0') {
      sql += ' AND EXTRACT(MONTH FROM data_vencimento) = $2 AND EXTRACT(YEAR FROM data_vencimento) = $3';
      params.push(parseInt(month), parseInt(year));
    } else {
      sql += ' AND EXTRACT(YEAR FROM data_vencimento) = $2';
      params.push(parseInt(year));
    }
  }
  sql += ' ORDER BY data_vencimento DESC';
  try {
    res.json((await pool.query(sql, params)).rows);
  } catch (err) { erro(res, err); }
});

router.get('/despesas/atrasadas', autenticado, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM public.despesas WHERE user_id = $1 AND pago = false AND is_modelo = false AND data_vencimento < $2::date ORDER BY data_vencimento ASC`,
      [req.ownerId, hojeSP()],
    );
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.get('/despesas/modelos', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = true ORDER BY descricao ASC', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/despesas', autenticado, async (req, res) => {
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria, datas_personalizadas, conta_id, cartao_id, data_compra, escopo, usa_media } = req.body;
  const groupId = crypto.randomUUID();
  const cat = categoria || 'Outros';
  const esc = escopoValido(escopo);
  try {
    if (!descricao || !(Number(valor) > 0)) return res.status(400).json({ error: 'Informe descrição e valor.' });
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const cartao = await cartaoDoDono(cartao_id, req.ownerId);
    if (cartao_id && !cartao) return res.status(400).json({ error: 'Cartão inválido.' });

    const vValor = numero(valor);
    const vTotal = numero(valor_total);
    const vParcelas = numero_parcelas ? parseInt(numero_parcelas) : null;

    // Compra no cartão: o vencimento é o da fatura em que a compra cai
    const compra = cartao ? (data_compra || data_vencimento || hojeSP()) : null;
    const primeiroVenc = cartao && tipo !== 'fixa' ? vencimentoFatura(compra, cartao.dia_fechamento, cartao.dia_vencimento) : data_vencimento;

    if (tipo === 'parcelada' && vParcelas > 1) {
      const usarDatas = !cartao && Array.isArray(datas_personalizadas) && datas_personalizadas.length === vParcelas;
      const criadas = [];
      for (let i = 0; i < vParcelas; i++) {
        const venc = usarDatas ? datas_personalizadas[i] : somarMeses(primeiroVenc, i);
        const r = await pool.query(
          `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, parcela_atual, group_id, categoria, conta_id, cartao_id, data_compra, escopo)
           VALUES ($1, $2, $3, $4, 'parcelada', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
          [req.ownerId, `${descricao} (${i + 1}/${vParcelas})`, vValor, venc, vParcelas, vTotal, observacoes, i + 1, groupId, cat, conta_id || null, cartao?.id || null, compra, esc],
        );
        criadas.push(r.rows[0]);
      }
      return res.json(criadas);
    }

    const isModelo = tipo === 'fixa';
    const r = await pool.query(
      `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, is_modelo, categoria, usa_media, conta_id, cartao_id, data_compra, escopo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [req.ownerId, descricao, vValor, primeiroVenc, tipo || 'variavel', vParcelas, vTotal, observacoes, isModelo, cat, !!usa_media, conta_id || null, cartao?.id || null, isModelo ? null : compra, esc],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err, 'Não foi possível salvar a despesa.'); }
});

router.put('/despesas/:id', autenticado, async (req, res) => {
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria, usa_media, conta_id, cartao_id, data_compra, escopo, recalcular_fatura } = req.body;
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const cartao = await cartaoDoDono(cartao_id, req.ownerId);
    if (cartao_id && !cartao) return res.status(400).json({ error: 'Cartão inválido.' });
    let venc = data_vencimento;
    if (cartao && recalcular_fatura && data_compra) venc = vencimentoFatura(data_compra, cartao.dia_fechamento, cartao.dia_vencimento);
    const r = await pool.query(
      `UPDATE public.despesas SET descricao = $1, valor = $2, data_vencimento = $3, tipo = $4, numero_parcelas = $5, valor_total = $6,
         observacoes = $7, categoria = $8, usa_media = $9, conta_id = $10, cartao_id = $11, data_compra = $12, escopo = $13, updated_at = now()
       WHERE id = $14 AND user_id = $15 RETURNING *`,
      [descricao, numero(valor), venc, tipo, numero_parcelas ? parseInt(numero_parcelas) : null, numero(valor_total), observacoes, categoria || 'Outros', !!usa_media,
        conta_id || null, cartao?.id || null, cartao ? (data_compra || null) : null, escopoValido(escopo), req.params.id, req.ownerId],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/despesas/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.despesas WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ message: 'Removido' });
  } catch (err) { erro(res, err); }
});

/**
 * Pagamento com data e valor reais.
 * - valor_pago maior que o valor: juros/multa ficam no valor pago.
 * - valor_pago menor e gerar_restante: o que faltou vira uma nova conta pendente.
 */
router.patch('/despesas/:id/pagar', autenticado, async (req, res) => {
  const { data_pagamento, valor_pago, conta_id, gerar_restante } = req.body || {};
  const client = await pool.connect();
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    await client.query('BEGIN');
    const atual = await client.query('SELECT d.*, c.conta_pagamento_id FROM public.despesas d LEFT JOIN public.cartoes c ON c.id = d.cartao_id WHERE d.id = $1 AND d.user_id = $2 FOR UPDATE OF d', [req.params.id, req.ownerId]);
    const d = atual.rows[0];
    if (!d) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    const pago = numero(valor_pago);
    const valorPago = pago !== null && Math.abs(pago - Number(d.valor)) > 0.004 ? pago : null;
    await client.query(
      `UPDATE public.despesas SET pago = true, data_pagamento = $1, valor_pago = $2, conta_id = COALESCE($3, conta_id, $4), updated_at = now() WHERE id = $5`,
      [data_pagamento || hojeSP(), valorPago, conta_id || null, d.conta_pagamento_id || null, d.id],
    );
    let restante = null;
    if (valorPago !== null && valorPago < Number(d.valor) && gerar_restante) {
      const falta = (Number(d.valor) - valorPago).toFixed(2);
      const r = await client.query(
        `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, observacoes, categoria, conta_id, cartao_id, data_compra, escopo)
         VALUES ($1, $2, $3, $4, 'variavel', $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.ownerId, `${d.descricao} (restante)`, falta, d.data_vencimento, d.observacoes, d.categoria, d.conta_id, d.cartao_id, d.data_compra, d.escopo],
      );
      restante = r.rows[0];
    }
    await client.query('COMMIT');
    res.json({ message: 'Pago', restante });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    erro(res, err);
  } finally {
    client.release();
  }
});

/** Paga várias contas de uma vez (ex.: a fatura inteira de um cartão). */
router.patch('/despesas/pagar-lote', autenticado, async (req, res) => {
  const { ids, data_pagamento, conta_id } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Selecione as contas.' });
  try {
    if (!(await pertence('contas', conta_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `UPDATE public.despesas d SET pago = true, data_pagamento = $1, valor_pago = NULL,
         conta_id = COALESCE($2, d.conta_id, (SELECT c.conta_pagamento_id FROM public.cartoes c WHERE c.id = d.cartao_id)), updated_at = now()
       WHERE d.user_id = $3 AND d.id = ANY($4::uuid[]) AND d.pago = false`,
      [data_pagamento || hojeSP(), conta_id || null, req.ownerId, ids],
    );
    res.json({ pagas: r.rowCount });
  } catch (err) { erro(res, err); }
});

router.patch('/despesas/:id/pendente', autenticado, async (req, res) => {
  try {
    await pool.query('UPDATE public.despesas SET pago = false, data_pagamento = null, valor_pago = null WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ message: 'Pendente' });
  } catch (err) { erro(res, err); }
});

router.patch('/despesas/:id/valor', autenticado, async (req, res) => {
  try {
    await pool.query('UPDATE public.despesas SET valor = $1 WHERE id = $2 AND user_id = $3', [req.body.valor, req.params.id, req.ownerId]);
    res.json({ message: 'Valor atualizado' });
  } catch (err) { erro(res, err); }
});

router.post('/despesas/gerar-fixas', autenticado, async (req, res) => {
  const mes = parseInt(req.body.month);
  const ano = parseInt(req.body.year);
  const replace = !!req.body.replace;
  try {
    // Sem replace, só cria o que falta (não apaga nada)
    const r = await gerarMes(req.ownerId, ano, mes, { replace });
    let jaGeradas = false;
    if (!replace && r.despesas === 0) {
      const ja = await pool.query(
        `SELECT 1 FROM public.despesas WHERE user_id = $1 AND is_modelo = false AND tipo = 'fixa' AND pago = false
           AND EXTRACT(MONTH FROM COALESCE(data_compra, data_vencimento)) = $2 AND EXTRACT(YEAR FROM COALESCE(data_compra, data_vencimento)) = $3 LIMIT 1`,
        [req.ownerId, mes, ano],
      );
      jaGeradas = ja.rows.length > 0;
    }
    res.json({ message: `${r.despesas} despesas e ${r.receitas} receitas geradas.`, createdCount: r.despesas, receitasCount: r.receitas, jaGeradas });
  } catch (err) { erro(res, err); }
});

/** Lança um modelo fixo recém-criado no mês informado (sem mexer nos demais). */
router.post('/despesas/:id/lancar-mes', autenticado, async (req, res) => {
  try {
    const criado = await lancarModeloNoMes(req.ownerId, req.params.id, parseInt(req.body.year), parseInt(req.body.month));
    res.json({ criado });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Lembretes
router.get('/lembretes', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.lembretes WHERE user_id = $1 ORDER BY data_lembrete ASC', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/lembretes', autenticado, async (req, res) => {
  const { titulo, descricao, data_lembrete } = req.body;
  if (!titulo || !data_lembrete) return res.status(400).json({ error: 'Informe título e data.' });
  try {
    const r = await pool.query('INSERT INTO public.lembretes (user_id, titulo, descricao, data_lembrete) VALUES ($1, $2, $3, $4) RETURNING *', [req.ownerId, titulo, descricao, data_lembrete]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.patch('/lembretes/:id/concluir', autenticado, async (req, res) => {
  try {
    const r = await pool.query('UPDATE public.lembretes SET concluido = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [!!req.body.concluido, req.params.id, req.ownerId]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/lembretes/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.lembretes WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ message: 'Lembrete removido' });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Painel
router.get('/dashboard/evolucao', autenticado, async (req, res) => {
  try {
    const ano = req.query.year ? parseInt(req.query.year) : null;
    const filtroR = ano ? 'AND EXTRACT(YEAR FROM data_recebimento) = $2' : `AND data_recebimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')`;
    const filtroD = ano ? 'AND EXTRACT(YEAR FROM data_vencimento) = $2' : `AND data_vencimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')`;
    const params = ano ? [req.ownerId, ano] : [req.ownerId];
    const receitas = await pool.query(
      `SELECT EXTRACT(MONTH FROM data_recebimento) AS mes, EXTRACT(YEAR FROM data_recebimento) AS ano, SUM(valor) AS total
       FROM public.receitas WHERE user_id = $1 ${filtroR} GROUP BY ano, mes ORDER BY ano, mes`, params);
    const despesas = await pool.query(
      `SELECT EXTRACT(MONTH FROM data_vencimento) AS mes, EXTRACT(YEAR FROM data_vencimento) AS ano,
         SUM(CASE WHEN pago THEN COALESCE(valor_pago, valor) ELSE valor END) AS total
       FROM public.despesas WHERE user_id = $1 AND is_modelo = false ${filtroD} GROUP BY ano, mes ORDER BY ano, mes`, params);
    res.json({ receitas: receitas.rows, despesas: despesas.rows });
  } catch (err) { erro(res, err); }
});

/**
 * Saldo real: saldos iniciais das contas + receitas recebidas − despesas pagas (pelo valor efetivamente pago),
 * com o detalhe por conta e por escopo (pessoal/empresa).
 */
router.get('/dashboard/saldo', autenticado, async (req, res) => {
  try {
    const contas = (await pool.query('SELECT * FROM public.contas WHERE user_id = $1 ORDER BY ordem, created_at', [req.ownerId])).rows;
    const rec = (await pool.query(
      `SELECT conta_id, escopo, SUM(valor) AS total FROM public.receitas WHERE user_id = $1 AND pendente = false GROUP BY conta_id, escopo`, [req.ownerId])).rows;
    const des = (await pool.query(
      `SELECT conta_id, escopo, SUM(COALESCE(valor_pago, valor)) AS total FROM public.despesas
       WHERE user_id = $1 AND pago = true AND is_modelo = false GROUP BY conta_id, escopo`, [req.ownerId])).rows;
    const tr = (await pool.query('SELECT origem_id, destino_id, SUM(valor) AS total FROM public.transferencias WHERE user_id = $1 GROUP BY origem_id, destino_id', [req.ownerId])).rows;

    const porConta = new Map(contas.map((c) => [c.id, Number(c.saldo_inicial) || 0]));
    const porEscopo = { pessoal: 0, empresa: 0 };
    let semConta = 0;
    const somar = (contaId, escopo, v) => {
      if (contaId && porConta.has(contaId)) porConta.set(contaId, porConta.get(contaId) + v);
      else {
        semConta += v;
        porEscopo[escopo === 'empresa' ? 'empresa' : 'pessoal'] += v;
      }
    };
    for (const r of rec) somar(r.conta_id, r.escopo, Number(r.total));
    for (const d of des) somar(d.conta_id, d.escopo, -Number(d.total));
    for (const t of tr) {
      if (porConta.has(t.origem_id)) porConta.set(t.origem_id, porConta.get(t.origem_id) - Number(t.total));
      if (porConta.has(t.destino_id)) porConta.set(t.destino_id, porConta.get(t.destino_id) + Number(t.total));
    }
    const listaContas = contas.map((c) => ({ ...c, saldo: Math.round(porConta.get(c.id) * 100) / 100 }));
    for (const c of listaContas) if (c.ativo) porEscopo[c.escopo === 'empresa' ? 'empresa' : 'pessoal'] += c.saldo;
    const saldoGlobal = listaContas.filter((c) => c.ativo).reduce((a, c) => a + c.saldo, 0) + semConta;
    res.json({
      saldoGlobal: Math.round(saldoGlobal * 100) / 100,
      porEscopo: { pessoal: Math.round(porEscopo.pessoal * 100) / 100, empresa: Math.round(porEscopo.empresa * 100) / 100 },
      semConta: Math.round(semConta * 100) / 100,
      contas: listaContas,
    });
  } catch (err) { erro(res, err); }
});

export default router;
