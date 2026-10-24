import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Evita timeouts de 30-40 s no Docker/Coolify ao conectar no banco externo (força IPv4)
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { garantirEsquema } from './schema.js';
import { initCronJobs } from './cron.js';
import authRoutes from './routes/auth.js';
import financasRoutes from './routes/financas.js';
import carteiraRoutes from './routes/carteira.js';
import planejamentoRoutes from './routes/planejamento.js';
import anexosRoutes from './routes/anexos.js';
import stripeRoutes from './routes/stripe.js';
import adminRoutes from './routes/admin.js';
import compartilhamentoRoutes from './routes/compartilhamento.js';
import pushRoutes from './routes/push.js';
import pluggyRoutes from './routes/pluggy.js';
import { pluggyConfigurado } from './lib/pluggy.js';
import { pushDisponivel } from './lib/push.js';

console.log('--- [SISTEMA] Verificação de variáveis ---');
console.log('Ambiente:', process.env.SERVICE_FQDN_LYONPAY_WEB ? `produção (${process.env.SERVICE_FQDN_LYONPAY_WEB})` : 'desenvolvimento');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'ok' : 'AUSENTE');
console.log('Resend:', process.env.RESEND_API_KEY ? 'ok' : 'ausente');
console.log('Stripe webhook:', process.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'ausente');
console.log('TLS do banco:', process.env.DATABASE_SSL === 'true' ? 'ligado' : 'desligado');
console.log('Push (VAPID):', pushDisponivel ? 'ok' : 'desligado');
console.log('Meu Pluggy:', pluggyConfigurado() ? 'configurado' : 'desligado');
console.log('------------------------------------------');

process.on('uncaughtException', (err) => console.error('!!! ERRO CRÍTICO (Uncaught):', err));
process.on('unhandledRejection', (reason) => console.error('!!! REJEIÇÃO NÃO TRATADA:', reason));

const app = express();

// Atrás do Traefik (e do nginx do front): confia só em proxies da rede interna, para o
// limite de requisições enxergar o IP real de cada pessoa.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

const fqdn = process.env.SERVICE_FQDN_LYONPAY_WEB;
const allowedOrigins = fqdn ? [`https://${fqdn}`, `http://${fqdn}`] : [];
// Em desenvolvimento: qualquer porta do localhost e IPs da rede local (Vite em 5174+, teste no celular)
const devOrigin = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const origemPermitida = (origin) => allowedOrigins.includes(origin) || (!fqdn && devOrigin.test(origin));

app.use(cors({
  origin(origin, cb) {
    if (!origin || origemPermitida(origin)) cb(null, true);
    else cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Lyonk-Espaco'],
}));

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));

// Proteção contra CSRF: escritas só são aceitas a partir do próprio site
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !origemPermitida(origin)) return res.status(403).json({ error: 'Origem não permitida.' });
  next();
});

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: { error: 'Muitas requisições vindas deste IP, tente novamente mais tarde.' },
}));

// JSON global (o webhook da Stripe precisa do corpo cru e os anexos têm limite próprio)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  if (req.method === 'POST' && req.originalUrl === '/api/anexos') return next();
  return express.json({ limit: '2mb' })(req, res, next);
});

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api', financasRoutes);
app.use('/api', carteiraRoutes);
app.use('/api', planejamentoRoutes);
app.use('/api', anexosRoutes);
app.use('/api', adminRoutes);
app.use('/api', compartilhamentoRoutes);
app.use('/api', pushRoutes);
app.use('/api', pluggyRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('ERRO não tratado:', err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Envio grande demais.' });
  res.status(500).json({ error: 'Erro interno.' });
});

const PORT = process.env.PORT || 3005;

garantirEsquema()
  .catch((err) => console.error('!!! Falha ao preparar o banco (o servidor sobe mesmo assim):', err.message))
  .finally(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));
    initCronJobs();
  });
