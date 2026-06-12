const fs = require('fs');
const content = fs.readFileSync('server/index.js', 'utf8');

const stripeBlock = `
// --- STRIPE & SUBSCRIPTIONS ---
app.post('/api/stripe/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { cupom_codigo } = req.body || {};
    let stripeCouponId = undefined;
    let localCupomId = undefined;

    const config = await pool.query("SELECT value FROM public.config WHERE key = 'monthly_fee'");
    const fee = parseFloat(config.rows[0]?.value || '17.90');

    if (cupom_codigo) {
      const cupomRes = await pool.query('SELECT * FROM public.cupons WHERE codigo = $1', [cupom_codigo.toUpperCase()]);
      if (cupomRes.rows.length > 0) {
        const cupom = cupomRes.rows[0];
        if ((cupom.max_usos === null || cupom.usos_atuais < cupom.max_usos)) {
          const usadoRes = await pool.query('SELECT * FROM public.cupons_usados WHERE user_id = $1 AND cupom_id = $2', [req.user.id, cupom.id]);
          if (usadoRes.rows.length === 0) {
            localCupomId = cupom.id;
            const stripeCoupon = await stripe.coupons.create({
              percent_off: parseFloat(cupom.desconto_percentual),
              duration: 'forever',
              name: \`Cupom \${cupom.codigo}\`
            });
            stripeCouponId = stripeCoupon.id;
          }
        }
      }
    }

    const frontendUrl = process.env.SERVICE_FQDN_LYONPAY_WEB 
      ? \`https://\${process.env.SERVICE_FQDN_LYONPAY_WEB}\` 
      : 'http://localhost:5173';

    const sessionData = {
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
      success_url: \`\${frontendUrl}/config?success=true\`,
      cancel_url: \`\${frontendUrl}/config?canceled=true\`,
      customer_email: req.user.email,
      metadata: { user_id: req.user.id }
    };

    if (stripeCouponId) {
      sessionData.discounts = [{ coupon: stripeCouponId }];
      sessionData.metadata.local_cupom_id = localCupomId; // Pass back to webhook to register usage
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    res.json({ url: session.url });
  } catch (err) { 
    console.error(\`ERRO em \${req.method} \${req.url}:\`, err);
    res.status(500).json({ error: err.message }); 
  }
});

// Webhook Stripe
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(\`Webhook Error: \${err.message}\`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata.user_id;
    const local_cupom_id = session.metadata.local_cupom_id;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await pool.query(
      \`INSERT INTO public.subscribers (user_id, email, stripe_customer_id, subscribed, subscription_tier, expires_at) 
       VALUES ($1, $2, $3, true, 'pro', $4) 
       ON CONFLICT (email) DO UPDATE SET 
       user_id = EXCLUDED.user_id,
       stripe_customer_id = EXCLUDED.stripe_customer_id, 
       subscribed = true, 
       subscription_tier = 'pro',
       expires_at = $4\`,
      [user_id, session.customer_email, session.customer, expiresAt]
    );
    
    if (local_cupom_id) {
      await pool.query('UPDATE public.cupons SET usos_atuais = usos_atuais + 1 WHERE id = $1', [local_cupom_id]);
      await pool.query('INSERT INTO public.cupons_usados (user_id, cupom_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user_id, local_cupom_id]);
    }
  }
  res.json({ received: true });
});
`;

const lines = content.split('\\n');
const insertIndex = lines.findIndex(line => line.includes('app.get(\\'/api/stripe/verify-session\\''));

if (insertIndex !== -1) {
  lines.splice(insertIndex, 0, stripeBlock);
  fs.writeFileSync('server/index.js', lines.join('\\n'));
  console.log('Stripe block reinserted successfully');
} else {
  console.log('Verify session route not found');
}
