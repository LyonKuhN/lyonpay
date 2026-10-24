import { Router } from 'express';
import pool from '../db.js';
import { autenticado } from '../lib/sessao.js';
import { hojeSP } from '../lib/datas.js';

const router = Router();

const erro = (res, err, msg = 'Não foi possível concluir a operação.') => {
  console.error('ERRO:', err);
  res.status(500).json({ error: msg });
};
const TIPOS_CONTA = ['corrente', 'poupanca', 'carteira', 'investimento'];
const escopoValido = (e) => (e === 'empresa' ? 'empresa' : 'pessoal');
const dia = (v) => Math.max(1, Math.min(31, parseInt(v) || 1));

// ---------------------------------------------------------------- Contas
router.get('/contas', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.contas WHERE user_id = $1 ORDER BY ativo DESC, ordem, created_at', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/contas', autenticado, async (req, res) => {
  const { nome, tipo, escopo, saldo_inicial, cor } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Informe o nome da conta.' });
  try {
    const r = await pool.query(
      `INSERT INTO public.contas (user_id, nome, tipo, escopo, saldo_inicial, cor) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.ownerId, nome.trim(), TIPOS_CONTA.includes(tipo) ? tipo : 'corrente', escopoValido(escopo), Number(saldo_inicial) || 0, cor || null],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/contas/:id', autenticado, async (req, res) => {
  const { nome, tipo, escopo, saldo_inicial, cor, ativo } = req.body;
  try {
    const r = await pool.query(
      `UPDATE public.contas SET nome = $1, tipo = $2, escopo = $3, saldo_inicial = $4, cor = $5, ativo = COALESCE($6, ativo)
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [nome, TIPOS_CONTA.includes(tipo) ? tipo : 'corrente', escopoValido(escopo), Number(saldo_inicial) || 0, cor || null, ativo === undefined ? null : !!ativo, req.params.id, req.ownerId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/contas/:id', autenticado, async (req, res) => {
  try {
    // Lançamentos ficam (sem conta); transferências da conta são removidas
    await pool.query('DELETE FROM public.contas WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

/** Calcula o saldo atual de uma conta pelo que está lançado. */
async function saldoCalculado(contaId, ownerId) {
  const r = await pool.query(
    `SELECT c.saldo_inicial
       + COALESCE((SELECT SUM(valor) FROM public.receitas WHERE conta_id = c.id AND pendente = false), 0)
       - COALESCE((SELECT SUM(COALESCE(valor_pago, valor)) FROM public.despesas WHERE conta_id = c.id AND pago = true AND is_modelo = false), 0)
       + COALESCE((SELECT SUM(valor) FROM public.transferencias WHERE destino_id = c.id), 0)
       - COALESCE((SELECT SUM(valor) FROM public.transferencias WHERE origem_id = c.id), 0) AS saldo
     FROM public.contas c WHERE c.id = $1 AND c.user_id = $2`,
    [contaId, ownerId],
  );
  return r.rows[0] ? Number(r.rows[0].saldo) : null;
}

/** Conferência com o extrato: informa o saldo real e o Lyonk ajusta o saldo inicial pela diferença. */
router.post('/contas/:id/ajustar', autenticado, async (req, res) => {
  const real = Number(req.body.saldo_real);
  if (!Number.isFinite(real)) return res.status(400).json({ error: 'Informe o saldo do extrato.' });
  try {
    const atual = await saldoCalculado(req.params.id, req.ownerId);
    if (atual === null) return res.status(404).json({ error: 'Conta não encontrada' });
    const diferenca = Math.round((real - atual) * 100) / 100;
    await pool.query('UPDATE public.contas SET saldo_inicial = saldo_inicial + $1 WHERE id = $2 AND user_id = $3', [diferenca, req.params.id, req.ownerId]);
    res.json({ diferenca, saldo: real });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Cartões
router.get('/cartoes', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.cartoes WHERE user_id = $1 ORDER BY ativo DESC, created_at', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

async function contaValida(id, ownerId) {
  if (!id) return true;
  return (await pool.query('SELECT 1 FROM public.contas WHERE id = $1 AND user_id = $2', [id, ownerId])).rows.length > 0;
}

router.post('/cartoes', autenticado, async (req, res) => {
  const { nome, bandeira, limite, dia_fechamento, dia_vencimento, conta_pagamento_id, escopo, cor } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Informe o nome do cartão.' });
  try {
    if (!(await contaValida(conta_pagamento_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `INSERT INTO public.cartoes (user_id, nome, bandeira, limite, dia_fechamento, dia_vencimento, conta_pagamento_id, escopo, cor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.ownerId, nome.trim(), bandeira || null, limite ? Number(limite) : null, dia(dia_fechamento), dia(dia_vencimento), conta_pagamento_id || null, escopoValido(escopo), cor || null],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/cartoes/:id', autenticado, async (req, res) => {
  const { nome, bandeira, limite, dia_fechamento, dia_vencimento, conta_pagamento_id, escopo, cor, ativo } = req.body;
  try {
    if (!(await contaValida(conta_pagamento_id, req.ownerId))) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      `UPDATE public.cartoes SET nome = $1, bandeira = $2, limite = $3, dia_fechamento = $4, dia_vencimento = $5, conta_pagamento_id = $6,
         escopo = $7, cor = $8, ativo = COALESCE($9, ativo)
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [nome, bandeira || null, limite ? Number(limite) : null, dia(dia_fechamento), dia(dia_vencimento), conta_pagamento_id || null, escopoValido(escopo), cor || null,
        ativo === undefined ? null : !!ativo, req.params.id, req.ownerId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/cartoes/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.cartoes WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Transferências
router.get('/transferencias', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.transferencias WHERE user_id = $1 ORDER BY data DESC, created_at DESC', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/transferencias', autenticado, async (req, res) => {
  const { origem_id, destino_id, valor, data, descricao } = req.body;
  if (!origem_id || !destino_id || origem_id === destino_id) return res.status(400).json({ error: 'Escolha contas de origem e destino diferentes.' });
  if (!(Number(valor) > 0)) return res.status(400).json({ error: 'Informe um valor maior que zero.' });
  try {
    const ok = await pool.query('SELECT COUNT(*)::int AS n FROM public.contas WHERE user_id = $1 AND id = ANY($2::uuid[])', [req.ownerId, [origem_id, destino_id]]);
    if (ok.rows[0].n !== 2) return res.status(400).json({ error: 'Conta inválida.' });
    const r = await pool.query(
      'INSERT INTO public.transferencias (user_id, origem_id, destino_id, valor, data, descricao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.ownerId, origem_id, destino_id, Number(valor), data || hojeSP(), descricao || null],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/transferencias/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.transferencias WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

export default router;
