import express, { Router } from 'express';
import Stripe from 'stripe';
import pool from '../db.js';
import { authenticateToken, frontendUrl } from '../lib/sessao.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_desativado');

const erro = (res, err, msg = 'Não foi possível falar com a Stripe agora.') => {
  console.error('ERRO (Stripe):', err.message);
  res.status(500).json({ error: msg });
};

/** Cliente da Stripe do usuário: o guardado no banco ou, se faltar, o encontrado pelo e-mail. */
async function clienteStripe(userId, email) {
  const s = await pool.query('SELECT stripe_customer_id FROM public.subscribers WHERE user_id = $1', [userId]);
  if (s.rows[0]?.stripe_customer_id) return s.rows[0].stripe_customer_id;
  const lista = await stripe.customers.list({ email, limit: 1 });
  const id = lista.data[0]?.id;
  if (id) await pool.query('UPDATE public.subscribers SET stripe_customer_id = $1 WHERE user_id = $2', [id, userId]);
  return id || null;
}

router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { cupom_codigo } = req.body || {};
    let coupon;
    if (cupom_codigo) {
      const c = (await pool.query('SELECT desconto_percentual FROM public.cupons WHERE codigo = $1', [cupom_codigo])).rows[0];
      const pct = c ? parseFloat(c.desconto_percentual) : 0;
      if (pct > 0 && pct < 100) {
        coupon = (await stripe.coupons.create({ percent_off: pct, duration: 'forever', name: cupom_codigo })).id;
      }
    }
    const fee = parseFloat((await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'")).rows[0]?.value || '17.90');
    const customer = await clienteStripe(req.user.id, req.user.email);
    const sessao = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Lyonk Pro', description: 'Acesso total ao sistema de gestão financeira' },
          unit_amount: Math.round(fee * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${frontendUrl()}/config?success=true`,
      cancel_url: `${frontendUrl()}/config?canceled=true`,
      ...(customer ? { customer } : { customer_email: req.user.email }),
      metadata: { user_id: req.user.id },
      subscription_data: { metadata: { user_id: req.user.id } },
      ...(coupon ? { discounts: [{ coupon }] } : {}),
    });
    res.json({ url: sessao.url });
  } catch (err) { erro(res, err); }
});

/** Portal do cliente da Stripe: cancelar, trocar cartão e ver faturas. */
router.post('/portal', authenticateToken, async (req, res) => {
  try {
    const customer = await clienteStripe(req.user.id, req.user.email);
    if (!customer) return res.status(404).json({ error: 'Não encontramos uma assinatura paga nesta conta.' });
    const sessao = await stripe.billingPortal.sessions.create({ customer, return_url: `${frontendUrl()}/config` });
    res.json({ url: sessao.url });
  } catch (err) {
    erro(res, err, 'Não foi possível abrir o portal de assinatura. Confira se o portal do cliente está ativo no painel da Stripe.');
  }
});

// Webhook: corpo cru para validar a assinatura
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    const obj = event.data.object;
    if (event.type === 'checkout.session.completed') {
      const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO public.subscribers (user_id, email, stripe_customer_id, subscribed, subscription_tier, expires_at, cancela_no_fim)
         VALUES ($1, $2, $3, true, 'pro', $4, false)
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'pro', expires_at = GREATEST(public.subscribers.expires_at, $4),
           stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.subscribers.stripe_customer_id), cancela_no_fim = false`,
        [obj.metadata?.user_id || null, obj.customer_email || obj.customer_details?.email, obj.customer, expira],
      );
    }
    // Renovação mensal: estende até o fim do período pago
    if (event.type === 'invoice.paid') {
      const fim = obj.lines?.data?.[0]?.period?.end;
      if (fim) {
        await pool.query(
          `UPDATE public.subscribers SET subscribed = true, subscription_tier = 'pro', expires_at = to_timestamp($3)
           WHERE stripe_customer_id = $1 OR email = $2`,
          [obj.customer, obj.customer_email, fim],
        );
      }
    }
    // Cancelamento agendado/desfeito pelo portal
    if (event.type === 'customer.subscription.updated') {
      await pool.query(
        `UPDATE public.subscribers SET cancela_no_fim = $2, expires_at = COALESCE(to_timestamp($3), expires_at) WHERE stripe_customer_id = $1`,
        [obj.customer, !!obj.cancel_at_period_end, obj.current_period_end || obj.items?.data?.[0]?.current_period_end || null],
      );
    }
    // Assinatura encerrada: o acesso vale até o fim do período já pago
    if (event.type === 'customer.subscription.deleted') {
      await pool.query(`UPDATE public.subscribers SET subscribed = false, cancela_no_fim = false WHERE stripe_customer_id = $1`, [obj.customer]);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('ERRO no webhook da Stripe:', err);
    res.status(500).json({ error: 'Falha ao processar o evento' });
  }
});

// Conferência ao voltar do checkout (caso o webhook ainda não tenha chegado)
router.get('/verify-session', authenticateToken, async (req, res) => {
  try {
    const sub = await pool.query('SELECT subscribed, expires_at FROM public.subscribers WHERE user_id = $1', [req.user.id]);
    if (sub.rows[0]?.subscribed) return res.json({ subscribed: true, expires_at: sub.rows[0].expires_at });
    const sessions = await stripe.checkout.sessions.list({ limit: 1, customer_details: { email: req.user.email } });
    const ultima = sessions.data[0];
    // Só vale uma sessão paga criada nas últimas 2 horas (o retorno do checkout que acabou de acontecer)
    if (ultima && ultima.payment_status === 'paid' && Date.now() / 1000 - ultima.created < 2 * 60 * 60) {
      const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at, stripe_customer_id)
         VALUES ($1, $2, true, 'pro', $3, $4)
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'pro', expires_at = $3,
           stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.subscribers.stripe_customer_id)`,
        [req.user.id, req.user.email, expira, ultima.customer],
      );
      return res.json({ subscribed: true, expires_at: expira });
    }
    res.json({ subscribed: false });
  } catch (err) { erro(res, err); }
});

export default router;
