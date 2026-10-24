import { Router } from 'express';
import pool from '../db.js';
import { autenticado } from '../lib/sessao.js';
import { hojeSP } from '../lib/datas.js';
import { lancarRecorrenteNoMes } from '../geracao.js';
import { gravarImportacao } from '../lib/importacao.js';

const router = Router();

const erro = (res, err, msg = 'Não foi possível concluir a operação.') => {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error('ERRO:', err);
  res.status(500).json({ error: msg });
};
const escopoValido = (e) => (e === 'empresa' ? 'empresa' : 'pessoal');

// ---------------------------------------------------------------- Receitas recorrentes
router.get('/recorrentes', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.receitas_recorrentes WHERE user_id = $1 ORDER BY dia, descricao', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/recorrentes', autenticado, async (req, res) => {
  const { descricao, valor, dia, categoria, conta_id, escopo, lancar_mes } = req.body;
  if (!descricao || !(Number(valor) > 0)) return res.status(400).json({ error: 'Informe descrição e valor.' });
  try {
    const r = await pool.query(
      `INSERT INTO public.receitas_recorrentes (user_id, descricao, valor, dia, categoria, conta_id, escopo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.ownerId, descricao, Number(valor), Math.max(1, Math.min(31, parseInt(dia) || 1)), categoria || 'Outros', conta_id || null, escopoValido(escopo)],
    );
    if (lancar_mes?.year && lancar_mes?.month) await lancarRecorrenteNoMes(req.ownerId, r.rows[0].id, parseInt(lancar_mes.year), parseInt(lancar_mes.month));
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/recorrentes/:id', autenticado, async (req, res) => {
  const { descricao, valor, dia, categoria, conta_id, escopo, ativo } = req.body;
  try {
    const r = await pool.query(
      `UPDATE public.receitas_recorrentes SET descricao = $1, valor = $2, dia = $3, categoria = $4, conta_id = $5, escopo = $6, ativo = COALESCE($7, ativo)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [descricao, Number(valor), Math.max(1, Math.min(31, parseInt(dia) || 1)), categoria || 'Outros', conta_id || null, escopoValido(escopo), ativo === undefined ? null : !!ativo, req.params.id, req.ownerId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Receita recorrente não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/recorrentes/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.receitas_recorrentes WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Orçamentos
router.get('/orcamentos', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.orcamentos WHERE user_id = $1 ORDER BY categoria', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.put('/orcamentos', autenticado, async (req, res) => {
  const { categoria, valor } = req.body;
  if (!categoria || !(Number(valor) > 0)) return res.status(400).json({ error: 'Informe categoria e valor.' });
  try {
    const r = await pool.query(
      `INSERT INTO public.orcamentos (user_id, categoria, valor) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, categoria) DO UPDATE SET valor = EXCLUDED.valor RETURNING *`,
      [req.ownerId, categoria, Number(valor)],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/orcamentos/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.orcamentos WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Metas
router.get('/metas', autenticado, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.*, COALESCE(SUM(a.valor), 0) AS guardado, COUNT(a.id)::int AS aportes
       FROM public.metas m LEFT JOIN public.metas_aportes a ON a.meta_id = m.id
       WHERE m.user_id = $1 GROUP BY m.id ORDER BY m.concluida, m.prazo NULLS LAST, m.created_at`,
      [req.ownerId],
    );
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.post('/metas', autenticado, async (req, res) => {
  const { nome, valor_alvo, prazo, cor } = req.body;
  if (!nome || !(Number(valor_alvo) > 0)) return res.status(400).json({ error: 'Informe nome e valor da meta.' });
  try {
    const r = await pool.query('INSERT INTO public.metas (user_id, nome, valor_alvo, prazo, cor) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.ownerId, nome, Number(valor_alvo), prazo || null, cor || null]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/metas/:id', autenticado, async (req, res) => {
  const { nome, valor_alvo, prazo, cor, concluida } = req.body;
  try {
    const r = await pool.query(
      'UPDATE public.metas SET nome = $1, valor_alvo = $2, prazo = $3, cor = $4, concluida = COALESCE($5, concluida) WHERE id = $6 AND user_id = $7 RETURNING *',
      [nome, Number(valor_alvo), prazo || null, cor || null, concluida === undefined ? null : !!concluida, req.params.id, req.ownerId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Meta não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/metas/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.metas WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

router.get('/metas/:id/aportes', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.metas_aportes WHERE meta_id = $1 AND user_id = $2 ORDER BY data DESC, created_at DESC', [req.params.id, req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

/** Aporte (valor positivo) ou retirada (valor negativo). */
router.post('/metas/:id/aportes', autenticado, async (req, res) => {
  const valor = Number(req.body.valor);
  if (!valor) return res.status(400).json({ error: 'Informe o valor.' });
  try {
    const meta = await pool.query('SELECT id FROM public.metas WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    if (!meta.rows.length) return res.status(404).json({ error: 'Meta não encontrada' });
    const r = await pool.query('INSERT INTO public.metas_aportes (meta_id, user_id, valor, data) VALUES ($1, $2, $3, $4) RETURNING *', [req.params.id, req.ownerId, valor, req.body.data || hojeSP()]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/metas/:id/aportes/:aporteId', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.metas_aportes WHERE id = $1 AND meta_id = $2 AND user_id = $3', [req.params.aporteId, req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Regras de categoria
router.get('/regras', autenticado, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.regras_categoria WHERE user_id = $1 ORDER BY termo', [req.ownerId])).rows);
  } catch (err) { erro(res, err); }
});

router.post('/regras', autenticado, async (req, res) => {
  const { termo, categoria, tipo } = req.body;
  if (!termo?.trim() || !categoria) return res.status(400).json({ error: 'Informe o termo e a categoria.' });
  try {
    await pool.query('DELETE FROM public.regras_categoria WHERE user_id = $1 AND lower(termo) = lower($2) AND COALESCE(tipo, \'\') = COALESCE($3, \'\')', [req.ownerId, termo.trim(), tipo || null]);
    const r = await pool.query('INSERT INTO public.regras_categoria (user_id, termo, categoria, tipo) VALUES ($1, $2, $3, $4) RETURNING *', [req.ownerId, termo.trim(), categoria, tipo || null]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/regras/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.regras_categoria WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

// ---------------------------------------------------------------- Importação de extrato
/** Quais desses identificadores já foram importados (para marcar duplicados na prévia). */
router.post('/importar/existentes', autenticado, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 5000).map(String) : [];
  if (!ids.length) return res.json([]);
  try {
    const r = await pool.query(
      `SELECT import_id FROM public.despesas WHERE user_id = $1 AND import_id = ANY($2::text[])
       UNION SELECT import_id FROM public.receitas WHERE user_id = $1 AND import_id = ANY($2::text[])`,
      [req.ownerId, ids],
    );
    res.json(r.rows.map((x) => x.import_id));
  } catch (err) { erro(res, err); }
});

router.post('/importar', autenticado, async (req, res) => {
  const itens = Array.isArray(req.body.itens) ? req.body.itens.slice(0, 5000) : [];
  if (!itens.length) return res.status(400).json({ error: 'Nada para importar.' });
  try {
    res.json(await gravarImportacao(req.ownerId, req.body.destino, itens));
  } catch (err) { erro(res, err, 'Não foi possível importar.'); }
});

export default router;
