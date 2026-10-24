import pool from '../db.js';
import { carregarRegras, categoriaPorRegras, gravarImportacao } from './importacao.js';

// Integração Meu Pluggy: uso pessoal, liberado só para o e-mail em PLUGGY_OWNER_EMAIL.
// O plano gratuito do Meu Pluggy só permite contas do próprio titular (até 5 conexões).
const BASE = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';
const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const ITEM_IDS = (process.env.PLUGGY_ITEM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const DONO = (process.env.PLUGGY_OWNER_EMAIL || '').trim().toLowerCase();

export const pluggyConfigurado = () => !!(CLIENT_ID && CLIENT_SECRET && ITEM_IDS.length && DONO);
export const ehDonoPluggy = (email) => pluggyConfigurado() && String(email || '').toLowerCase() === DONO;
export const emailDonoPluggy = () => DONO;

let cache = { chave: null, expira: 0 };

async function chaveApi() {
  if (cache.chave && Date.now() < cache.expira) return cache.chave;
  const r = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Pluggy recusou as credenciais (${r.status}).`);
  const { apiKey } = await r.json();
  cache = { chave: apiKey, expira: Date.now() + 100 * 60 * 1000 }; // a chave vale 2 h
  return apiKey;
}

async function pluggy(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': await chaveApi(), ...(opcoes.headers || {}) },
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    const e = new Error(`Pluggy ${caminho.split('?')[0]}: ${r.status} ${corpo.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/** Contas e cartões disponíveis nas conexões do Meu Pluggy. */
export async function listarContasPluggy() {
  const contas = [];
  for (const itemId of ITEM_IDS) {
    const r = await pluggy(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    for (const a of r.results || []) {
      contas.push({
        id: a.id,
        itemId,
        nome: a.marketingName || a.name,
        tipo: a.type, // BANK | CREDIT
        numero: a.number,
        saldo: a.balance,
      });
    }
  }
  return contas;
}

async function transacoes(accountId, dataInicial) {
  const lista = [];
  let caminho = `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${dataInicial}`;
  for (let pagina = 0; pagina < 50 && caminho; pagina++) {
    const r = await pluggy(caminho);
    lista.push(...(r.results || []));
    caminho = r.next ? `/v2/transactions${r.next.startsWith('?') ? r.next : `?${r.next}`}` : null;
  }
  return lista;
}

const fmtSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const dataLocal = (iso) => fmtSP.format(new Date(iso));

// Categorias da Pluggy (em inglês) → categorias comuns do Lyonk
const CATEGORIAS = [
  [/grocer|supermarket/i, 'Mercado'],
  [/restaurant|food|eating|delivery|bakery/i, 'Alimentação'],
  [/transport|taxi|ride|gas station|fuel|parking|toll/i, 'Transporte'],
  [/rent|housing|utilit|electric|water|internet|telecom/i, 'Moradia'],
  [/health|pharmac|hospital|doctor|dental/i, 'Saúde'],
  [/education|school|course|book/i, 'Educação'],
  [/leisure|entertain|stream|travel|hotel|airline|culture|sport/i, 'Lazer'],
  [/salary|payroll|wage/i, 'Salário'],
];

function categoriaPluggy(cat) {
  if (!cat) return null;
  const achada = CATEGORIAS.find(([re]) => re.test(cat));
  return achada ? achada[1] : null;
}

/** Puxa as transações das contas vinculadas e grava no Lyonk sem duplicar. */
export async function sincronizarPluggy(userId) {
  const vinculos = (await pool.query(
    'SELECT * FROM public.pluggy_vinculos WHERE user_id = $1 AND (conta_id IS NOT NULL OR cartao_id IS NOT NULL)',
    [userId],
  )).rows;
  const estado = (await pool.query('SELECT ultima_sync FROM public.pluggy_estado WHERE user_id = $1', [userId])).rows[0];
  // Primeira vez: 90 dias. Depois: desde a última sincronização, com 10 dias de folga (lançamentos atrasados)
  const inicio = new Date(Date.now() - 90 * 86400000);
  if (estado?.ultima_sync) {
    const desde = new Date(new Date(estado.ultima_sync).getTime() - 10 * 86400000);
    if (desde > inicio) inicio.setTime(desde.getTime());
  }
  const dataInicial = dataLocal(inicio.toISOString());
  const regras = await carregarRegras(userId);

  let inseridos = 0;
  let ignorados = 0;
  try {
    const saldos = new Map((await listarContasPluggy()).map((c) => [c.id, c.saldo]));
    for (const v of vinculos) {
      const txs = await transacoes(v.pluggy_account_id, dataInicial);
      const itens = txs
        .filter((t) => (t.status || 'POSTED') === 'POSTED' && Number(t.amount))
        .map((t) => {
          const tipo = t.type === 'CREDIT' ? 'receita' : 'despesa';
          const meta = t.creditCardMetadata;
          const parcela = meta?.totalInstallments > 1 ? ` (${meta.installmentNumber}/${meta.totalInstallments})` : '';
          const descricao = `${t.description || t.descriptionRaw || 'Lançamento'}${parcela}`;
          return {
            import_id: `pluggy:${t.id}`,
            tipo,
            descricao,
            valor: Math.abs(Number(t.amount)),
            data: dataLocal(t.date),
            categoria: categoriaPorRegras(regras, descricao, tipo) || categoriaPluggy(t.category) || 'Outros',
          };
        });
      const destino = v.cartao_id ? { tipo: 'cartao', id: v.cartao_id } : { tipo: 'conta', id: v.conta_id };
      const r = await gravarImportacao(userId, destino, itens);
      inseridos += r.inseridos;
      ignorados += r.ignorados;
      if (saldos.has(v.pluggy_account_id)) {
        await pool.query('UPDATE public.pluggy_vinculos SET saldo = $1, atualizado_em = now() WHERE user_id = $2 AND pluggy_account_id = $3', [saldos.get(v.pluggy_account_id), userId, v.pluggy_account_id]);
      }
    }
    const resultado = `${inseridos} novo(s), ${ignorados} já existente(s)`;
    await pool.query(
      `INSERT INTO public.pluggy_estado (user_id, ultima_sync, ultimo_resultado, ultimo_erro) VALUES ($1, now(), $2, NULL)
       ON CONFLICT (user_id) DO UPDATE SET ultima_sync = now(), ultimo_resultado = $2, ultimo_erro = NULL`,
      [userId, resultado],
    );
    return { inseridos, ignorados, contas: vinculos.length };
  } catch (err) {
    await pool.query(
      `INSERT INTO public.pluggy_estado (user_id, ultimo_erro) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ultimo_erro = $2`,
      [userId, err.message.slice(0, 300)],
    );
    throw err;
  }
}

/** Pede à Pluggy para atualizar as conexões (o Meu Pluggy já atualiza sozinho a cada 24 h). */
export async function atualizarConexoes() {
  const resultados = [];
  for (const id of ITEM_IDS) {
    try {
      await pluggy(`/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: '{}' });
      resultados.push({ id, ok: true });
    } catch (err) {
      resultados.push({ id, ok: false, motivo: err.status === 409 ? 'Atualizada há menos de 24 h' : err.message });
    }
  }
  return resultados;
}
