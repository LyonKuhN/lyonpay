import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../lib/sessao.js';
import { chavePublica, enviarPush, pushDisponivel } from '../lib/push.js';

const router = Router();

router.get('/push/chave', authenticateToken, (req, res) => {
  res.json({ disponivel: pushDisponivel, chave: chavePublica() });
});

router.post('/push/inscrever', authenticateToken, async (req, res) => {
  const { endpoint, keys, aparelho } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Inscrição inválida.' });
  try {
    await pool.query(
      `INSERT INTO public.push_inscricoes (user_id, endpoint, p256dh, auth, aparelho) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, aparelho = EXCLUDED.aparelho`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, String(aparelho || '').slice(0, 120)],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO (push):', err);
    res.status(500).json({ error: 'Não foi possível ativar as notificações.' });
  }
});

router.post('/push/cancelar', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.push_inscricoes WHERE user_id = $1 AND endpoint = $2', [req.user.id, req.body?.endpoint || '']);
    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO (push):', err);
    res.status(500).json({ error: 'Não foi possível desativar.' });
  }
});

router.post('/push/teste', authenticateToken, async (req, res) => {
  try {
    const n = await enviarPush(req.user.id, { titulo: 'Notificações ativas', corpo: 'Você vai receber aqui os avisos de vencimento do Lyonk.', url: '/pagamentos', tag: 'teste' });
    res.json({ enviados: n });
  } catch (err) {
    console.error('ERRO (push):', err);
    res.status(500).json({ error: 'Não foi possível enviar o teste.' });
  }
});

export default router;
