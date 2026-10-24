import { dateKey, daysInMonth } from './format';
import type { Cartao, Despesa } from './types';

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Vencimento da fatura em que cai uma compra (mesma regra do servidor).
 * Compras a partir do dia do fechamento entram na fatura seguinte; se o vencimento é depois do
 * fechamento no calendário, vence no mesmo mês do fechamento, senão no mês seguinte.
 */
export function vencimentoFatura(dataCompra: string, diaFechamento: number, diaVencimento: number): string {
  const [y, m, d] = dataCompra.split('-').map(Number);
  let fy = y;
  let fm = m;
  if (d >= diaFechamento) {
    fm += 1;
    if (fm > 12) { fm = 1; fy += 1; }
  }
  let vy = fy;
  let vm = fm;
  if (diaVencimento <= diaFechamento) {
    vm += 1;
    if (vm > 12) { vm = 1; vy += 1; }
  }
  return ymd(vy, vm, Math.min(diaVencimento, daysInMonth(vy, vm)));
}

/** Soma meses mantendo o dia; se o mês não tem esse dia, usa o último (31/01 → 28/02). */
export function somarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, m - 1 + n, 1);
  const yy = alvo.getFullYear();
  const mm = alvo.getMonth() + 1;
  return ymd(yy, mm, Math.min(d, daysInMonth(yy, mm)));
}

export interface Fatura {
  /** cartão + vencimento */
  key: string;
  cartao: Cartao;
  vencimento: string;
  itens: Despesa[];
  total: number;
  pendente: number;
  paga: boolean;
}

/** Junta as compras de cartão de uma lista em faturas (cartão + data de vencimento). */
export function agruparFaturas(despesas: Despesa[], cartoes: Cartao[]): { faturas: Fatura[]; avulsas: Despesa[] } {
  const porId = new Map(cartoes.map((c) => [c.id, c]));
  const mapa = new Map<string, Fatura>();
  const avulsas: Despesa[] = [];
  for (const d of despesas) {
    const cartao = d.cartao_id ? porId.get(d.cartao_id) : undefined;
    if (!cartao) {
      avulsas.push(d);
      continue;
    }
    const vencimento = dateKey(d.data_vencimento);
    const key = `${cartao.id}|${vencimento}`;
    const f = mapa.get(key) ?? { key, cartao, vencimento, itens: [], total: 0, pendente: 0, paga: true };
    f.itens.push(d);
    f.total += Number(d.valor) || 0;
    if (!d.pago) {
      f.pendente += Number(d.valor) || 0;
      f.paga = false;
    }
    mapa.set(key, f);
  }
  const faturas = [...mapa.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  for (const f of faturas) f.itens.sort((a, b) => dateKey(a.data_compra || a.data_vencimento).localeCompare(dateKey(b.data_compra || b.data_vencimento)));
  return { faturas, avulsas };
}
