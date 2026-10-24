import webpush from 'web-push';
import pool from '../db.js';

// Chaves VAPID: gere uma vez com `node scripts/gerar-vapid.js` e cadastre no ambiente.
const PUBLICA = process.env.VAPID_PUBLIC_KEY;
const PRIVADA = process.env.VAPID_PRIVATE_KEY;
export const pushDisponivel = !!(PUBLICA && PRIVADA);

if (pushDisponivel) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:adm@lyonk.com.br', PUBLICA, PRIVADA);
} else {
  console.warn('[Push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes: notificações no aparelho desligadas.');
}

export const chavePublica = () => PUBLICA || null;

/** Envia para todos os aparelhos do usuário; remove inscrições vencidas. Retorna quantos receberam. */
export async function enviarPush(userId, { titulo, corpo, url = '/dashboard', tag }) {
  if (!pushDisponivel) return 0;
  const r = await pool.query('SELECT id, endpoint, p256dh, auth FROM public.push_inscricoes WHERE user_id = $1', [userId]);
  let enviados = 0;
  const payload = JSON.stringify({ titulo, corpo, url, tag });
  for (const s of r.rows) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM public.push_inscricoes WHERE id = $1', [s.id]);
      } else {
        console.error('[Push] Falha:', err.statusCode || err.message);
      }
    }
  }
  return enviados;
}

/** Marca um alerta como enviado; devolve false se já tinha sido (evita repetir no mesmo período). */
export async function marcarAlerta(userId, chave) {
  const r = await pool.query('INSERT INTO public.alertas_enviados (user_id, chave) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, chave]);
  return r.rowCount > 0;
}
