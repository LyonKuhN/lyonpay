import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { authenticateToken, criarSessao, encerrarSessao } from '../lib/sessao.js';
import { emailCodigo2FA, emailConfirmacao, emailRecuperacao, enviarEmail } from '../lib/email.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Bloqueio de segurança ativado por 15 minutos.' },
});

const CATEGORIAS_PADRAO = [
  { nome: 'Moradia', tipo: 'despesa' },
  { nome: 'Transporte', tipo: 'despesa' },
  { nome: 'Alimentação', tipo: 'despesa' },
  { nome: 'Saúde', tipo: 'despesa' },
  { nome: 'Educação', tipo: 'despesa' },
  { nome: 'Lazer', tipo: 'despesa' },
  { nome: 'Salário', tipo: 'receita' },
];

const novoCodigo = () => String(crypto.randomInt(100000, 1000000));

/** Dados do usuário que o app usa (sem nada sensível). */
export async function dadosUsuario(userId) {
  const u = await pool.query('SELECT id, email, role, two_factor_enabled FROM auth.users WHERE id = $1', [userId]);
  const user = u.rows[0];
  if (!user) return null;
  const p = await pool.query(
    `SELECT display_name, notificacoes_diarias, gerar_fixas_auto, onboarding_concluido, modo_empresa FROM public.profiles WHERE user_id = $1`,
    [userId],
  );
  const s = await pool.query('SELECT subscribed, expires_at, cancela_no_fim FROM public.subscribers WHERE user_id = $1', [userId]);
  const perfil = p.rows[0] || {};
  return {
    id: user.id,
    email: user.email,
    name: perfil.display_name || 'Usuário',
    role: user.role,
    subscribed: s.rows[0]?.subscribed || false,
    expires_at: s.rows[0]?.expires_at,
    cancela_no_fim: s.rows[0]?.cancela_no_fim || false,
    two_factor_enabled: user.two_factor_enabled,
    notificacoes_diarias: perfil.notificacoes_diarias,
    gerar_fixas_auto: perfil.gerar_fixas_auto ?? true,
    onboarding_concluido: perfil.onboarding_concluido ?? false,
    modo_empresa: perfil.modo_empresa ?? false,
  };
}

async function enviarCodigo(user, novo = false) {
  const code = novoCodigo();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query('UPDATE auth.users SET two_factor_code = $1, two_factor_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
  await enviarEmail(user.email, novo ? 'Seu novo código de acesso Lyonk' : 'Seu código de acesso Lyonk', emailCodigo2FA(code, novo));
}

async function criarUsuarioBase(client, userId, email, nome) {
  await client.query('INSERT INTO public.profiles (user_id, display_name) VALUES ($1, $2)', [userId, nome]);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias de teste
  await client.query(
    `INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) VALUES ($1, $2, false, 'trial', $3)
     ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [userId, email, expiresAt],
  );
  for (const c of CATEGORIAS_PADRAO) {
    await client.query('INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES ($1, $2, $3, $4, $5)', [userId, c.nome, c.tipo, '#d4af5f', 'Tag']);
  }
}

/** Entra na conta: grava a sessão no cookie e devolve os dados do usuário (o token não vai para o JavaScript). */
async function concluirLogin(res, userId) {
  const user = await dadosUsuario(userId);
  criarSessao(res, user);
  res.json({ user });
}

router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Informe e-mail e uma senha com pelo menos 6 caracteres.' });
  const client = await pool.connect();
  try {
    const existe = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existe.rows.length > 0) return res.status(400).json({ error: 'E-mail já cadastrado' });
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const r = await client.query('INSERT INTO auth.users (email, encrypted_password, confirmation_token) VALUES ($1, $2, $3) RETURNING id', [email, hash, token]);
    await criarUsuarioBase(client, r.rows[0].id, email, name);
    await client.query('COMMIT');
    await enviarEmail(email, 'Confirme seu e-mail no Lyonk', emailConfirmacao(name, token));
    res.json({ message: 'Cadastro realizado. Verifique seu e-mail.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERRO no cadastro:', err);
    res.status(500).json({ error: 'Não foi possível concluir o cadastro.' });
  } finally {
    client.release();
  }
});

router.post('/verify', authLimiter, async (req, res) => {
  const { token } = req.body;
  try {
    const r = await pool.query(
      'UPDATE auth.users SET confirmed = true, confirmation_token = null WHERE confirmation_token = $1 RETURNING id, email, two_factor_enabled',
      [token],
    );
    if (r.rows.length === 0) return res.status(400).json({ error: 'Link de confirmação inválido ou já usado.' });
    const user = r.rows[0];
    if (user.two_factor_enabled === true) {
      await enviarCodigo(user);
      return res.json({ requires_2fa: true, email: user.email });
    }
    await concluirLogin(res, user.id);
  } catch (err) {
    console.error('ERRO na confirmação:', err);
    res.status(500).json({ error: 'Não foi possível confirmar o e-mail.' });
  }
});

router.post('/resend-verification', authLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const r = await pool.query('SELECT id, confirmed FROM auth.users WHERE email = $1', [email]);
    // Mesma resposta exista ou não a conta (evita descobrir e-mails cadastrados)
    if (r.rows.length === 0 || r.rows[0].confirmed) return res.json({ message: 'Se a conta existir e não estiver confirmada, enviamos um novo link.' });
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE auth.users SET confirmation_token = $1 WHERE id = $2', [token, r.rows[0].id]);
    const p = await pool.query('SELECT display_name FROM public.profiles WHERE user_id = $1', [r.rows[0].id]);
    await enviarEmail(email, 'Confirme seu e-mail no Lyonk', emailConfirmacao(p.rows[0]?.display_name || 'Usuário', token));
    res.json({ message: 'Se a conta existir e não estiver confirmada, enviamos um novo link.' });
  } catch (err) {
    console.error('ERRO ao reenviar confirmação:', err);
    res.status(500).json({ error: 'Não foi possível reenviar.' });
  }
});

router.post('/google', authLimiter, async (req, res) => {
  const { access_token } = req.body;
  const client = await pool.connect();
  try {
    const g = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
    const { email, name, verified_email } = g.data;
    if (!email || verified_email === false) return res.status(400).json({ error: 'A conta Google não tem e-mail verificado.' });
    let r = await client.query('SELECT id, confirmed, two_factor_enabled, email FROM auth.users WHERE email = $1', [email]);
    if (r.rows.length === 0) {
      await client.query('BEGIN');
      const hash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const novo = await client.query('INSERT INTO auth.users (email, encrypted_password, confirmed) VALUES ($1, $2, true) RETURNING id', [email, hash]);
      await criarUsuarioBase(client, novo.rows[0].id, email, name);
      await client.query('COMMIT');
      r = await client.query('SELECT id, confirmed, two_factor_enabled, email FROM auth.users WHERE id = $1', [novo.rows[0].id]);
    } else if (!r.rows[0].confirmed) {
      await client.query('UPDATE auth.users SET confirmed = true WHERE id = $1', [r.rows[0].id]);
    }
    const user = r.rows[0];
    if (user.two_factor_enabled === true) {
      await enviarCodigo(user);
      return res.json({ requires_2fa: true, email: user.email });
    }
    await concluirLogin(res, user.id);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERRO no login com Google:', err.message);
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  } finally {
    client.release();
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await pool.query('SELECT id, email, confirmed, encrypted_password, two_factor_enabled FROM auth.users WHERE email = $1', [email]);
    const user = r.rows[0];
    // Mensagem única para e-mail inexistente ou senha errada (não revela quem tem conta)
    if (!user || !(await bcrypt.compare(password || '', user.encrypted_password))) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }
    if (!user.confirmed) return res.status(401).json({ error: 'Confirme seu e-mail primeiro.' });
    if (user.two_factor_enabled === true) {
      await enviarCodigo(user);
      return res.json({ requires_2fa: true, email: user.email });
    }
    await concluirLogin(res, user.id);
  } catch (err) {
    console.error('ERRO no login:', err);
    res.status(500).json({ error: 'Não foi possível entrar agora.' });
  }
});

router.post('/verify-2fa', authLimiter, async (req, res) => {
  const { email, code } = req.body;
  try {
    const r = await pool.query('SELECT id, two_factor_code, two_factor_expires_at FROM auth.users WHERE email = $1', [email]);
    const user = r.rows[0];
    const esperado = Buffer.from(String(user?.two_factor_code || ''));
    const recebido = Buffer.from(String(code || ''));
    const valido = !!user && esperado.length > 0 && esperado.length === recebido.length
      && crypto.timingSafeEqual(esperado, recebido)
      && new Date() <= new Date(user.two_factor_expires_at);
    if (!valido) return res.status(400).json({ error: 'Código inválido ou expirado.' });
    await pool.query('UPDATE auth.users SET two_factor_code = null, two_factor_expires_at = null WHERE id = $1', [user.id]);
    await concluirLogin(res, user.id);
  } catch (err) {
    console.error('ERRO no 2FA:', err);
    res.status(500).json({ error: 'Não foi possível validar o código.' });
  }
});

router.post('/resend-2fa', authLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const r = await pool.query('SELECT id, email, two_factor_enabled FROM auth.users WHERE email = $1', [email]);
    const user = r.rows[0];
    if (!user || !user.two_factor_enabled) return res.status(400).json({ error: 'Não foi possível reenviar o código.' });
    await enviarCodigo(user, true);
    res.json({ message: 'Novo código enviado com sucesso!' });
  } catch (err) {
    console.error('ERRO ao reenviar 2FA:', err);
    res.status(500).json({ error: 'Não foi possível reenviar o código.' });
  }
});

router.post('/set-2fa', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE auth.users SET two_factor_enabled = $1 WHERE id = $2', [!!req.body.enabled, req.user.id]);
    res.json({ message: 'Preferência de 2FA atualizada', enabled: !!req.body.enabled });
  } catch (err) {
    console.error('ERRO ao salvar 2FA:', err);
    res.status(500).json({ error: 'Não foi possível salvar.' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  const resposta = { message: 'Se o e-mail existir, um link de recuperação foi enviado.' };
  try {
    const r = await pool.query('SELECT id, email FROM auth.users WHERE email = $1', [email]);
    if (r.rows.length === 0) return res.json(resposta);
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE auth.users SET reset_password_token = $1, reset_password_expires_at = $2 WHERE id = $3', [token, new Date(Date.now() + 60 * 60 * 1000), r.rows[0].id]);
    await enviarEmail(r.rows[0].email, 'Redefinir senha do Lyonk', emailRecuperacao(token));
    res.json(resposta);
  } catch (err) {
    console.error('ERRO na recuperação:', err);
    res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Informe uma senha com pelo menos 6 caracteres.' });
  try {
    const r = await pool.query('SELECT id FROM auth.users WHERE reset_password_token = $1 AND reset_password_expires_at > NOW()', [token]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE auth.users SET encrypted_password = $1, reset_password_token = NULL, reset_password_expires_at = NULL WHERE id = $2', [hash, r.rows[0].id]);
    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('ERRO ao redefinir senha:', err);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

router.post('/logout', (req, res) => {
  encerrarSessao(res);
  res.json({ ok: true });
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dadosUsuario(req.user.id);
    if (!user) {
      encerrarSessao(res);
      return res.status(401).json({ error: 'Sessão expirada' });
    }
    res.json(user);
  } catch (err) {
    console.error('ERRO em /me:', err);
    res.status(500).json({ error: 'Erro ao carregar a conta.' });
  }
});

const CAMPOS_PERFIL = {
  name: 'display_name',
  notificacoes_diarias: 'notificacoes_diarias',
  gerar_fixas_auto: 'gerar_fixas_auto',
  onboarding_concluido: 'onboarding_concluido',
  modo_empresa: 'modo_empresa',
};

router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const sets = [];
    const valores = [];
    for (const [campo, coluna] of Object.entries(CAMPOS_PERFIL)) {
      if (req.body[campo] !== undefined) {
        valores.push(req.body[campo]);
        sets.push(`${coluna} = $${valores.length}`);
      }
    }
    if (sets.length) {
      valores.push(req.user.id);
      await pool.query(`UPDATE public.profiles SET ${sets.join(', ')} WHERE user_id = $${valores.length}`, valores);
    }
    res.json(await dadosUsuario(req.user.id));
  } catch (err) {
    console.error('ERRO ao salvar perfil:', err);
    res.status(500).json({ error: 'Não foi possível salvar.' });
  }
});

// Exclusão da conta: apaga tudo numa transação (algumas tabelas antigas não têm ON DELETE CASCADE)
router.delete('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = req.user.id;
    for (const tabela of ['anexos', 'metas_aportes', 'metas', 'orcamentos', 'regras_categoria', 'transferencias', 'receitas', 'despesas', 'receitas_recorrentes', 'cartoes', 'contas', 'lembretes', 'push_inscricoes', 'alertas_enviados', 'geracoes_mensais', 'pluggy_vinculos', 'pluggy_estado', 'cupons_usados', 'categorias', 'profiles']) {
      await client.query(`DELETE FROM public.${tabela} WHERE user_id = $1`, [id]);
    }
    await client.query('DELETE FROM public.compartilhamentos WHERE dono_id = $1 OR membro_id = $1', [id]);
    await client.query('DELETE FROM public.subscribers WHERE user_id = $1', [id]);
    await client.query('DELETE FROM auth.users WHERE id = $1', [id]);
    await client.query('COMMIT');
    encerrarSessao(res);
    res.json({ message: 'Conta excluída' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERRO ao excluir conta:', err);
    res.status(500).json({ error: 'Não foi possível excluir a conta.' });
  } finally {
    client.release();
  }
});

export default router;
