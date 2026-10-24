import { dateKey, formatBRL, MONTHS_SHORT, type Tone } from './format';
import { normalizeTipo, valorEfetivo, type Despesa, type Receita, type ReceitaRecorrente } from './types';

/** Situação de um orçamento: até 80% tranquilo, de 80% a 100% atenção, acima estourado. */
export function tomOrcamento(gasto: number, limite: number): { tone: Tone; texto: string } {
  const p = limite ? (gasto / limite) * 100 : 0;
  if (p >= 100) return { tone: 'neg', texto: `Estourou ${formatBRL(gasto - limite)}` };
  if (p >= 80) return { tone: 'warn', texto: `Restam ${formatBRL(limite - gasto)}` };
  return { tone: 'pos', texto: `Restam ${formatBRL(limite - gasto)}` };
}

export const chaveMes = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

export interface MesProjetado {
  chave: string;
  rotulo: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

const semParcela = (d: string) => d.replace(/\s*\(\d+\/\d+\)$/, '').trim().toLowerCase();

/**
 * Projeção de caixa: parte do saldo de hoje e soma, mês a mês, o que já está lançado
 * (parcelas, faturas, contas e receitas previstas), o que os modelos fixos e as receitas
 * recorrentes ainda vão gerar e, nos meses seguintes, a média dos gastos variáveis.
 */
export function projetarCaixa({ saldoAtual, despesas, receitas, modelos, recorrentes, meses = 6, hoje = new Date() }: {
  saldoAtual: number;
  despesas: Despesa[];
  receitas: Receita[];
  modelos: Despesa[];
  recorrentes: ReceitaRecorrente[];
  meses?: number;
  hoje?: Date;
}): MesProjetado[] {
  const resultado: MesProjetado[] = [];
  const mesAtual = chaveMes(hoje.getFullYear(), hoje.getMonth() + 1);
  let saldo = saldoAtual;

  // Gastos do dia a dia (mercado, delivery, transporte) ainda não existem nos meses futuros:
  // estima pela média dos 3 meses fechados anteriores
  const variavelDoMes = (chave: string) => despesas
    .filter((x) => normalizeTipo(x.tipo) === 'variavel' && dateKey(x.data_vencimento).slice(0, 7) === chave)
    .reduce((a, x) => a + valorEfetivo(x), 0);
  const fechados = [1, 2, 3].map((i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return variavelDoMes(chaveMes(d.getFullYear(), d.getMonth() + 1));
  });
  const comGasto = fechados.filter((v) => v > 0);
  const mediaVariavel = comGasto.length ? comGasto.reduce((a, v) => a + v, 0) / comGasto.length : 0;

  for (let i = 0; i < meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const chave = chaveMes(d.getFullYear(), d.getMonth() + 1);
    const doMes = despesas.filter((x) => dateKey(x.data_vencimento).slice(0, 7) === chave);
    // Contas atrasadas de antes entram no mês atual: ainda vão sair do caixa
    const atrasadas = i === 0 ? despesas.filter((x) => !x.pago && dateKey(x.data_vencimento).slice(0, 7) < mesAtual) : [];
    let saidas = [...doMes, ...atrasadas].filter((x) => !x.pago).reduce((a, x) => a + valorEfetivo(x), 0);

    if (i > 0) saidas += Math.max(0, mediaVariavel - variavelDoMes(chave));

    // Modelos fixos que ainda não viraram conta neste mês
    const fixasDoMes = new Set(doMes.filter((x) => normalizeTipo(x.tipo) === 'fixa').map((x) => semParcela(x.descricao)));
    for (const m of modelos) if (!fixasDoMes.has(semParcela(m.descricao))) saidas += Number(m.valor) || 0;

    const recDoMes = receitas.filter((r) => dateKey(r.data_recebimento).slice(0, 7) === chave);
    let entradas = recDoMes.filter((r) => r.pendente).reduce((a, r) => a + (Number(r.valor) || 0), 0);
    const lancadas = new Set(recDoMes.map((r) => r.recorrente_id).filter(Boolean));
    for (const r of recorrentes) if (r.ativo && !lancadas.has(r.id)) entradas += Number(r.valor) || 0;

    saldo += entradas - saidas;
    resultado.push({
      chave,
      rotulo: `${MONTHS_SHORT[d.getMonth()]}${d.getMonth() === 0 || i === 0 ? `/${String(d.getFullYear()).slice(2)}` : ''}`,
      entradas,
      saidas,
      saldo,
    });
  }
  return resultado;
}

/** Gasto por categoria mês a mês (para tendências e relatórios). */
export function gastoPorCategoria(despesas: Despesa[], chaves: string[]) {
  const mapa = new Map<string, number[]>();
  for (const d of despesas) {
    const idx = chaves.indexOf(dateKey(d.data_vencimento).slice(0, 7));
    if (idx < 0) continue;
    const cat = d.categoria || 'Outros';
    const linha = mapa.get(cat) ?? chaves.map(() => 0);
    linha[idx] += valorEfetivo(d);
    mapa.set(cat, linha);
  }
  return [...mapa.entries()]
    .map(([categoria, valores]) => ({ categoria, valores, total: valores.reduce((a, v) => a + v, 0) }))
    .sort((a, b) => b.total - a.total);
}

/** As últimas n chaves de mês terminando no mês informado (inclusive). */
export function ultimosMeses(n: number, ate = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ate.getFullYear(), ate.getMonth() - (n - 1 - i), 1);
    return chaveMes(d.getFullYear(), d.getMonth() + 1);
  });
}
