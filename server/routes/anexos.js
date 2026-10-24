import { Router } from 'express';
import express from 'express';
import pool from '../db.js';
import { autenticado } from '../lib/sessao.js';

const router = Router();

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const LIMITE_BYTES = 5 * 1024 * 1024;

const erro = (res, err) => {
  console.error('ERRO (anexos):', err);
  res.status(500).json({ error: 'Não foi possível concluir a operação com o anexo.' });
};

router.get('/anexos', autenticado, async (req, res) => {
  const { despesa_id, receita_id } = req.query;
  try {
    const r = await pool.query(
      `SELECT id, despesa_id, receita_id, nome, mime, tamanho, created_at FROM public.anexos
       WHERE user_id = $1 AND (($2::uuid IS NOT NULL AND despesa_id = $2) OR ($3::uuid IS NOT NULL AND receita_id = $3))
       ORDER BY created_at DESC`,
      [req.ownerId, despesa_id || null, receita_id || null],
    );
    res.json(r.rows);
  } catch (err) { erro(res, err); }
});

/** Upload em JSON (base64). Imagens chegam já reduzidas pelo app. */
router.post('/anexos', express.json({ limit: '8mb' }), autenticado, async (req, res) => {
  const { despesa_id, receita_id, nome, mime, base64 } = req.body || {};
  if (!TIPOS.includes(mime)) return res.status(400).json({ error: 'Envie foto (JPG, PNG, WebP) ou PDF.' });
  if (!despesa_id && !receita_id) return res.status(400).json({ error: 'Informe o lançamento.' });
  try {
    const conteudo = Buffer.from(String(base64 || ''), 'base64');
    if (!conteudo.length) return res.status(400).json({ error: 'Arquivo vazio.' });
    if (conteudo.length > LIMITE_BYTES) return res.status(413).json({ error: 'Arquivo acima de 5 MB.' });
    const tabela = despesa_id ? 'despesas' : 'receitas';
    const dono = await pool.query(`SELECT 1 FROM public.${tabela} WHERE id = $1 AND user_id = $2`, [despesa_id || receita_id, req.ownerId]);
    if (!dono.rows.length) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    const r = await pool.query(
      `INSERT INTO public.anexos (user_id, despesa_id, receita_id, nome, mime, tamanho, conteudo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, despesa_id, receita_id, nome, mime, tamanho, created_at`,
      [req.ownerId, despesa_id || null, receita_id || null, String(nome || 'comprovante').slice(0, 120), mime, conteudo.length, conteudo],
    );
    res.json(r.rows[0]);
  } catch (err) { erro(res, err); }
});

router.get('/anexos/:id/arquivo', autenticado, async (req, res) => {
  try {
    const r = await pool.query('SELECT nome, mime, conteudo FROM public.anexos WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    const a = r.rows[0];
    if (!a) return res.status(404).json({ error: 'Anexo não encontrado.' });
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.nome)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(a.conteudo);
  } catch (err) { erro(res, err); }
});

router.delete('/anexos/:id', autenticado, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.anexos WHERE id = $1 AND user_id = $2', [req.params.id, req.ownerId]);
    res.json({ ok: true });
  } catch (err) { erro(res, err); }
});

export default router;
