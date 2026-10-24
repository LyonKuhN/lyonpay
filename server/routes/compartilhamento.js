import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { authenticateToken, frontendUrl } from '../lib/sessao.js';
import { emailConvite, enviarEmail } from '../lib/email.js';

const router = Router();

const erro = (res, err) => {
  console.error('ERRO (compartilhamento):', err);
  res.status(500).json({ error: 'Não foi possível concluir a operação.' });
};

const planoAtivo = (role, subscribed, expiresAt) => role === 'admin' || (expiresAt && new Date(expiresAt) > new Date()) || false;

/** Espaços que a pessoa pode abrir: o próprio e os compartilhados com ela (aceitos). */
router.get('/espacos', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.dono_id, c.permissao, COALESCE(p.display_name, u.email) AS nome, u.role, s.subscribed, s.expires_at
       FROM public.compartilhamentos c
       JOIN auth.users u ON u.id = c.dono_id
       LEFT JOIN public.profiles p ON p.user_id = c.dono_id
       LEFT JOIN public.subscribers s ON s.user_id = c.dono_id
       WHERE c.membro_id = $1 AND c.status = 'aceito'
       ORDER BY nome`,
      [req.user.id],
    );
    res.json([
      { dono_id: req.user.id, nome: 'Minhas finanças', permissao: 'editar', proprio: true },
      ...r.rows.map((x) => ({ dono_id: x.dono_id, nome: x.nome, permissao: x.permissao, proprio: false, plano_ativo: planoAtivo(x.role, x.subscribed, x.expires_at) })),
    ]);
  } catch (err) { erro(res, err); }
});

/** Pessoas com acesso às minhas finanças (convites pendentes e aceitos). */
router.get('/compartilhamentos', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.email, c.permissao, c.status, c.created_at, p.display_name AS nome
       FROM public.compartilhamentos c LEFT JOIN public.profiles p ON p.user_id = c.membro_id
       WHERE c.dono_id = $1 ORDER BY c.created_at`,
      [req.user.id],
    );
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.post('/compartilhamentos', authenticateToken, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const permissao = req.body.permissao === 'ver' ? 'ver' : 'editar';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (email === req.user.email.toLowerCase()) return res.status(400).json({ error: 'Esse é o seu próprio e-mail.' });
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const r = await pool.query(
      `INSERT INTO public.compartilhamentos (dono_id, email, permissao, status, token) VALUES ($1, $2, $3, 'pendente', $4)
       ON CONFLICT (dono_id, email) DO UPDATE SET permissao = EXCLUDED.permissao,
         token = CASE WHEN public.compartilhamentos.status = 'aceito' THEN public.compartilhamentos.token ELSE EXCLUDED.token END
       RETURNING id, email, permissao, status, token`,
      [req.user.id, email, permissao, token],
    );
    const convite = r.rows[0];
    if (convite.status === 'pendente') {
      const dono = (await pool.query('SELECT display_name FROM public.profiles WHERE user_id = $1', [req.user.id])).rows[0]?.display_name || req.user.email;
      await enviarEmail(email, `${dono} convidou você para o Lyonk`, emailConvite(dono, `${frontendUrl()}/convite?token=${convite.token}`));
    }
    delete convite.token;
    res.json(convite);
  } catch (err) { erro(res, err); }
});

router.patch('/compartilhamentos/:id', authenticateToken, async (req, res) => {
  const permissao = req.body.permissao === 'ver' ? 'ver' : 'editar';
  try {
    await pool.query('UPDATE public.compartilhamentos SET permissao = $1 WHERE id = $2 AND dono_id = $3', [permissao, req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

/** O dono remove alguém, ou o próprio membro sai do espaço. */
router.delete('/compartilhamentos/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.compartilhamentos WHERE id = $1 AND (dono_id = $2 OR membro_id = $2)', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

router.delete('/espacos/:donoId', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.compartilhamentos WHERE dono_id = $1 AND membro_id = $2', [req.params.donoId, req.user.id]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

/** Detalhes do convite (para a tela de aceite). */
router.get('/convites/:token', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.email, c.permissao, c.status, COALESCE(p.display_name, u.email) AS dono
       FROM public.compartilhamentos c JOIN auth.users u ON u.id = c.dono_id LEFT JOIN public.profiles p ON p.user_id = c.dono_id
       WHERE c.token = $1`,
      [req.params.token],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Convite não encontrado ou cancelado.' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.post('/convites/:token/aceitar', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(`SELECT id, dono_id, email, status FROM public.compartilhamentos WHERE token = $1`, [req.params.token]);
    const c = r.rows[0];
    if (!c) return res.status(404).json({ error: 'Convite não encontrado ou cancelado.' });
    if (c.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: `Este convite foi enviado para ${c.email}. Entre com esse e-mail para aceitar.` });
    }
    if (c.dono_id === req.user.id) return res.status(400).json({ error: 'Você não pode aceitar o próprio convite.' });
    await pool.query(`UPDATE public.compartilhamentos SET membro_id = $1, status = 'aceito' WHERE id = $2`, [req.user.id, c.id]);
    res.json({ dono_id: c.dono_id });
  } catch (err) { erro(res, err); }
});

export default router;
