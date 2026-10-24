import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken, isAdmin } from '../lib/sessao.js';

const router = Router();
const adm = [authenticateToken, isAdmin];

const erro = (res, err) => {
  console.error('ERRO (admin):', err);
  res.status(500).json({ error: 'Não foi possível concluir a operação.' });
};

router.get('/admin/stats', adm, async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM auth.users');
    const pro = await pool.query('SELECT COUNT(*) FROM public.subscribers WHERE subscribed = true');
    const rec = await pool.query('SELECT SUM(valor) AS total FROM public.receitas');
    const des = await pool.query('SELECT SUM(valor) AS total FROM public.despesas WHERE is_modelo = false');
    const fee = await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'");
    res.json({
      totalUsers: parseInt(total.rows[0].count),
      proUsers: parseInt(pro.rows[0].count),
      globalVolume: parseFloat(rec.rows[0].total || 0) + parseFloat(des.rows[0].total || 0),
      monthlyFee: fee.rows[0]?.value || '17.90',
    });
  } catch (err) { erro(res, err); }
});

router.post('/admin/config', adm, async (req, res) => {
  const { key, value } = req.body;
  if (key !== 'monthly_fee') return res.status(400).json({ error: 'Configuração desconhecida.' });
  try {
    await pool.query('INSERT INTO public.config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()', [key, value]);
    res.json({ message: 'Configuração atualizada' });
  } catch (err) { erro(res, err); }
});

router.get('/admin/users', adm, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at, p.display_name, COALESCE(s.subscribed, false) AS is_pro
      FROM auth.users u
      LEFT JOIN public.profiles p ON u.id = p.user_id
      LEFT JOIN public.subscribers s ON u.id = s.user_id
      ORDER BY u.created_at DESC`);
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

router.get('/admin/cupons', adm, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.cupons ORDER BY created_at DESC')).rows);
  } catch (err) { erro(res, err); }
});

router.post('/admin/cupons', adm, async (req, res) => {
  const { codigo, desconto_percentual, max_usos } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO public.cupons (codigo, desconto_percentual, max_usos) VALUES ($1, $2, $3) RETURNING *',
      [String(codigo).toUpperCase(), desconto_percentual, max_usos ? parseInt(max_usos) : null],
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Código de cupom já existe' });
    erro(res, err);
  }
});

router.delete('/admin/cupons/:id', adm, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.cupons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Cupom removido' });
  } catch (err) { erro(res, err); }
});

// Lista de compras do administrador
router.get('/admin/compras', adm, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM public.compras ORDER BY created_at DESC')).rows);
  } catch (err) { erro(res, err); }
});

router.post('/admin/compras', adm, async (req, res) => {
  const { item, grupo, prioridade, valor } = req.body;
  try {
    const r = await pool.query('INSERT INTO public.compras (item, grupo, prioridade, valor) VALUES ($1, $2, $3, $4) RETURNING *', [item, grupo || null, prioridade, valor]);
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.put('/admin/compras/:id', adm, async (req, res) => {
  const { comprado, item, grupo, prioridade, valor } = req.body;
  try {
    const r = item === undefined
      ? await pool.query('UPDATE public.compras SET comprado = $1 WHERE id = $2 RETURNING *', [comprado, req.params.id])
      : await pool.query('UPDATE public.compras SET item = $1, grupo = $2, prioridade = $3, valor = $4 WHERE id = $5 RETURNING *', [item, grupo || null, prioridade, valor, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Compra não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.delete('/admin/compras/:id', adm, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.compras WHERE id = $1', [req.params.id]);
    res.json({ message: 'Compra removida' });
  } catch (err) { erro(res, err); }
});

// Cupom aplicado pelo próprio usuário (fica aqui por usar a mesma tabela)
router.post('/config/aplicar-cupom', authenticateToken, async (req, res) => {
  const codigo = String(req.body.codigo || '').toUpperCase();
  try {
    const c = (await pool.query('SELECT * FROM public.cupons WHERE codigo = $1', [codigo])).rows[0];
    if (!c) return res.status(404).json({ error: 'Cupom inválido ou não encontrado' });
    if (c.max_usos !== null && c.usos_atuais >= c.max_usos) return res.status(400).json({ error: 'Cupom esgotado' });
    const usado = await pool.query('SELECT 1 FROM public.cupons_usados WHERE user_id = $1 AND cupom_id = $2', [req.user.id, c.id]);
    if (usado.rows.length) return res.status(400).json({ error: 'Você já utilizou este cupom' });
    if (parseFloat(c.desconto_percentual) === 100) {
      await pool.query('UPDATE public.cupons SET usos_atuais = usos_atuais + 1 WHERE id = $1', [c.id]);
      await pool.query('INSERT INTO public.cupons_usados (user_id, cupom_id) VALUES ($1, $2)', [req.user.id, c.id]);
      await pool.query(
        `INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) VALUES ($1, $2, true, 'cupom_100', now() + interval '100 years')
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'cupom_100', expires_at = now() + interval '100 years'`,
        [req.user.id, req.user.email],
      );
      return res.json({ message: 'Acesso liberado! Cupom aplicado com sucesso.', tipo: '100' });
    }
    res.json({ message: 'Cupom validado! O desconto será aplicado no checkout.', tipo: 'parcial', desconto: c.desconto_percentual, codigo: c.codigo });
  } catch (err) { erro(res, err); }
});

export default router;
