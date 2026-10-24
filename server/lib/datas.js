// Datas sem horário ("AAAA-MM-DD") tratadas como texto/número, sem passar por fuso.

export const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const ultimoDia = (y, m) => new Date(y, m, 0).getDate();

/** Valor de coluna DATE (Date do pg ou texto) → "AAAA-MM-DD". */
export function chaveData(v) {
  if (!v) return null;
  if (v instanceof Date) return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function partes(chave) {
  const [y, m, d] = chave.split('-').map(Number);
  return { y, m, d };
}

/** Soma meses mantendo o dia; meses curtos usam o último dia. */
export function somarMeses(chave, n) {
  const { y, m, d } = partes(chave);
  const alvo = new Date(y, m - 1 + n, 1);
  const yy = alvo.getFullYear();
  const mm = alvo.getMonth() + 1;
  return ymd(yy, mm, Math.min(d, ultimoDia(yy, mm)));
}

export function somarDias(chave, n) {
  const { y, m, d } = partes(chave);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Hoje no fuso de São Paulo (o container roda em UTC). */
export function hojeSP() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // en-CA já sai como AAAA-MM-DD
}

/**
 * Vencimento da fatura em que cai uma compra no cartão.
 * Compras a partir do dia de fechamento entram na fatura seguinte.
 * Se o vencimento é depois do fechamento no calendário, vence no mesmo mês do fechamento; senão, no mês seguinte.
 */
export function vencimentoFatura(dataCompra, diaFechamento, diaVencimento) {
  const { y, m, d } = partes(dataCompra);
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
  return ymd(vy, vm, Math.min(diaVencimento, ultimoDia(vy, vm)));
}
