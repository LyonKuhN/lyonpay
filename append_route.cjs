const fs = require('fs');

const route = `
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
`;

fs.appendFileSync('server/index.js', route);
console.log('Route appended');
