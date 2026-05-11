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
import Stripe from 'stripe';
import { Resend } from 'resend';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pool from './db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const resend = new Resend(process.env.RESEND_API_KEY || '');

const app = express();

// Necessário para o Coolify/Docker (Proxy Reverso) identificar o IP real do usuário
app.set('trust proxy', 1);

app.use(cors({
  origin: '*', 
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

app.use('/api/', limiter); 
app.use(express.json());

app.use((req, res, next) => {
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
      <p style="font-size: 16px; color: #a1a1aa;">Para começar a usar o Lyonpay, precisamos que você confirme seu e-mail.</p>
      <div style="text-align: center;">
        <a href="${verifyUrl}" style="display: inline-block; background-color: #a3ff12; color: black; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; margin: 20px 0;">Confirmar E-mail</a>
      </div>
      <p style="font-size: 14px; color: #71717a;">Ou copie o link: ${verifyUrl}</p>
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 30px 0;" />
      <p style="font-weight: bold; color: #FFD700;">Lyonpay - Controle seu futuro.</p>
    </div>
  `;

  console.log(`[Resend] Tentando enviar e-mail para: ${email}`);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Lyonpay <onboarding@resend.dev>',
      to: email,
      subject: "Confirme seu e-mail no Lyonpay! 🛡️",
      html: htmlContent,
    });
    
    if (error) {
      console.error("!!! ERRO NO RESEND:", error);
      // Se o erro for de domínio não verificado, logamos um aviso específico
      if (error.message?.includes('domain') || error.name === 'validation_error') {
        console.warn("DICA: Verifique se o domínio 'lyonpay.com' está verificado no painel do Resend.");
      }
    } else {
      console.log("[Resend] E-mail enviado com sucesso! ID:", data.id);
    }
  } catch (err) {
    console.error("!!! FALHA CRÍTICA AO CHAMAR API DO RESEND:", err.message);
  }
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
app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/verify', async (req, res) => {
  const { token } = req.body;
  try {
    const result = await pool.query('UPDATE auth.users SET confirmed = true, confirmation_token = null WHERE confirmation_token = $1 RETURNING id, email, role', [token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Token inválido' });
    const user = result.rows[0];
    const profile = await pool.query('SELECT display_name FROM public.profiles WHERE user_id = $1', [user.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';
    const jwtToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name, role: user.role, subscribed: sub.rows[0]?.subscribed || false, expires_at: sub.rows[0]?.expires_at } });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
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


app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];
    if (!user.confirmed) return res.status(401).json({ error: 'Confirme seu e-mail primeiro.' });
    const validPassword = await bcrypt.compare(password, user.encrypted_password);
    if (!validPassword) return res.status(400).json({ error: 'Senha incorreta' });
    const profile = await pool.query('SELECT display_name FROM public.profiles WHERE user_id = $1', [user.id]);
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [user.id]);
    const name = profile.rows[0]?.display_name || 'Usuário';
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name, role: user.role, subscribed: sub.rows[0]?.subscribed || false, expires_at: sub.rows[0]?.expires_at } });
  } catch (err) { 
    console.error(`ERRO em ${req.method} ${req.url}:`, err);
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/auth/me', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('UPDATE public.profiles SET display_name = $1 WHERE user_id = $2', [name, req.user.id]);
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

// --- DESPESAS ROUTES ---
app.get('/api/despesas', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  let query = 'SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = false';
  const params = [req.user.id];

  if (month && year) {
    query += ' AND EXTRACT(MONTH FROM data_vencimento) = $2 AND EXTRACT(YEAR FROM data_vencimento) = $3';
    params.push(parseInt(month), parseInt(year));
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
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria } = req.body;
  const groupId = crypto.randomUUID(); 
  const v_cat = categoria || 'Outros';

  try {
    const v_valor = valor === '' ? null : parseFloat(valor);
    const v_total = valor_total === '' ? null : parseFloat(valor_total);
    const v_parcelas = (numero_parcelas === '' || !numero_parcelas) ? null : parseInt(numero_parcelas);

    if (tipo === 'parcelada' && v_parcelas > 1) {
      const generated = [];
      // Parsear a data manualmente para evitar problemas de fuso horário (YYYY-MM-DD)
      const [year, month, day] = data_vencimento.split('-').map(Number);
      
      for (let i = 0; i < v_parcelas; i++) {
        // Criar a data baseada nos componentes e adicionar os meses
        const date = new Date(year, (month - 1) + i, day);
        
        // Ajustar para o formato YYYY-MM-DD para salvar no banco corretamente como DATE
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const currentVencimento = `${y}-${m}-${d}`;

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
        `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, is_modelo, categoria) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.user.id, descricao, v_valor, data_vencimento, tipo, v_parcelas, v_total, observacoes, is_modelo, v_cat]
      );
      res.json(result.rows[0]);
    }
  } catch (err) { 
    console.error("Erro ao salvar despesa:", err);
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
  const { month, year } = req.body;
  try {
    const modelos = await pool.query(`SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = true`, [req.user.id]);
    let createdCount = 0;
    for (const modelo of modelos.rows) {
      const exists = await pool.query(`SELECT id FROM public.despesas WHERE user_id = $1 AND descricao = $2 AND EXTRACT(MONTH FROM data_vencimento) = $3 AND EXTRACT(YEAR FROM data_vencimento) = $4 AND is_modelo = false`, [req.user.id, modelo.descricao, parseInt(month), parseInt(year)]);
      if (exists.rows.length === 0) {
        const novaData = new Date(year, month - 1, new Date(modelo.data_vencimento).getDate());
        await pool.query(`INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, tipo, observacoes, is_modelo, categoria) VALUES ($1, $2, $3, $4, $5, $6, false, $7)`, [req.user.id, modelo.descricao, modelo.valor, novaData, 'fixa', modelo.observacoes, modelo.categoria]);
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
    const config = await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'");
    const fee = parseFloat(config.rows[0]?.value || '17.90');

    const frontendUrl = process.env.SERVICE_FQDN_LYONPAY_WEB 
      ? `https://${process.env.SERVICE_FQDN_LYONPAY_WEB}` 
      : 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Lyonpay Pro', description: 'Acesso total ao sistema de gestão financeira' },
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
    });
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
      AND l.data_lembrete <= NOW() + INTERVAL '5 minutes'
    `);

    for (const rem of result.rows) {
      console.log(`[Worker] Enviando lembrete: "${rem.titulo}" para ${rem.user_email}`);
      
      const htmlContent = `
        <div style="font-family: sans-serif; background-color: #09090B; color: white; padding: 40px; border-radius: 20px; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="background-color: #FFD700; color: black; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase;">Lembrete Lyonpay</span>
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
          <p style="font-weight: bold; color: #FFD700; text-align: center;">Lyonpay - Controle seu futuro.</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Lyonpay <alertas@resend.dev>',
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

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Servidor Lyonpay rodando na porta ${PORT}`));
