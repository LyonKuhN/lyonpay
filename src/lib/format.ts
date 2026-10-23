// Datas de colunas DATE chegam da API como "2026-10-25T00:00:00.000Z".
// `new Date()` lê isso como meia-noite UTC, que no Brasil (UTC-3) ainda é o dia 24.
// Por isso toda data sem horário é lida só pela parte AAAA-MM-DD, no fuso local.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const m = DATE_ONLY.exec(value);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2026-10-25T00:00:00.000Z" → "2026-10-25" */
export function dateKey(value?: string | null): string {
  if (!value) return '';
  const m = DATE_ONLY.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Data local → "AAAA-MM-DD" (sem passar por UTC). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Para colunas com horário (lembretes): a data local do instante. */
export function timestampKey(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : toISODate(d);
}

/** Diferença em dias de calendário entre hoje e a data (negativo = passou). */
export function daysUntil(value?: string | null): number {
  const d = parseDateOnly(value);
  if (!d) return 0;
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDate(value?: string | null): string {
  const d = parseDateOnly(value);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
}

/** "25 out" */
export function formatDayMonth(value?: string | null): string {
  const d = parseDateOnly(value);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export type Tone = 'neutral' | 'pos' | 'neg' | 'warn' | 'brand' | 'info';

export function dueStatus(value?: string | null): { text: string; tone: Tone; days: number } {
  const days = daysUntil(value);
  if (days < 0) {
    const n = Math.abs(days);
    return { text: `Atrasada há ${n} ${n === 1 ? 'dia' : 'dias'}`, tone: 'neg', days };
  }
  if (days === 0) return { text: 'Vence hoje', tone: 'warn', days };
  if (days === 1) return { text: 'Vence amanhã', tone: 'warn', days };
  if (days <= 7) return { text: `Vence em ${days} dias`, tone: 'info', days };
  return { text: `Vence em ${formatDayMonth(value)}`, tone: 'neutral', days };
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** month de 1 a 12 */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlNoCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function formatBRL(value: number | string | null | undefined, opts: { cents?: boolean; sign?: boolean } = {}): string {
  const n = Number(value) || 0;
  const text = (opts.cents === false ? brlNoCents : brl).format(Math.abs(n));
  if (opts.sign) return `${n < 0 ? '−' : '+'} ${text}`;
  return n < 0 ? `−${text}` : text;
}

/** Eixos de gráfico: "R$ 1,2 mil" */
export function formatBRLCompact(value: number): string {
  const n = Math.abs(value);
  if (n >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Aceita "1.234,56", "1234,5" e "1234.56". Retorna NaN se não for número. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input;
  if (!input) return NaN;
  let s = String(input).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/** 150 → "150,00" para preencher campos de valor */
export function toMoneyInput(value: number | string | null | undefined): string {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || isNaN(n)) return '';
  return n.toFixed(2).replace('.', ',');
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
