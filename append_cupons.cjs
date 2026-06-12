const fs = require('fs');

const routes = `
// --- CUPONS ROUTES ---
app.get('/api/admin/cupons', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const result = await pool.query('SELECT * FROM public.cupons ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/cupons', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
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

app.delete('/api/admin/cupons/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
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
        \`INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, subscription_end) 
         VALUES ($1, $2, true, 'cupom_100', now() + interval '1 year') 
         ON CONFLICT (email) DO UPDATE SET subscribed = true, subscription_tier = 'cupom_100', subscription_end = now() + interval '1 year'\`,
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

fs.appendFileSync('server/index.js', routes);
console.log('Rotas de cupons adicionadas.');
