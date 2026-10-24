import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// TLS do banco, configurável sem mexer no código:
//   DATABASE_SSL=true                      → conexão criptografada
//   DATABASE_SSL_CA=/caminho/ca.crt        → valida o certificado do servidor (recomendado)
//   DATABASE_SSL_REJECT_UNAUTHORIZED=false → aceita certificado autoassinado sem CA
// Sem DATABASE_SSL, vale o `sslmode` da própria DATABASE_URL (o comportamento antigo era sem TLS).
function sslConfig() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  const ssl = { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
  if (process.env.DATABASE_SSL_CA) ssl.ca = fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8');
  return ssl;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

// Sem este ouvinte, uma conexão ociosa derrubada pelo banco encerra o processo do Node.
pool.on('error', (err) => {
  console.error('[DB] Erro em conexão ociosa do pool:', err.message);
});

export default pool;
