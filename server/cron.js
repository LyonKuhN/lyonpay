import cron from 'node-cron';
import pool from './db.js';
import { emailContasDoDia, emailLembrete, enviarEmail } from './lib/email.js';
import { enviarPush, marcarAlerta } from './lib/push.js';
import { hojeSP, somarDias } from './lib/datas.js';
import { gerarMesAutomatico } from './geracao.js';
import { emailDonoPluggy, pluggyConfigurado, sincronizarPluggy } from './lib/pluggy.js';

const TZ = { timezone: 'America/Sao_Paulo' };
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** E-mail das contas que vencem hoje (para quem ligou o aviso diário). */
async function emailVencimentosDoDia() {
  const hoje = hojeSP();
  const { rows } = await pool.query(
    `SELECT d.descricao, d.valor, u.email, p.display_name
     FROM public.despesas d JOIN auth.users u ON d.user_id = u.id JOIN public.profiles p ON p.user_id = u.id
     WHERE d.data_vencimento = $1 AND d.pago = false AND d.is_modelo = false AND p.notificacoes_diarias = true`,
    [hoje],
  );
  const porEmail = new Map();
  for (const r of rows) {
    if (!porEmail.has(r.email)) porEmail.set(r.email, { nome: r.display_name || 'tudo bem', contas: [] });
    porEmail.get(r.email).contas.push(r);
  }
  for (const [email, u] of porEmail) {
    const total = u.contas.reduce((a, c) => a + Number(c.valor), 0);
    await enviarEmail(email, 'Contas que vencem hoje - Lyonk', emailContasDoDia(u.nome, u.contas.map((c) => ({ descricao: c.descricao, valorFmt: brl(c.valor) })), brl(total)));
  }
  if (porEmail.size) console.log(`[CRON] Aviso diário por e-mail: ${porEmail.size} usuário(s).`);
}

/** Notificação no aparelho: vence hoje, vence amanhã e atrasadas. */
async function pushVencimentos() {
  const hoje = hojeSP();
  const chaveAmanha = somarDias(hoje, 1);
  const { rows } = await pool.query(
    `SELECT d.user_id,
       COUNT(*) FILTER (WHERE d.data_vencimento = $1) AS hoje_n, COALESCE(SUM(d.valor) FILTER (WHERE d.data_vencimento = $1), 0) AS hoje_v,
       COUNT(*) FILTER (WHERE d.data_vencimento = $2) AS amanha_n, COALESCE(SUM(d.valor) FILTER (WHERE d.data_vencimento = $2), 0) AS amanha_v,
       COUNT(*) FILTER (WHERE d.data_vencimento < $1) AS atrasadas_n
     FROM public.despesas d
     WHERE d.pago = false AND d.is_modelo = false AND d.data_vencimento <= $2
       AND EXISTS (SELECT 1 FROM public.push_inscricoes s WHERE s.user_id = d.user_id)
     GROUP BY d.user_id`,
    [hoje, chaveAmanha],
  );
  for (const r of rows) {
    const partes = [];
    if (Number(r.hoje_n)) partes.push(`${r.hoje_n} vence${Number(r.hoje_n) > 1 ? 'm' : ''} hoje (${brl(r.hoje_v)})`);
    if (Number(r.amanha_n)) partes.push(`${r.amanha_n} amanhã (${brl(r.amanha_v)})`);
    if (Number(r.atrasadas_n)) partes.push(`${r.atrasadas_n} atrasada${Number(r.atrasadas_n) > 1 ? 's' : ''}`);
    if (!partes.length) continue;
    await enviarPush(r.user_id, { titulo: 'Contas a pagar', corpo: partes.join(' · '), url: '/pagamentos', tag: `venc-${hoje}` });
  }
}

/** Alerta de orçamento: avisa uma vez por mês ao passar de 80% e de 100% em cada categoria. */
async function alertasOrcamento() {
  const hoje = hojeSP();
  const [ano, mes] = hoje.split('-').map(Number);
  const { rows } = await pool.query(
    `SELECT o.user_id, o.categoria, o.valor AS limite, COALESCE(SUM(d.valor), 0) AS gasto
     FROM public.orcamentos o
     LEFT JOIN public.despesas d ON d.user_id = o.user_id AND d.categoria = o.categoria AND d.is_modelo = false
       AND EXTRACT(MONTH FROM d.data_vencimento) = $1 AND EXTRACT(YEAR FROM d.data_vencimento) = $2
     WHERE EXISTS (SELECT 1 FROM public.push_inscricoes s WHERE s.user_id = o.user_id)
     GROUP BY o.user_id, o.categoria, o.valor`,
    [mes, ano],
  );
  for (const r of rows) {
    const pct = Number(r.gasto) / Number(r.limite);
    const faixa = pct >= 1 ? 100 : pct >= 0.8 ? 80 : 0;
    if (!faixa) continue;
    if (!(await marcarAlerta(r.user_id, `orc:${ano}-${mes}:${r.categoria}:${faixa}`))) continue;
    await enviarPush(r.user_id, {
      titulo: faixa === 100 ? `Orçamento estourado: ${r.categoria}` : `${r.categoria}: 80% do orçamento`,
      corpo: `${brl(r.gasto)} de ${brl(r.limite)} neste mês.`,
      url: '/orcamentos',
      tag: `orc-${r.categoria}`,
    });
  }
}

/** Lembretes no horário: e-mail e notificação no aparelho. */
export async function verificarLembretes() {
  try {
    const { rows } = await pool.query(`
      SELECT l.*, u.email AS user_email, p.display_name
      FROM public.lembretes l JOIN auth.users u ON l.user_id = u.id LEFT JOIN public.profiles p ON u.id = p.user_id
      WHERE l.concluido = false AND l.notificado = false AND l.data_lembrete <= NOW() + INTERVAL '1 minute'`);
    for (const rem of rows) {
      const quando = new Date(rem.data_lembrete).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      await enviarEmail(rem.user_email, `Lembrete: ${rem.titulo}`, emailLembrete(rem.display_name, rem.titulo, rem.descricao, quando));
      await enviarPush(rem.user_id, { titulo: rem.titulo, corpo: rem.descricao || `Lembrete de ${quando}`, url: '/calendario', tag: `lembrete-${rem.id}` });
      await pool.query('UPDATE public.lembretes SET notificado = true WHERE id = $1', [rem.id]);
    }
  } catch (err) {
    console.error('[CRON] Erro nos lembretes:', err.message);
  }
}

async function gerarMesCorrente() {
  const [ano, mes] = hojeSP().split('-').map(Number);
  try {
    await gerarMesAutomatico(ano, mes);
  } catch (err) {
    console.error('[CRON] Erro na geração automática:', err.message);
  }
}

async function sincronizarPluggyDono() {
  if (!pluggyConfigurado()) return;
  try {
    const u = await pool.query('SELECT id FROM auth.users WHERE lower(email) = $1', [emailDonoPluggy()]);
    if (!u.rows.length) return;
    const r = await sincronizarPluggy(u.rows[0].id);
    console.log(`[CRON] Pluggy: ${r.inseridos} novo(s).`);
  } catch (err) {
    console.error('[CRON] Pluggy falhou:', err.message);
  }
}

const seguro = (nome, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[CRON] ${nome} falhou:`, err.message);
  }
};

export const initCronJobs = () => {
  cron.schedule('0 8 * * *', seguro('avisos das 8h', async () => {
    await emailVencimentosDoDia();
    await pushVencimentos();
    await alertasOrcamento();
  }), TZ);
  cron.schedule('10 0 * * *', gerarMesCorrente, TZ);
  cron.schedule('30 6 * * *', sincronizarPluggyDono, TZ);
  setInterval(verificarLembretes, 5 * 60 * 1000);
  setTimeout(verificarLembretes, 10000);
  // Ao subir o servidor: garante o mês corrente gerado (cobre o servidor fora do ar na virada do mês)
  setTimeout(gerarMesCorrente, 15000);
};
