import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Log de depuração mais limpo
console.log('--- [SISTEMA] Verificação de Variáveis ---');
console.log('Ambiente:', process.env.NODE_ENV || 'development');
console.log('Resend Key:', process.env.RESEND_API_KEY ? '✅ Configurada' : '❌ AUSENTE');
console.log('Email From:', process.env.EMAIL_FROM ? `✅ (${process.env.EMAIL_FROM})` : '❌ AUSENTE');
console.log('Frontend URL:', process.env.SERVICE_FQDN_LYONPAY_WEB || 'Não definida (usando localhost)');
console.log('---------------------------------------');

process.on('uncaughtException', (err) => {
  console.error('!!! ERRO CRÍTICO (Uncaught):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('!!! REJEIÇÃO NÃO TRATADA:', reason);
});

// Força o loop de eventos a ficar ativo
setInterval(() => {}, 1000000);

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import axios from 'axios';
import Stripe from 'stripe';
import { Resend } from 'resend';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pool from './db.js';
import { initCronJobs } from './cron.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const resend = new Resend(process.env.RESEND_API_KEY || '');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmailReliably = async (toEmail, subject, htmlContent) => {
  console.log(`[Email] Tentando enviar e-mail para: ${toEmail}`);
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Lyonk <onboarding@resend.dev>',
      to: toEmail,
      subject,
      html: htmlContent,
    });
    if (error) {
      console.warn("[Resend] Falhou, tentando fallback Nodemailer. Erro:", error.message);
      throw new Error("Resend failed");
    }
    console.log("[Resend] E-mail enviado com sucesso! ID:", data.id);
  } catch (err) {
    try {
      console.log("[Nodemailer] Tentando enviar e-mail via SMTP...");
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Lyonk <adm@lyonk.com.br>',
        to: toEmail,
        subject,
        html: htmlContent,
      });
      console.log("[Nodemailer] E-mail enviado com sucesso!");
    } catch (nodeErr) {
      console.error("!!! FALHA CRÍTICA AO ENVIAR EMAIL (AMBOS FALHARAM):", nodeErr);
    }
  }
};

const app = express();

// Necessário para o Coolify/Docker (Proxy Reverso) identificar o IP real do usuário
app.set('trust proxy', 1);

const allowedOrigins = process.env.SERVICE_FQDN_LYONPAY_WEB 
  ? [`https://${process.env.SERVICE_FQDN_LYONPAY_WEB}`, `http://${process.env.SERVICE_FQDN_LYONPAY_WEB}`] 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- SECURITY MIDDLEWARES ---
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Aumentado para evitar bloqueios acidentais em produção
  message: { error: 'Muitas requisições vindas deste IP, tente novamente mais tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limite estrito de 10 requisições por IP (Anti Brute-Force)
  message: { error: 'Muitas tentativas. Bloqueio de segurança ativado por 15 minutos.' }
});

app.use('/api/', limiter); 
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'lyonpay-secret-key-2026';

const sendConfirmationEmail = async (email, name, token) => {
  const frontendUrl = process.env.SERVICE_FQDN_LYONPAY_WEB 
    ? `https://${process.env.SERVICE_FQDN_LYONPAY_WEB}` 
    : 'http://localhost:5173';
  
  const verifyUrl = `${frontendUrl}/verify?token=${token}`;
  const htmlContent = `
    <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
      <h1 style="color: #a3ff12; font-size: 24px;">Olá, ${name}!</h1>
      <p style="font-size: 16px; color: #a1a1aa;">Para começar a usar o Lyonk, precisamos que você confirme seu e-mail.</p>
      <div style="text-align: center;">
        <a href="${verifyUrl}" style="display: inline-block; background-color: #a3ff12; color: black; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; margin: 20px 0;">Confirmar E-mail</a>
      </div>
      <p style="font-size: 14px; color: #71717a;">Ou copie o link: ${verifyUrl}</p>
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 30px 0;" />
      <p style="font-weight: bold; color: #FFD700;">Lyonk - Controle seu futuro.</p>
    </div>
  `;

  await sendEmailReliably(email, "Confirme seu e-mail no Lyonk! 🛡️", htmlContent);
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

const isAdmin = async (req, res, next) => {
  const result = await pool.query('SELECT role FROM auth.users WHERE id = $1', [req.user.id]);
  if (result.rows[0]?.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const userExist = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (userExist.rows.length > 0) return res.status(400).json({ error: 'E-mail já cadastrado' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO auth.users (email, encrypted_password) VALUES ($1, $2) RETURNING id', [email, hashedPassword]);
    const user = result.rows[0];
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE auth.users SET confirmation_token = $1 WHERE id = $2', [confirmationToken, user.id]);
    await pool.query('INSERT INTO public.profiles (user_id, display_name) VALUES ($1, $2)', [user.id, name]);
    
    // 7 Dias de Teste Grátis para novos usuários
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await pool.query(
      'INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) VALUES ($1, $2, false, $3, $4)',
      [user.id, email, 'trial', expiresAt]
    );

    // Categorias padrão para o usuário
    const defaultCategories = [
      { nome: 'Moradia', cor: '#00D1FF', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Transporte', cor: '#FFD700', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Alimentação', cor: '#FF7A00', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Saúde', cor: '#FF4D4D', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Educação', cor: '#9B59B6', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Lazer', cor: '#a3ff12', tipo: 'despesa', icone: 'Tag' },
      { nome: 'Salário', cor: '#a3ff12', tipo: 'receita', icone: 'Tag' }
    ];

    for (const cat of defaultCategories) {
      await pool.query(
        'INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES ($1, $2, $3, $4, $5)',
        [user.id, cat.nome, cat.tipo, cat.cor, cat.icone]
      );
    }

    await sendConfirmationEmail(email, name, confirmationToken);
    res.json({ message: 'Cadastro realizado. Verifique seu e-mail.' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/verify', authLimiter, async (req, res) => {
  const { token } = req.body;
  try {
    const result = await pool.query('UPDATE auth.users SET confirmed = true, confirmation_token = null WHERE confirmation_token = $1 RETURNING id, email, role, two_factor_enabled', [token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Token inválido' });
    const user = result.rows[0];
    const profile = await pool.query('SELECT display_name, notificacoes_diarias FROM public.profiles WHERE user_id = $1', [user.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';

    if (user.two_factor_enabled === true) {
      // Gerar código de 6 dígitos
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      await pool.query('UPDATE auth.users SET two_factor_code = $1, two_factor_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #a3ff12; font-size: 24px;">Código de Verificação</h1>
          <p style="font-size: 16px; color: #a1a1aa;">Seu código de acesso (2FA) é:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background-color: #27272a; color: #a3ff12; padding: 15px 30px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #71717a;">Este código expira em 10 minutos.</p>
        </div>
      `;
      
      await sendEmailReliably(user.email, "Seu Código de Acesso Lyonk 🔐", htmlContent);

      return res.json({ requires_2fa: true, email: user.email });
    }

    const jwtToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '3h' });
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name, role: user.role, subscribed: sub.rows[0]?.subscribed || false, expires_at: sub.rows[0]?.expires_at, two_factor_enabled: user.two_factor_enabled } });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];
    if (user.confirmed) return res.status(400).json({ error: 'E-mail já confirmado' });

    const confirmationToken = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE auth.users SET confirmation_token = $1 WHERE id = $2', [confirmationToken, user.id]);
    
    const profile = await pool.query('SELECT display_name FROM public.profiles WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';

    await sendConfirmationEmail(email, name, confirmationToken);
    res.json({ message: 'Novo código enviado com sucesso!' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Google OAuth
app.post('/api/auth/google', authLimiter, async (req, res) => {
  const { access_token } = req.body;
  try {
    // Validar token com Google
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const { email, name, picture } = response.data;
    
    // Verificar se usuário existe
    let user = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      // Criar novo usuário
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const result = await pool.query(
        'INSERT INTO auth.users (email, encrypted_password, confirmed) VALUES ($1, $2, true) RETURNING id',
        [email, hashedPassword]
      );
      
      const userId = result.rows[0].id;
      
      // Criar perfil do usuário
      await pool.query(
        'INSERT INTO public.profiles (user_id, display_name) VALUES ($1, $2)',
        [userId, name]
      );
      
      // 7 Dias de Teste Grátis para novos usuários
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await pool.query(
        'INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) VALUES ($1, $2, false, $3, $4)',
        [userId, email, 'trial', expiresAt]
      );
      
      // Categorias padrão para o usuário
      const defaultCategories = [
        { nome: 'Moradia', cor: '#00D1FF', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Transporte', cor: '#FFD700', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Alimentação', cor: '#FF7A00', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Saúde', cor: '#FF4D4D', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Educação', cor: '#9B59B6', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Lazer', cor: '#a3ff12', tipo: 'despesa', icone: 'Tag' },
        { nome: 'Salário', cor: '#a3ff12', tipo: 'receita', icone: 'Tag' }
      ];

      for (const cat of defaultCategories) {
        await pool.query(
          'INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES ($1, $2, $3, $4, $5)',
          [userId, cat.nome, cat.tipo, cat.cor, cat.icone]
        );
      }
      
      user = await pool.query('SELECT * FROM auth.users WHERE id = $1', [userId]);
    } else {
      // Se usuário existe mas não está confirmado, confirmar agora
      if (!user.rows[0].confirmed) {
        await pool.query('UPDATE auth.users SET confirmed = true WHERE id = $1', [user.rows[0].id]);
      }
    }
    
    const userData = user.rows[0];
    const profile = await pool.query('SELECT display_name, notificacoes_diarias FROM public.profiles WHERE user_id = $1', [userData.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [userData.id]);
    const displayName = profile.rows[0]?.display_name || 'Usuário';

    if (userData.two_factor_enabled === true) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      await pool.query('UPDATE auth.users SET two_factor_code = $1, two_factor_expires_at = $2 WHERE id = $3', [code, expiresAt, userData.id]);
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #a3ff12; font-size: 24px;">Código de Verificação</h1>
          <p style="font-size: 16px; color: #a1a1aa;">Seu código de acesso (2FA) é:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background-color: #27272a; color: #a3ff12; padding: 15px 30px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #71717a;">Este código expira em 10 minutos.</p>
        </div>
      `;
      
      await sendEmailReliably(userData.email, "Seu Código de Acesso Lyonk 🔐", htmlContent);

      return res.json({ requires_2fa: true, email: userData.email });
    }
    
    const jwtToken = jwt.sign({ id: userData.id, email: userData.email }, JWT_SECRET, { expiresIn: '3h' });
    res.json({
      token: jwtToken,
      user: {
        id: userData.id,
        email: userData.email,
        name: displayName,
        role: userData.role,
        subscribed: sub.rows[0]?.subscribed || false,
        expires_at: sub.rows[0]?.expires_at,
        two_factor_enabled: userData.two_factor_enabled,
        notificacoes_diarias: profile.rows[0]?.notificacoes_diarias
      }
    });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];
    if (!user.confirmed) return res.status(401).json({ error: 'Confirme seu e-mail primeiro.' });
    const validPassword = await bcrypt.compare(password, user.encrypted_password);
    if (!validPassword) return res.status(400).json({ error: 'Senha incorreta' });
    
    if (user.two_factor_enabled === true) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      await pool.query('UPDATE auth.users SET two_factor_code = $1, two_factor_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #a3ff12; font-size: 24px;">Código de Verificação</h1>
          <p style="font-size: 16px; color: #a1a1aa;">Seu código de acesso (2FA) é:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background-color: #27272a; color: #a3ff12; padding: 15px 30px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #71717a;">Este código expira em 10 minutos.</p>
        </div>
      `;
      
      await sendEmailReliably(email, "Seu Código de Acesso Lyonk 🔐", htmlContent);

      return res.json({ requires_2fa: true, email: user.email });
    }

    const profile = await pool.query('SELECT display_name, notificacoes_diarias FROM public.profiles WHERE user_id = $1', [user.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '3h' });
    res.json({ token, user: { id: user.id, email: user.email, name, role: user.role, subscribed: sub.rows[0]?.subscribed || false, expires_at: sub.rows[0]?.expires_at, two_factor_enabled: user.two_factor_enabled, notificacoes_diarias: profile.rows[0]?.notificacoes_diarias } });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/verify-2fa', authLimiter, async (req, res) => {
  const { email, code } = req.body;
  try {
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];

    if (!user.two_factor_code || user.two_factor_code !== code || new Date() > new Date(user.two_factor_expires_at)) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    await pool.query('UPDATE auth.users SET two_factor_code = null, two_factor_expires_at = null WHERE id = $1', [user.id]);

    const profile = await pool.query('SELECT display_name, notificacoes_diarias FROM public.profiles WHERE user_id = $1', [user.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '3h' });
    res.json({ token, user: { id: user.id, email: user.email, name, role: user.role, subscribed: sub.rows[0]?.subscribed || false, expires_at: sub.rows[0]?.expires_at, two_factor_enabled: true, notificacoes_diarias: profile.rows[0]?.notificacoes_diarias } });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/resend-2fa', authLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id, email, two_factor_enabled FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];

    if (!user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA não está ativado para este usuário.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    await pool.query('UPDATE auth.users SET two_factor_code = $1, two_factor_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
    
    const htmlContent = `
      <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
        <h1 style="color: #a3ff12; font-size: 24px;">Novo Código de Verificação</h1>
        <p style="font-size: 16px; color: #a1a1aa;">Seu novo código de acesso (2FA) é:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; background-color: #27272a; color: #a3ff12; padding: 15px 30px; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #71717a;">Este código expira em 10 minutos.</p>
      </div>
    `;
    
    await sendEmailReliably(user.email, "Novo Código de Acesso Lyonk 🔐", htmlContent);

    res.json({ message: 'Novo código enviado com sucesso!' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/set-2fa', authenticateToken, async (req, res) => {
  const { enabled } = req.body;
  try {
    await pool.query('UPDATE auth.users SET two_factor_enabled = $1 WHERE id = $2', [enabled, req.user.id]);
    res.json({ message: 'Preferência de 2FA atualizada', enabled });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id, email FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Retorna sucesso silenciosamente para evitar "email enumeration"
      return res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
    }
    const user = result.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

    await pool.query(
      'UPDATE auth.users SET reset_password_token = $1, reset_password_expires_at = $2 WHERE id = $3',
      [token, expiresAt, user.id]
    );

    const resetLink = `${process.env.SERVICE_FQDN_LYONPAY_WEB || 'http://localhost:5173'}/reset-password?token=${token}`;
    const htmlContent = `
      <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px;">
        <h1 style="color: #a3ff12; font-size: 24px;">Recuperação de Senha</h1>
        <p style="font-size: 16px; color: #a1a1aa;">Você solicitou a redefinição da sua senha na Lyonk. Clique no botão abaixo para criar uma nova senha:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #a3ff12; color: black; padding: 15px 30px; border-radius: 12px; font-size: 16px; font-weight: bold; text-decoration: none;">Redefinir Minha Senha</a>
        </div>
        <p style="font-size: 14px; color: #71717a;">Se você não solicitou isso, pode ignorar este e-mail com segurança. O link expira em 1 hora.</p>
      </div>
    `;

    await sendEmailReliably(user.email, "Recuperação de Senha - Lyonk", htmlContent);

    res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT id FROM auth.users WHERE reset_password_token = $1 AND reset_password_expires_at > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
    }

    const userId = result.rows[0].id;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE auth.users SET encrypted_password = $1, reset_password_token = NULL, reset_password_expires_at = NULL WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

app.patch('/api/auth/me', authenticateToken, async (req, res) => {
  const { name, notificacoes_diarias } = req.body;
  try {
    let updateFields = [];
    let values = [];
    let idx = 1;
    if (name !== undefined) {
      updateFields.push(`display_name = $${idx++}`);
      values.push(name);
    }
    if (notificacoes_diarias !== undefined) {
      updateFields.push(`notificacoes_diarias = $${idx++}`);
      values.push(notificacoes_diarias);
    }
    values.push(req.user.id);
    
    if (updateFields.length > 0) {
      await pool.query(`UPDATE public.profiles SET ${updateFields.join(', ')} WHERE user_id = $${idx}`, values);
    }
    res.json({ message: 'Perfil atualizado' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.delete('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM auth.users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Deletado' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// --- CATEGORIAS ROUTES ---
app.get('/api/categorias', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.categorias WHERE user_id IS NULL OR user_id = $1 ORDER BY nome ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/categorias', authenticateToken, async (req, res) => {
  const { nome, tipo, cor, icone } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, nome, tipo, cor, icone]
    );
    res.json(result.rows[0]);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// --- SEARCH ROUTE ---
app.get('/api/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  try {
    const despesas = await pool.query(
      "SELECT *, 'despesa' as row_type FROM public.despesas WHERE user_id = $1 AND descricao ILIKE $2 AND is_modelo = false ORDER BY data_vencimento DESC",
      [req.user.id, `%${q}%`]
    );
    const receitas = await pool.query(
      "SELECT *, 'receita' as row_type FROM public.receitas WHERE user_id = $1 AND descricao ILIKE $2 ORDER BY data_recebimento DESC",
      [req.user.id, `%${q}%`]
    );
    res.json([...despesas.rows, ...receitas.rows]);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// --- RECEITAS ROUTES ---
app.get('/api/receitas', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.receitas WHERE user_id = $1 ORDER BY data_recebimento DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/receitas', authenticateToken, async (req, res) => {
  const { descricao, valor, data_recebimento, categoria } = req.body;
  try {
    const result = await pool.query('INSERT INTO public.receitas (user_id, descricao, valor, data_recebimento, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *', [req.user.id, descricao, valor, data_recebimento, categoria || 'Outros']);
    res.json(result.rows[0]);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/receitas/:id/valor', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { valor } = req.body;
    await pool.query('UPDATE public.receitas SET valor = $1 WHERE id = $2 AND user_id = $3', [valor, id, req.user.id]);
    res.json({ message: 'Valor atualizado com sucesso' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/receitas/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM public.receitas WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ message: 'Receita excluída com sucesso' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// --- DESPESAS ROUTES ---
app.get('/api/despesas', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  let query = 'SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = false';
  const params = [req.user.id];

  if (year) {
    if (month && month !== 'all' && month !== '0') {
      query += ' AND EXTRACT(MONTH FROM data_vencimento) = $2 AND EXTRACT(YEAR FROM data_vencimento) = $3';
      params.push(parseInt(month), parseInt(year));
    } else {
      query += ' AND EXTRACT(YEAR FROM data_vencimento) = $2';
      params.push(parseInt(year));
    }
  }

  query += ' ORDER BY data_vencimento DESC';
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/despesas/atrasadas', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.despesas 
       WHERE user_id = $1 AND pago = false AND is_modelo = false 
       AND data_vencimento < CURRENT_DATE
       ORDER BY data_vencimento ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/despesas/modelos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = true ORDER BY descricao ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/despesas', authenticateToken, async (req, res) => {
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria, datas_personalizadas } = req.body;
  const groupId = crypto.randomUUID(); 
  const v_cat = categoria || 'Outros';

  try {
    const v_valor = valor === '' ? null : parseFloat(valor);
    const v_total = valor_total === '' ? null : parseFloat(valor_total);
    const v_parcelas = (numero_parcelas === '' || !numero_parcelas) ? null : parseInt(numero_parcelas);

    if (tipo === 'parcelada' && v_parcelas > 1) {
      const generated = [];
      const useCustom = Array.isArray(datas_personalizadas) && datas_personalizadas.length === v_parcelas;
      // Parsear a data manualmente para evitar problemas de fuso horário (YYYY-MM-DD)
      const [year, month, day] = (data_vencimento || '2000-01-01').split('-').map(Number);
      
      for (let i = 0; i < v_parcelas; i++) {
        let currentVencimento;
        if (useCustom) {
          currentVencimento = datas_personalizadas[i];
        } else {
          // Criar a data baseada nos componentes e adicionar os meses
          const date = new Date(year, (month - 1) + i, day);
          
          // Ajustar para o formato YYYY-MM-DD para salvar no banco corretamente como DATE
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          currentVencimento = `${y}-${m}-${d}`;
        }

        const resInsert = await pool.query(
          `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, parcela_atual, group_id, categoria) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [req.user.id, `${descricao} (${i + 1}/${v_parcelas})`, v_valor, currentVencimento, tipo, v_parcelas, v_total, observacoes, i + 1, groupId, v_cat]
        );
        generated.push(resInsert.rows[0]);
      }
      return res.json(generated);
    } else {
      const is_modelo = tipo === 'fixa';
      const result = await pool.query(
        `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, is_modelo, categoria, usa_media) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [req.user.id, descricao, v_valor, data_vencimento, tipo, v_parcelas, v_total, observacoes, is_modelo, v_cat, req.body.usa_media || false]
      );
      res.json(result.rows[0]);
    }
  } catch (err) { 
    console.error("Erro ao salvar despesa:", err);
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/despesas/:id', authenticateToken, async (req, res) => {
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria, usa_media } = req.body;
  try {
    const v_valor = valor === '' ? null : parseFloat(valor);
    const v_total = valor_total === '' ? null : parseFloat(valor_total);
    const v_parcelas = (numero_parcelas === '' || !numero_parcelas) ? null : parseInt(numero_parcelas);
    const v_cat = categoria || 'Outros';

    const result = await pool.query(
      `UPDATE public.despesas SET 
        descricao = $1, valor = $2, data_vencimento = $3, tipo = $4, 
        numero_parcelas = $5, valor_total = $6, observacoes = $7, 
        categoria = $8, usa_media = $9, updated_at = now() 
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [descricao, v_valor, data_vencimento, tipo, v_parcelas, v_total, observacoes, v_cat, usa_media || false, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/despesas/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.despesas WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Removido' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/despesas/:id/pagar', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE public.despesas SET pago = true, data_pagamento = now() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Pago' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/despesas/:id/pendente', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE public.despesas SET pago = false, data_pagamento = null WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Pendente' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/despesas/:id/valor', authenticateToken, async (req, res) => {
  const { valor } = req.body;
  try {
    await pool.query('UPDATE public.despesas SET valor = $1 WHERE id = $2 AND user_id = $3', [valor, req.params.id, req.user.id]);
    res.json({ message: 'Valor atualizado' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/despesas/gerar-fixas', authenticateToken, async (req, res) => {
  const { month, year, replace } = req.body;
  try {
    const modelos = await pool.query(`SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = true`, [req.user.id]);
    
    if (!replace) {
      const checkExisting = await pool.query(`SELECT id FROM public.despesas WHERE user_id = $1 AND EXTRACT(MONTH FROM data_vencimento) = $2 AND EXTRACT(YEAR FROM data_vencimento) = $3 AND is_modelo = false AND tipo = 'fixa'`, [req.user.id, parseInt(month), parseInt(year)]);
      if (checkExisting.rows.length > 0) {
        return res.status(409).json({ error: 'As despesas já foram geradas para o mês, gostaria de substituir?', promptReplace: true });
      }
    } else {
      await pool.query(`DELETE FROM public.despesas WHERE user_id = $1 AND EXTRACT(MONTH FROM data_vencimento) = $2 AND EXTRACT(YEAR FROM data_vencimento) = $3 AND is_modelo = false AND tipo = 'fixa'`, [req.user.id, parseInt(month), parseInt(year)]);
    }

    let createdCount = 0;
    for (const modelo of modelos.rows) {
      let finalValor = modelo.valor;
      if (modelo.usa_media) {
         const mediaQuery = await pool.query(`SELECT AVG(valor) as media_valor FROM public.despesas WHERE user_id = $1 AND descricao = $2 AND is_modelo = false AND data_vencimento >= date_trunc('month', current_date - interval '6 months')`, [req.user.id, modelo.descricao]);
         if (mediaQuery.rows.length > 0 && mediaQuery.rows[0].media_valor != null) {
            finalValor = mediaQuery.rows[0].media_valor;
         }
      }
      
      const exists = await pool.query(`SELECT id FROM public.despesas WHERE user_id = $1 AND descricao = $2 AND EXTRACT(MONTH FROM data_vencimento) = $3 AND EXTRACT(YEAR FROM data_vencimento) = $4 AND is_modelo = false`, [req.user.id, modelo.descricao, parseInt(month), parseInt(year)]);
      if (exists.rows.length === 0) {
        const novaData = new Date(year, month - 1, new Date(modelo.data_vencimento).getDate());
        await pool.query(`INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, observacoes, is_modelo, categoria) VALUES ($1, $2, $3, $4, $5, $6, false, $7)`, [req.user.id, modelo.descricao, finalValor, novaData, 'fixa', modelo.observacoes, modelo.categoria]);
        createdCount++;
      }
    }
    res.json({ message: `${createdCount} despesas geradas.`, createdCount });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// --- LEMBRETES ROUTES ---
app.get('/api/lembretes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.lembretes WHERE user_id = $1 ORDER BY data_lembrete ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lembretes', authenticateToken, async (req, res) => {
  const { titulo, descricao, data_lembrete } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.lembretes (user_id, titulo, descricao, data_lembrete) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, titulo, descricao, data_lembrete]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/lembretes/:id/concluir', authenticateToken, async (req, res) => {
  const { concluido } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.lembretes SET concluido = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [concluido, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lembretes/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.lembretes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Lembrete removido' });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// --- STRIPE & SUBSCRIPTIONS ---
app.post('/api/stripe/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { cupom_codigo } = req.body || {};
    let stripeCouponId = undefined;

    if (cupom_codigo) {
      const cRes = await pool.query('SELECT * FROM public.cupons WHERE codigo = $1', [cupom_codigo]);
      if (cRes.rows.length > 0) {
        const cupom = cRes.rows[0];
        if (parseFloat(cupom.desconto_percentual) > 0 && parseFloat(cupom.desconto_percentual) < 100) {
          const stripeCoupon = await stripe.coupons.create({
            percent_off: parseFloat(cupom.desconto_percentual),
            duration: 'forever',
            name: cupom_codigo
          });
          stripeCouponId = stripeCoupon.id;
        }
      }
    }

    const config = await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'");
    const fee = parseFloat(config.rows[0]?.value || '17.90');

    const frontendUrl = process.env.SERVICE_FQDN_LYONPAY_WEB 
      ? `https://${process.env.SERVICE_FQDN_LYONPAY_WEB}` 
      : 'http://localhost:5173';

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Lyonk Pro', description: 'Acesso total ao sistema de gestão financeira' },
          unit_amount: Math.round(fee * 100),
          recurring: { interval: 'month' }
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${frontendUrl}/config?success=true`,
      cancel_url: `${frontendUrl}/config?canceled=true`,
      customer_email: req.user.email,
      metadata: { user_id: req.user.id }
    };

    if (stripeCouponId) {
      sessionConfig.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ url: session.url });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// Webhook Stripe
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata.user_id;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await pool.query(
      `INSERT INTO public.subscribers (user_id, email, stripe_customer_id, subscribed, subscription_tier, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'pro', expires_at = $6`,
      [user_id, session.customer_email, session.customer, true, 'pro', expiresAt]
    );
  }
  res.json({ received: true });
});

// Fallback para verificar sessão sem webhook (útil localmente)
app.get('/api/stripe/verify-session', authenticateToken, async (req, res) => {
  try {
    const sub = await pool.query('SELECT subscribed FROM public.subscribers WHERE user_id = $1', [req.user.id]);
    if (sub.rows[0]?.subscribed) {
      return res.json({ subscribed: true });
    }
    
    // Se não está no banco, talvez o webhook não chegou (local). 
    // Como simplificação para o usuário, se ele chegou aqui via success_url, 
    // vamos considerar que ele pagou (APENAS PARA TESTE/DEV ou se validarmos a sessão via Stripe API)
    // Para ser seguro, buscaríamos a última sessão do usuário no Stripe:
    const sessions = await stripe.checkout.sessions.list({ limit: 1, customer_details: { email: req.user.email } });
    if (sessions.data.length > 0 && sessions.data[0].payment_status === 'paid') {
       const expiresAt = new Date();
       expiresAt.setDate(expiresAt.getDate() + 30);
       await pool.query(
        `INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) 
         VALUES ($1, $2, true, 'pro', $3) 
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'pro', expires_at = $3`,
        [req.user.id, req.user.email, expiresAt]
      );
      return res.json({ subscribed: true, expires_at: expiresAt });
    }
    
    res.json({ subscribed: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM auth.users');
    const proUsers = await pool.query('SELECT COUNT(*) FROM public.subscribers WHERE subscribed = true');
    const lastReceitas = await pool.query('SELECT SUM(valor) as total FROM public.receitas');
    const lastDespesas = await pool.query('SELECT SUM(valor) as total FROM public.despesas');
    const feeConfig = await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'");

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      proUsers: parseInt(proUsers.rows[0].count),
      globalVolume: parseFloat(lastReceitas.rows[0].total || 0) + parseFloat(lastDespesas.rows[0].total || 0),
      monthlyFee: feeConfig.rows[0]?.value || '17.90'
    });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/admin/config', authenticateToken, isAdmin, async (req, res) => {
  const { key, value } = req.body;
  try {
    await pool.query('INSERT INTO public.config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()', [key, value]);
    res.json({ message: 'Configuração atualizada' });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at, p.display_name, COALESCE(s.subscribed, false) as is_pro 
      FROM auth.users u 
      LEFT JOIN public.profiles p ON u.id = p.user_id 
      LEFT JOIN public.subscribers s ON u.id = s.user_id 
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BACKGROUND WORKER: LEMBRETES ---
const checkReminders = async () => {
  console.log(`[Worker] Verificando lembretes: ${new Date().toLocaleString()}`);
  try {
    // Busca lembretes não notificados que estão no horário de acontecer (ou já passaram)
    // Consideramos uma margem de segurança
    const result = await pool.query(`
      SELECT l.*, u.email as user_email, p.display_name
      FROM public.lembretes l
      JOIN auth.users u ON l.user_id = u.id
      LEFT JOIN public.profiles p ON u.id = p.user_id
      WHERE l.concluido = false 
      AND l.notificado = false
      AND l.data_lembrete <= NOW() + INTERVAL '1 minute'
    `);

    if (result.rows.length > 0) {
      console.log(`[Worker] Encontrados ${result.rows.length} lembretes para enviar.`);
    }

    for (const rem of result.rows) {
      console.log(`[Worker] Enviando e-mail para ${rem.user_email} (ID Lembrete: ${rem.id})`);
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="background-color: #FFD700; color: black; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase;">Lembrete Lyonk</span>
          </div>
          <h1 style="color: #a3ff12; font-size: 24px; margin-bottom: 10px;">Olá, ${rem.display_name || 'Usuário'}!</h1>
          <p style="font-size: 18px; color: white; font-weight: bold; margin-bottom: 5px;">${rem.titulo}</p>
          <p style="font-size: 16px; color: #a1a1aa; margin-bottom: 20px;">${rem.descricao || 'Você tem um compromisso agendado para agora.'}</p>
          
          <div style="background-color: #15151A; padding: 20px; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 20px;">
            <p style="margin: 0; color: #71717a; font-size: 12px; text-transform: uppercase;">Horário Agendado</p>
            <p style="margin: 5px 0 0 0; color: white; font-weight: bold;">${new Date(rem.data_lembrete).toLocaleString('pt-BR')}</p>
          </div>

          <div style="text-align: center;">
            <a href="https://${process.env.SERVICE_FQDN_LYONPAY_WEB || 'localhost:5173'}/calendario" style="display: inline-block; background-color: #a3ff12; color: black; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; margin: 10px 0;">Ver no Calendário</a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #27272a; margin: 30px 0;" />
          <p style="font-weight: bold; color: #FFD700; text-align: center;">Lyonk - Controle seu futuro.</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Lyonk <alertas@resend.dev>',
          to: rem.user_email,
          subject: `🔔 Lembrete: ${rem.titulo}`,
          html: htmlContent,
        });

        // Marcar como notificado para não enviar de novo
        await pool.query('UPDATE public.lembretes SET notificado = true WHERE id = $1', [rem.id]);
      } catch (err) {
        console.error(`[Worker] Erro ao enviar email para ${rem.user_email}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Worker] Erro na rotina de lembretes:", err);
  }
};

// Executa a cada 5 minutos
setInterval(checkReminders, 5 * 60 * 1000);
// Executa uma vez na inicialização (após 10 segundos)
setTimeout(checkReminders, 10000);

initCronJobs();

const PORT = process.env.PORT || 3005;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


// --- DASHBOARD ROUTES ---
app.get('/api/dashboard/evolucao', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    let queryReceitas = `SELECT EXTRACT(MONTH FROM data_recebimento) as mes, EXTRACT(YEAR FROM data_recebimento) as ano, SUM(valor) as total FROM public.receitas WHERE user_id = $1`;
    let queryDespesas = `SELECT EXTRACT(MONTH FROM data_vencimento) as mes, EXTRACT(YEAR FROM data_vencimento) as ano, SUM(valor) as total FROM public.despesas WHERE user_id = $1 AND is_modelo = false`;
    let params = [req.user.id];

    if (year) {
      queryReceitas += ` AND EXTRACT(YEAR FROM data_recebimento) = $2`;
      queryDespesas += ` AND EXTRACT(YEAR FROM data_vencimento) = $2`;
      params.push(parseInt(year));
    } else {
      queryReceitas += ` AND data_recebimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')`;
      queryDespesas += ` AND data_vencimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')`;
    }

    queryReceitas += ` GROUP BY ano, mes ORDER BY ano, mes`;
    queryDespesas += ` GROUP BY ano, mes ORDER BY ano, mes`;

    const receitas = await pool.query(queryReceitas, params);
    const despesas = await pool.query(queryDespesas, params);
    res.json({ receitas: receitas.rows, despesas: despesas.rows });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/saldo', authenticateToken, async (req, res) => {
  try {
    const receitas = await pool.query('SELECT SUM(valor) as total FROM public.receitas WHERE user_id = $1', [req.user.id]);
    const despesas = await pool.query('SELECT SUM(valor) as total FROM public.despesas WHERE user_id = $1 AND pago = true AND is_modelo = false', [req.user.id]);
    const totalRec = parseFloat(receitas.rows[0].total || 0);
    const totalDes = parseFloat(despesas.rows[0].total || 0);
    res.json({ saldoGlobal: totalRec - totalDes });
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// --- CUPONS ROUTES ---
app.get('/api/admin/cupons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.cupons ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/cupons', authenticateToken, isAdmin, async (req, res) => {
  const { codigo, desconto_percentual, max_usos } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.cupons (codigo, desconto_percentual, max_usos) VALUES ($1, $2, $3) RETURNING *',
      [codigo.toUpperCase(), desconto_percentual, max_usos ? parseInt(max_usos) : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Código de cupom já existe' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/cupons/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.cupons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Cupom removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- COMPRAS ROUTES ---
app.get('/api/admin/compras', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.compras ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/compras', authenticateToken, isAdmin, async (req, res) => {
  const { item, grupo, prioridade, valor } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.compras (item, grupo, prioridade, valor) VALUES ($1, $2, $3, $4) RETURNING *',
      [item, grupo || null, prioridade, valor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/compras/:id', authenticateToken, isAdmin, async (req, res) => {
  const { comprado, item, grupo, prioridade, valor } = req.body;
  try {
    // If only 'comprado' is provided (toggle action)
    if (item === undefined) {
      const result = await pool.query(
        'UPDATE public.compras SET comprado = $1 WHERE id = $2 RETURNING *',
        [comprado, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Compra não encontrada' });
      return res.json(result.rows[0]);
    }

    // Otherwise, full update
    const result = await pool.query(
      'UPDATE public.compras SET item = $1, grupo = $2, prioridade = $3, valor = $4 WHERE id = $5 RETURNING *',
      [item, grupo || null, prioridade, valor, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Compra não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/compras/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.compras WHERE id = $1', [req.params.id]);
    res.json({ message: 'Compra removida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/aplicar-cupom', authenticateToken, async (req, res) => {
  const { codigo } = req.body;
  try {
    const cupomRes = await pool.query('SELECT * FROM public.cupons WHERE codigo = $1', [codigo.toUpperCase()]);
    if (cupomRes.rows.length === 0) return res.status(404).json({ error: 'Cupom inválido ou não encontrado' });
    const cupom = cupomRes.rows[0];

    if (cupom.max_usos !== null && cupom.usos_atuais >= cupom.max_usos) {
      return res.status(400).json({ error: 'Cupom esgotado' });
    }

    const usadoRes = await pool.query('SELECT * FROM public.cupons_usados WHERE user_id = $1 AND cupom_id = $2', [req.user.id, cupom.id]);
    if (usadoRes.rows.length > 0) return res.status(400).json({ error: 'Você já utilizou este cupom' });

    if (parseFloat(cupom.desconto_percentual) === 100) {
      await pool.query('UPDATE public.cupons SET usos_atuais = usos_atuais + 1 WHERE id = $1', [cupom.id]);
      await pool.query('INSERT INTO public.cupons_usados (user_id, cupom_id) VALUES ($1, $2)', [req.user.id, cupom.id]);
      
      const emailRes = await pool.query('SELECT email FROM auth.users WHERE id = $1', [req.user.id]);
      const email = emailRes.rows[0].email;
      
      await pool.query(
        `INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) 
         VALUES ($1, $2, true, 'cupom_100', now() + interval '100 years') 
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'cupom_100', expires_at = now() + interval '100 years'`,
        [req.user.id, email]
      );
      return res.json({ message: 'Acesso liberado! Cupom aplicado com sucesso.', tipo: '100' });
    } else {
      return res.json({ message: 'Cupom validado! O desconto será aplicado no checkout.', tipo: 'parcial', desconto: cupom.desconto_percentual, codigo: cupom.codigo });
    }
  } catch (err) {
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message });
  }
});
