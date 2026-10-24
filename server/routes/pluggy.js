import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../lib/sessao.js';
import { atualizarConexoes, ehDonoPluggy, listarContasPluggy, sincronizarPluggy } from '../lib/pluggy.js';

const router = Router();

/** Só o dono configurado no servidor enxerga a integração. */
function somenteDono(req, res, next) {
  if (!ehDonoPluggy(req.user.email)) return res.status(404).json({ error: 'Integração indisponível para esta conta.' });
  next();
}

const erro = (res, err) => {
  console.error('ERRO (Pluggy):', err.message);
  res.status(502).json({ error: `Pluggy: ${err.message}` });
};

router.get('/pluggy/status', authenticateToken, async (req, res) => {
  if (!ehDonoPluggy(req.user.email)) return res.json({ disponivel: false });
  try {
    const vinculos = (await pool.query('SELECT * FROM public.pluggy_vinculos WHERE user_id = $1 ORDER BY tipo, nome', [req.user.id])).rows;
    const estado = (await pool.query('SELECT * FROM public.pluggy_estado WHERE user_id = $1', [req.user.id])).rows[0] || null;
    res.json({ disponivel: true, vinculos, estado });
  } catch (err) { erro(res, err); }
});

/** Busca as contas no Meu Pluggy e atualiza a lista (preserva os vínculos já feitos). */
router.post('/pluggy/contas', authenticateToken, somenteDono, async (req, res) => {
  try {
    const contas = await listarContasPluggy();
    for (const c of contas) {
      await pool.query(
        `INSERT INTO public.pluggy_vinculos (user_id, pluggy_account_id, item_id, nome, tipo, saldo, atualizado_em)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id, pluggy_account_id) DO UPDATE SET item_id = EXCLUDED.item_id, nome = EXCLUDED.nome, tipo = EXCLUDED.tipo,
           saldo = EXCLUDED.saldo, atualizado_em = now()`,
        [req.user.id, c.id, c.itemId, c.nome, c.tipo, c.saldo],
      );
    }
    res.json((await pool.query('SELECT * FROM public.pluggy_vinculos WHERE user_id = $1 ORDER BY tipo, nome', [req.user.id])).rows);
  } catch (err) { erro(res, err); }
});

router.put('/pluggy/vinculos/:accountId', authenticateToken, somenteDono, async (req, res) => {
  const { conta_id, cartao_id } = req.body || {};
  try {
    if (conta_id && !(await pool.query('SELECT 1 FROM public.contas WHERE id = $1 AND user_id = $2', [conta_id, req.user.id])).rows.length) {
      return res.status(400).json({ error: 'Conta inválida.' });
    }
    if (cartao_id && !(await pool.query('SELECT 1 FROM public.cartoes WHERE id = $1 AND user_id = $2', [cartao_id, req.user.id])).rows.length) {
      return res.status(400).json({ error: 'Cartão inválido.' });
    }
    await pool.query(
      'UPDATE public.pluggy_vinculos SET conta_id = $1, cartao_id = $2 WHERE user_id = $3 AND pluggy_account_id = $4',
      [conta_id || null, cartao_id || null, req.user.id, req.params.accountId],
    );
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

router.post('/pluggy/sincronizar', authenticateToken, somenteDono, async (req, res) => {
  try {
    if (req.body?.atualizar) await atualizarConexoes();
    res.json(await sincronizarPluggy(req.user.id));
  } catch (err) { erro(res, err); }
});

export default router;
