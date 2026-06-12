const fs = require('fs');
let content = fs.readFileSync('server/index.js', 'utf8');

// 1. Rename Lyonpay -> Lyonk
content = content.replace(/Lyonpay/g, 'Lyonk');

// 2. Add Cache-Control to the logger middleware
content = content.replace(
`app.use((req, res, next) => {
  console.log(\`[\${new Date().toLocaleTimeString()}] \${req.method} \${req.url}\`);
  next();
});`,
`app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  console.log(\`[\${new Date().toLocaleTimeString()}] \${req.method} \${req.url}\`);
  next();
});`
);

// 3. Add Dashboard, Cupons, and Admin routes
const routes = `
// --- DASHBOARD ROUTES ---
app.get('/api/dashboard/evolucao', authenticateToken, async (req, res) => {
  try {
    const receitas = await pool.query(\`SELECT EXTRACT(MONTH FROM data_recebimento) as mes, EXTRACT(YEAR FROM data_recebimento) as ano, SUM(valor) as total FROM public.receitas WHERE user_id = $1 AND data_recebimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months') GROUP BY ano, mes ORDER BY ano, mes\`, [req.user.id]);
    const despesas = await pool.query(\`SELECT EXTRACT(MONTH FROM data_vencimento) as mes, EXTRACT(YEAR FROM data_vencimento) as ano, SUM(valor) as total FROM public.despesas WHERE user_id = $1 AND is_modelo = false AND data_vencimento >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months') GROUP BY ano, mes ORDER BY ano, mes\`, [req.user.id]);
    res.json({ receitas: receitas.rows, despesas: despesas.rows });
  } catch (err) {
    console.error(\`ERRO em \${req.method} \${req.url}:\`, err);
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
        \`INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, expires_at) 
         VALUES ($1, $2, true, 'cupom_100', now() + interval '100 years') 
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'cupom_100', expires_at = now() + interval '100 years'\`,
        [req.user.id, email]
      );
      return res.json({ message: 'Acesso liberado! Cupom aplicado com sucesso.', tipo: '100' });
    } else {
      return res.json({ message: 'Cupom validado! O desconto será aplicado no checkout.', tipo: 'parcial', desconto: cupom.desconto_percentual, codigo: cupom.codigo });
    }
  } catch (err) {
    console.error(\`ERRO em \${req.method} \${req.url}:\`, err);
    res.status(500).json({ error: err.message });
  }
});
`;

if (!content.includes('/api/dashboard/evolucao')) {
  content += "\n" + routes;
}

// 4. Replace Stripe Create Checkout
const stripeBlock = `
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
      ? \`https://\${process.env.SERVICE_FQDN_LYONPAY_WEB}\` 
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
      success_url: \`\${frontendUrl}/config?success=true\`,
      cancel_url: \`\${frontendUrl}/config?canceled=true\`,
      customer_email: req.user.email,
      metadata: { user_id: req.user.id }
    };

    if (stripeCouponId) {
      sessionConfig.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ url: session.url });
  } catch (err) { 
    console.error(\`ERRO em \${req.method} \${req.url}:\`, err);
    res.status(500).json({ error: err.message }); 
  }
});
`;

content = content.replace(
  /\/\/ --- STRIPE & SUBSCRIPTIONS ---\s*app\.post\('\/api\/stripe\/create-checkout'[\s\S]*?res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*\}\s*\}\);/,
  stripeBlock.trim()
);

fs.writeFileSync('server/index.js', content);
console.log('index.js successfully patched again');
