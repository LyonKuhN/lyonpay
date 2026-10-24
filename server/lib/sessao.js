import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

// Segredo das sessões. Sem JWT_SECRET o servidor NÃO usa mais um valor fixo do código
// (qualquer um poderia forjar logins): gera um aleatório e avisa. Os logins caem a cada reinício.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.error('!!! [SEGURANÇA] JWT_SECRET não definido. Usando segredo aleatório: os usuários serão desconectados a cada reinício. Defina JWT_SECRET no ambiente.');
  return crypto.randomBytes(48).toString('hex');
})();

export const COOKIE_SESSAO = 'lyonk_sessao';
const DURACAO_SEGUNDOS = 7 * 24 * 60 * 60; // 7 dias, renovados enquanto a pessoa usa
const RENOVAR_APOS_SEGUNDOS = 12 * 60 * 60;

export const emProducao = () => !!process.env.SERVICE_FQDN_LYONPAY_WEB;

export function frontendUrl() {
  const fqdn = process.env.SERVICE_FQDN_LYONPAY_WEB;
  if (!fqdn) return process.env.FRONTEND_URL || 'http://localhost:5173';
  return /^https?:\/\//.test(fqdn) ? fqdn.replace(/\/$/, '') : `https://${fqdn}`;
}

function opcoesCookie() {
  // O front chama a API pelo mesmo endereço (proxy /api no nginx e no Vite), então o cookie é de primeira parte.
  // COOKIE_SAMESITE=none só é necessário se a API for chamada de outro domínio.
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    httpOnly: true,
    secure: emProducao() || sameSite === 'none',
    sameSite,
    path: '/',
    maxAge: DURACAO_SEGUNDOS * 1000,
  };
}

export function criarSessao(res, usuario) {
  const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: DURACAO_SEGUNDOS });
  res.cookie(COOKIE_SESSAO, token, opcoesCookie());
}

export function encerrarSessao(res) {
  const { maxAge, ...opts } = opcoesCookie();
  void maxAge;
  res.clearCookie(COOKIE_SESSAO, opts);
}

function lerCookie(req, nome) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

/** Exige sessão válida (cookie httpOnly; o cabeçalho Bearer continua aceito para integrações). */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = lerCookie(req, COOKIE_SESSAO) || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'Faça login para continuar' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Sessão expirada' });
    req.user = { id: user.id, email: user.email };
    // Sessão deslizante: quem está usando não é desconectado no meio do uso
    if (user.iat && Date.now() / 1000 - user.iat > RENOVAR_APOS_SEGUNDOS && lerCookie(req, COOKIE_SESSAO)) {
      criarSessao(res, req.user);
    }
    next();
  });
}

export async function isAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM auth.users WHERE id = $1', [req.user.id]);
    if (result.rows[0]?.role === 'admin') return next();
    res.status(403).json({ error: 'Acesso restrito a administradores' });
  } catch (err) {
    next(err);
  }
}

/**
 * Espaço de dados ativo (conta compartilhada). O front envia X-Lyonk-Espaco com o id do dono
 * quando a pessoa está vendo as finanças de outra conta. Sem o cabeçalho, o espaço é o próprio.
 */
export async function resolverEspaco(req, res, next) {
  const dono = req.headers['x-lyonk-espaco'];
  req.ownerId = req.user.id;
  req.permissao = 'editar';
  if (!dono || dono === req.user.id) return next();
  try {
    const r = await pool.query(
      `SELECT permissao FROM public.compartilhamentos WHERE dono_id = $1 AND membro_id = $2 AND status = 'aceito'`,
      [dono, req.user.id],
    );
    if (r.rows.length === 0) return res.status(403).json({ error: 'Você não tem acesso a esse espaço' });
    req.ownerId = dono;
    req.permissao = r.rows[0].permissao;
    if (req.permissao === 'ver' && req.method !== 'GET') {
      return res.status(403).json({ error: 'Seu acesso a este espaço é só de leitura' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Autenticação + espaço ativo, para as rotas de dados financeiros. */
export const autenticado = [authenticateToken, resolverEspaco];
