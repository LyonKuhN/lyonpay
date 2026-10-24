import pool from './db.js';
import { chaveData, partes, ultimoDia, vencimentoFatura, ymd } from './lib/datas.js';

async function lancarModelo(client, userId, modelo, ano, mes, cartoes) {
  const existe = await client.query(
    `SELECT 1 FROM public.despesas
     WHERE user_id = $1 AND descricao = $2 AND is_modelo = false
       AND EXTRACT(MONTH FROM COALESCE(data_compra, data_vencimento)) = $3
       AND EXTRACT(YEAR FROM COALESCE(data_compra, data_vencimento)) = $4
     LIMIT 1`,
    [userId, modelo.descricao, mes, ano],
  );
  if (existe.rows.length) return false;

  let valor = modelo.valor;
  if (modelo.usa_media) {
    const media = await client.query(
      `SELECT AVG(COALESCE(valor_pago, valor)) AS media FROM public.despesas
       WHERE user_id = $1 AND descricao = $2 AND is_modelo = false
         AND data_vencimento >= date_trunc('month', make_date($3, $4, 1) - interval '6 months')
         AND data_vencimento < make_date($3, $4, 1)`,
      [userId, modelo.descricao, ano, mes],
    );
    if (media.rows[0]?.media != null) valor = Number(media.rows[0].media).toFixed(2);
  }

  const diaModelo = partes(chaveData(modelo.data_vencimento)).d;
  const data = ymd(ano, mes, Math.min(diaModelo, ultimoDia(ano, mes)));
  const cartao = modelo.cartao_id ? cartoes.get(modelo.cartao_id) : null;
  const vencimento = cartao ? vencimentoFatura(data, cartao.dia_fechamento, cartao.dia_vencimento) : data;

  await client.query(
    `INSERT INTO public.despesas (user_id, descricao, valor, data_vencimento, data_compra, tipo, observacoes, is_modelo, categoria, conta_id, cartao_id, escopo)
     VALUES ($1, $2, $3, $4, $5, 'fixa', $6, false, $7, $8, $9, $10)`,
    [userId, modelo.descricao, valor, vencimento, cartao ? data : null, modelo.observacoes, modelo.categoria, modelo.conta_id, modelo.cartao_id, modelo.escopo || 'pessoal'],
  );
  return true;
}

async function lancarRecorrente(client, userId, r, ano, mes) {
  const existe = await client.query(
    `SELECT 1 FROM public.receitas WHERE user_id = $1 AND recorrente_id = $2
       AND EXTRACT(MONTH FROM data_recebimento) = $3 AND EXTRACT(YEAR FROM data_recebimento) = $4 LIMIT 1`,
    [userId, r.id, mes, ano],
  );
  if (existe.rows.length) return false;
  await client.query(
    `INSERT INTO public.receitas (user_id, descricao, valor, data_recebimento, categoria, conta_id, escopo, pendente, recorrente_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
    [userId, r.descricao, r.valor, ymd(ano, mes, Math.min(r.dia, ultimoDia(ano, mes))), r.categoria, r.conta_id, r.escopo || 'pessoal', r.id],
  );
  return true;
}

async function mapaCartoes(client, userId) {
  const r = await client.query(`SELECT id, dia_fechamento, dia_vencimento FROM public.cartoes WHERE user_id = $1`, [userId]);
  return new Map(r.rows.map((c) => [c.id, c]));
}

/**
 * Gera as contas fixas (modelos de despesa) e as receitas recorrentes de um mês para um usuário.
 * - Só cria o que falta: um modelo vira conta se ainda não existir lançamento com a mesma descrição no mês.
 * - replace: antes, apaga as fixas pendentes do mês para recriá-las com os valores atuais (as pagas ficam).
 * - Registra o mês em geracoes_mensais, para a geração automática não repetir o que a pessoa apagou.
 */
export async function gerarMes(userId, ano, mes, { replace = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (replace) {
      await client.query(
        `DELETE FROM public.despesas
         WHERE user_id = $1 AND is_modelo = false AND tipo = 'fixa' AND pago = false
           AND EXTRACT(MONTH FROM COALESCE(data_compra, data_vencimento)) = $2
           AND EXTRACT(YEAR FROM COALESCE(data_compra, data_vencimento)) = $3`,
        [userId, mes, ano],
      );
    }
    const cartoes = await mapaCartoes(client, userId);
    let despesas = 0;
    for (const modelo of (await client.query(`SELECT * FROM public.despesas WHERE user_id = $1 AND is_modelo = true`, [userId])).rows) {
      if (await lancarModelo(client, userId, modelo, ano, mes, cartoes)) despesas++;
    }
    let receitas = 0;
    for (const r of (await client.query(`SELECT * FROM public.receitas_recorrentes WHERE user_id = $1 AND ativo = true`, [userId])).rows) {
      if (await lancarRecorrente(client, userId, r, ano, mes)) receitas++;
    }
    await client.query(`INSERT INTO public.geracoes_mensais (user_id, ano, mes) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [userId, ano, mes]);
    await client.query('COMMIT');
    return { despesas, receitas };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Lança um único modelo fixo num mês (ao criar o modelo, para já aparecer no mês atual). */
export async function lancarModeloNoMes(userId, modeloId, ano, mes) {
  const client = await pool.connect();
  try {
    const m = await client.query('SELECT * FROM public.despesas WHERE id = $1 AND user_id = $2 AND is_modelo = true', [modeloId, userId]);
    if (!m.rows.length) return false;
    return await lancarModelo(client, userId, m.rows[0], ano, mes, await mapaCartoes(client, userId));
  } finally {
    client.release();
  }
}

/** Lança uma única receita recorrente num mês. */
export async function lancarRecorrenteNoMes(userId, recorrenteId, ano, mes) {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM public.receitas_recorrentes WHERE id = $1 AND user_id = $2', [recorrenteId, userId]);
    if (!r.rows.length) return false;
    return await lancarRecorrente(client, userId, r.rows[0], ano, mes);
  } finally {
    client.release();
  }
}

/** Geração automática do mês corrente para quem ligou a opção e ainda não teve o mês gerado. */
export async function gerarMesAutomatico(ano, mes) {
  const pendentes = await pool.query(
    `SELECT p.user_id FROM public.profiles p
     WHERE COALESCE(p.gerar_fixas_auto, true) = true
       AND (EXISTS (SELECT 1 FROM public.despesas d WHERE d.user_id = p.user_id AND d.is_modelo = true)
            OR EXISTS (SELECT 1 FROM public.receitas_recorrentes r WHERE r.user_id = p.user_id AND r.ativo = true))
       AND NOT EXISTS (SELECT 1 FROM public.geracoes_mensais g WHERE g.user_id = p.user_id AND g.ano = $1 AND g.mes = $2)`,
    [ano, mes],
  );
  let total = 0;
  for (const { user_id } of pendentes.rows) {
    try {
      const r = await gerarMes(user_id, ano, mes);
      total += r.despesas + r.receitas;
    } catch (err) {
      console.error(`[Geração] Falha para ${user_id}:`, err.message);
    }
  }
  if (pendentes.rows.length) console.log(`[Geração] ${ano}-${mes}: ${pendentes.rows.length} usuário(s), ${total} lançamento(s).`);
}
