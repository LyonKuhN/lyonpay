const fs = require('fs');
const content = `
app.put('/api/despesas/:id', authenticateToken, async (req, res) => {
  const { descricao, valor, data_vencimento, tipo, numero_parcelas, valor_total, observacoes, categoria, usa_media } = req.body;
  try {
    const usaMediaVal = usa_media === true;
    const v_valor = valor === '' ? null : parseFloat(valor);
    const v_total = valor_total === '' ? null : parseFloat(valor_total);
    const v_parcelas = (numero_parcelas === '' || !numero_parcelas) ? null : parseInt(numero_parcelas);

    const result = await pool.query(
      \`UPDATE public.despesas 
       SET descricao = $1, valor = $2, data_vencimento = $3, tipo = $4, numero_parcelas = $5, 
           valor_total = $6, observacoes = $7, categoria = $8, usa_media = $9
       WHERE id = $10 AND user_id = $11 RETURNING *\`,
      [descricao, v_valor, data_vencimento, tipo, v_parcelas, v_total, observacoes, categoria || 'Outros', usaMediaVal, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { 
    console.error(\`ERRO em \${req.method} \${req.url}:\`, err);
    res.status(500).json({ error: err.message }); 
  }
});
`;
fs.appendFileSync('server/index.js', content);
console.log('PUT route appended.');
