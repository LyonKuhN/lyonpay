import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarClock, CircleCheck, Clock, PiggyBank, Plus, ReceiptText, TrendingDown, TrendingUp,
  TriangleAlert, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEspaco } from '../contexts/EspacoContext';
import { useQuickActions } from '../components/layout/AppShell';
import {
  useAtrasadas, useDespesas, useDespesasMes, useEvolucao, useLembretes, useModelos, useOrcamentos, useReceitas, useRecorrentes, useSaldoDetalhado,
} from '../hooks/queries';
import { Card, CardHeader, EmptyState, ProgressBar, Skeleton, TONE_TEXT } from '../components/ui/primitives';
import { AnimatedNumber, Stagger, StaggerItem } from '../components/ui/motion';
import { Button } from '../components/ui/button';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { TxRow } from '../components/finance/TxRow';
import { ChartTooltip, useChartColors } from '../components/finance/charts';
import { Onboarding } from '../components/Onboarding';
import { categoryIcon, CHART_COLORS } from '../lib/categories';
import { cn } from '../lib/cn';
import {
  dateKey, dueStatus, formatBRL, formatBRLCompact, formatDateTime, formatDayMonth, MONTHS, MONTHS_SHORT, percent, type Tone,
} from '../lib/format';
import { chaveMes, gastoPorCategoria, projetarCaixa, tomOrcamento, ultimosMeses } from '../lib/planejamento';
import { somaEfetiva, valorEfetivo } from '../lib/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { compartilhado, ativo } = useEspaco();
  const navigate = useNavigate();
  const { newDespesa, newReceita } = useQuickActions();
  const colors = useChartColors();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const receitasQ = useReceitas();
  const despesasQ = useDespesasMes(year, month);
  const todasQ = useDespesas();
  const atrasadasQ = useAtrasadas();
  const lembretesQ = useLembretes();
  const evolucaoQ = useEvolucao(year);
  const saldoQ = useSaldoDetalhado();
  const modelosQ = useModelos();
  const recorrentesQ = useRecorrentes();
  const orcamentosQ = useOrcamentos();

  const isYear = month === 0;
  const periodo = isYear ? `em ${year}` : 'no mês';
  const mesAtual = !isYear && year === now.getFullYear() && month === now.getMonth() + 1;

  const d = useMemo(() => {
    const prefix = isYear ? `${year}-` : `${year}-${String(month).padStart(2, '0')}-`;
    const doPeriodo = (receitasQ.data ?? []).filter((r) => dateKey(r.data_recebimento).startsWith(prefix));
    const receitas = doPeriodo.filter((r) => !r.pendente);
    const aReceber = doPeriodo.filter((r) => r.pendente).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const despesas = despesasQ.data ?? [];
    const pagas = despesas.filter((x) => x.pago);
    const pendentes = despesas.filter((x) => !x.pago).sort((a, b) => dateKey(a.data_vencimento).localeCompare(dateKey(b.data_vencimento)));

    const entradas = receitas.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
    const saidasPagas = somaEfetiva(pagas);
    const aPagar = pendentes.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
    const totalDespesas = saidasPagas + aPagar;

    const catMap = new Map<string, number>();
    for (const x of despesas) catMap.set(x.categoria || 'Outros', (catMap.get(x.categoria || 'Outros') ?? 0) + valorEfetivo(x));
    const ranked = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 5).map(([name, value]) => ({ name, value }));
    const rest = ranked.slice(5).reduce((acc, [, v]) => acc + v, 0);
    if (rest > 0) top.push({ name: 'Outras', value: rest });

    return {
      entradas, saidasPagas, aPagar, totalDespesas, aReceber,
      pagasCount: pagas.length,
      pendentes,
      despesasCount: despesas.length,
      categorias: top,
      gastoPorCat: catMap,
      ultimasEntradas: [...receitas].sort((a, b) => dateKey(b.data_recebimento).localeCompare(dateKey(a.data_recebimento))).slice(0, 5),
    };
  }, [receitasQ.data, despesasQ.data, year, month, isYear]);

  // Orçamentos que passaram de 80% no mês na tela
  const alertasOrc = useMemo(() => {
    if (isYear) return [];
    return (orcamentosQ.data ?? [])
      .map((o) => ({ o, gasto: d.gastoPorCat.get(o.categoria) ?? 0, limite: Number(o.valor) || 0 }))
      .filter((x) => x.limite > 0 && x.gasto / x.limite >= 0.8)
      .sort((a, b) => b.gasto / b.limite - a.gasto / a.limite);
  }, [orcamentosQ.data, d.gastoPorCat, isYear]);

  const projecao = useMemo(() => projetarCaixa({
    saldoAtual: saldoQ.data?.total ?? 0,
    despesas: todasQ.data ?? [],
    receitas: receitasQ.data ?? [],
    modelos: modelosQ.data ?? [],
    recorrentes: recorrentesQ.data ?? [],
  }), [saldoQ.data, todasQ.data, receitasQ.data, modelosQ.data, recorrentesQ.data]);
  const menorSaldo = projecao.reduce((min, p) => (p.saldo < min.saldo ? p : min), projecao[0] ?? { saldo: 0, rotulo: '' });

  // Tendência: as 4 categorias que mais pesaram nos últimos 6 meses
  const tendencias = useMemo(() => {
    const chaves = ultimosMeses(6);
    return gastoPorCategoria(todasQ.data ?? [], chaves).slice(0, 4).map((c) => {
      const atual = c.valores[c.valores.length - 1];
      const anteriores = c.valores.slice(0, -1);
      const media = anteriores.reduce((a, v) => a + v, 0) / (anteriores.filter((v) => v > 0).length || 1);
      return {
        ...c,
        atual,
        variacao: media > 0 ? Math.round(((atual - media) / media) * 100) : null,
        serie: c.valores.map((v, i) => ({ mes: MONTHS_SHORT[Number(chaves[i].slice(5)) - 1], v })),
      };
    });
  }, [todasQ.data]);

  const atrasadas = atrasadasQ.data ?? [];
  const atrasadasTotal = atrasadas.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
  const lembretes = (lembretesQ.data ?? []).filter((l) => !l.concluido).slice(0, 3);
  const saldo = saldoQ.data?.total ?? 0;
  const contas = (saldoQ.data?.contas ?? []).filter((c) => c.ativo);

  const gastoPct = d.entradas > 0 ? percent(d.saidasPagas, d.entradas) : 0;
  const poupanca = d.entradas > 0 ? Math.max(0, 100 - gastoPct) : 0;
  const saude = Math.min(100, Math.round(poupanca * 0.6 + Math.max(0, 40 - atrasadas.length * 10)));
  const saudeTone: Tone = saude >= 70 ? 'pos' : saude >= 40 ? 'warn' : 'neg';

  const yearChart = (evolucaoQ.data ?? []).map((m) => ({ name: MONTHS_SHORT[m.mes - 1], mes: m.mes, Receitas: m.receitas, Despesas: m.despesas }));
  const hasYearData = yearChart.some((m) => m.Receitas > 0 || m.Despesas > 0);

  const loading = receitasQ.isLoading || despesasQ.isLoading || saldoQ.isLoading;
  const firstName = user?.name?.split(' ')[0];

  // Primeiro acesso: sem contas e sem nenhum lançamento
  const vazio = !loading && !todasQ.isLoading && (saldoQ.data?.contas ?? []).length === 0
    && (todasQ.data ?? []).length === 0 && (receitasQ.data ?? []).length === 0 && (modelosQ.data ?? []).length === 0;
  const mostrarOnboarding = vazio && !compartilhado && !user?.onboarding_concluido;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{compartilhado ? `Finanças de ${ativo?.nome}` : `${greeting()}${firstName ? `, ${firstName}` : ''}`}</p>
          <h2 className="text-[22px] font-semibold tracking-tight text-fg lg:text-[28px]">
            {isYear ? `Resumo de ${year}` : `${MONTHS[month - 1]} de ${year}`}
          </h2>
        </div>
        <MonthSwitcher year={year} month={month} allowYear onChange={(y, m) => { setYear(y); setMonth(m); }} className="sm:w-64" />
      </div>

      {atrasadas.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/pagamentos')}
          className="flex w-full items-center gap-3 rounded-2xl border border-neg/25 bg-neg/8 p-4 text-left transition-colors hover:bg-neg/12"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neg/15 text-neg"><TriangleAlert size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">
              {atrasadas.length} {atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'}
            </span>
            <span className="block text-[13px] text-muted tabular-nums">{formatBRL(atrasadasTotal)} em aberto</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-neg">Ver <ArrowRight size={16} /></span>
        </button>
      )}

      {/* No celular os cartões seguem a ordem de prioridade; no desktop viram duas colunas independentes */}
      <Stagger className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-2 lg:block lg:space-y-6">
          {/* Saldo */}
          <StaggerItem className="order-1">
            <Card className="relative overflow-hidden p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
              <div className="relative">
                <p className="text-[13px] font-medium text-muted">Saldo disponível</p>
                {loading ? (
                  <Skeleton className="mt-2 h-10 w-48" />
                ) : (
                  <AnimatedNumber
                    value={saldo}
                    format={(n) => formatBRL(n)}
                    className={cn('mt-1 block text-[34px] font-semibold leading-tight tracking-tight sm:text-[40px]', saldo < 0 ? 'text-neg' : 'text-fg')}
                  />
                )}
                <p className="mt-1 text-xs text-subtle">{contas.length ? 'Soma das suas contas' : 'Tudo que entrou menos as despesas já pagas'}</p>

                {contas.length > 0 && (
                  <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                    {contas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => navigate('/carteira')}
                        className="shrink-0 rounded-xl border border-line bg-bg/60 px-3 py-2 text-left transition-colors hover:border-line-strong"
                      >
                        <span className="block max-w-36 truncate text-[12px] text-muted">{c.nome}</span>
                        <span className={cn('block text-sm font-semibold tabular-nums', (c.saldo ?? 0) < 0 ? 'text-neg' : 'text-fg')}>{formatBRL(c.saldo)}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line bg-bg/50 p-3 sm:p-4">
                    <p className="flex items-center gap-1.5 text-[13px] text-muted"><ArrowDownLeft size={15} className="text-pos" /> Entradas {periodo}</p>
                    <p className="mt-1 truncate text-lg font-semibold tabular-nums text-fg sm:text-xl">{formatBRL(d.entradas)}</p>
                    {d.aReceber > 0 && <p className="truncate text-xs text-info">+ {formatBRL(d.aReceber)} a receber</p>}
                  </div>
                  <div className="rounded-xl border border-line bg-bg/50 p-3 sm:p-4">
                    <p className="flex items-center gap-1.5 text-[13px] text-muted"><ArrowUpRight size={15} className="text-neg" /> Pagas {periodo}</p>
                    <p className="mt-1 truncate text-lg font-semibold tabular-nums text-fg sm:text-xl">{formatBRL(d.saidasPagas)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-muted">
                      {d.entradas > 0 ? <>Você gastou <strong className="font-semibold text-fg">{gastoPct}%</strong> do que entrou</> : 'Sem entradas registradas no período'}
                    </span>
                    {d.entradas > 0 && <span className="text-subtle">Guardou {poupanca}%</span>}
                  </div>
                  <ProgressBar value={gastoPct} tone={gastoPct > 90 ? 'neg' : gastoPct > 70 ? 'warn' : 'pos'} />
                </div>
              </div>
            </Card>
          </StaggerItem>

          {/* Projeção de caixa */}
          <StaggerItem className="order-5">
            <Card>
              <CardHeader
                title="Projeção dos próximos 6 meses"
                description={menorSaldo && menorSaldo.saldo < 0
                  ? <span className="text-neg">O saldo fica negativo em {menorSaldo.rotulo}. Vale rever os gastos antes.</span>
                  : 'Saldo de hoje + lançamentos, fixas, recorrentes e a média dos gastos do dia a dia'}
                action={<Button variant="ghost" size="sm" onClick={() => navigate('/relatorios')}>Detalhes <ArrowRight size={15} /></Button>}
              />
              <div className="h-48 px-1 pb-3 pt-4 sm:h-56 sm:px-3">
                {saldoQ.isLoading || todasQ.isLoading ? <Skeleton className="mx-3 h-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projecao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="proj-ini" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors.brand} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={colors.grid} />
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} width={52} tickFormatter={(v: number) => formatBRLCompact(v).replace('R$ ', '')} />
                      <ReferenceLine y={0} stroke={colors.neg} strokeDasharray="4 4" />
                      <Tooltip content={(p) => <ChartTooltip {...p} />} />
                      <Area type="monotone" dataKey="saldo" name="Saldo projetado" stroke={colors.brand} strokeWidth={2.5} fill="url(#proj-ini)" animationDuration={900} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </StaggerItem>

          {/* Categorias */}
          <StaggerItem className="order-6">
            <Card>
              <CardHeader title="Despesas por categoria" description={`Pagas e a pagar ${periodo}`} />
              {d.categorias.length === 0 ? (
                <EmptyState icon={ReceiptText} title="Sem despesas no período" />
              ) : (
                <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:gap-8 sm:p-5">
                  <div className="relative h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={d.categorias} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} animationDuration={800}>
                          {d.categorias.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={(p) => <ChartTooltip {...p} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted">Total</span>
                      <span className="text-base font-semibold tabular-nums text-fg">{formatBRLCompact(d.totalDespesas)}</span>
                    </div>
                  </div>
                  <ul className="w-full min-w-0 flex-1 space-y-2.5">
                    {d.categorias.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-3 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                        <span className="text-subtle tabular-nums">{percent(c.value, d.totalDespesas)}%</span>
                        <span className="w-24 text-right font-medium tabular-nums text-fg">{formatBRL(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </StaggerItem>

          {/* Tendência por categoria */}
          {tendencias.length > 0 && (
            <StaggerItem className="order-7">
              <Card>
                <CardHeader title="Tendência por categoria" description="Últimos 6 meses; comparação do mês atual com a média" />
                <div className="grid gap-px overflow-hidden rounded-b-2xl bg-line sm:grid-cols-2 [&>*]:bg-surface mt-3 border-t border-line">
                  {tendencias.map((t, i) => {
                    const Icon = categoryIcon(t.categoria);
                    const subiu = (t.variacao ?? 0) > 0;
                    return (
                      <div key={t.categoria} className="p-4 sm:p-5">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{t.categoria}</span>
                          {t.variacao !== null && (
                            <span className={cn('flex items-center gap-0.5 text-xs font-semibold', subiu ? 'text-neg' : 'text-pos')}>
                              {subiu ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(t.variacao)}%
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{formatBRL(t.atual)}</p>
                        <div className="mt-2 h-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={t.serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                              <Tooltip content={(p) => <ChartTooltip {...p} />} />
                              <XAxis dataKey="mes" hide />
                              {/* Escala justa nos valores da categoria: a variação aparece mesmo em gastos estáveis */}
                              <YAxis hide domain={[(min: number) => min * 0.85, (max: number) => max * 1.05]} />
                              <Line type="monotone" dataKey="v" name={t.categoria} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} animationDuration={900} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </StaggerItem>
          )}

          {/* Evolução no ano */}
          <StaggerItem className="order-8">
            <Card>
              <CardHeader
                title={`Entradas e saídas em ${year}`}
                description="Despesas pelo mês de vencimento"
                action={
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.pos }} />Entradas</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: colors.neg }} />Saídas</span>
                  </div>
                }
              />
              <div className="h-56 px-1 pb-3 pt-4 sm:h-64 sm:px-3">
                {evolucaoQ.isLoading ? (
                  <Skeleton className="mx-3 h-full" />
                ) : !hasYearData ? (
                  <EmptyState icon={ReceiptText} title="Sem lançamentos neste ano" className="py-6" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke={colors.grid} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} interval={0} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 11 }} width={52} tickFormatter={(v: number) => formatBRLCompact(v).replace('R$ ', '')} />
                      <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={(p) => <ChartTooltip {...p} formatLabel={(l) => `${l} de ${year}`} />} />
                      <Bar dataKey="Receitas" name="Entradas" fill={colors.pos} radius={[4, 4, 0, 0]} maxBarSize={14} animationDuration={700}>
                        {yearChart.map((m) => <Cell key={m.mes} fillOpacity={isYear || m.mes === month ? 1 : 0.35} />)}
                      </Bar>
                      <Bar dataKey="Despesas" name="Saídas" fill={colors.neg} radius={[4, 4, 0, 0]} maxBarSize={14} animationDuration={700}>
                        {yearChart.map((m) => <Cell key={m.mes} fillOpacity={isYear || m.mes === month ? 1 : 0.35} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </StaggerItem>

          {/* Últimas entradas */}
          <StaggerItem className="order-10">
            <Card className="overflow-hidden">
              <CardHeader title="Últimas entradas" action={<Button variant="ghost" size="sm" onClick={() => navigate('/receitas')}>Ver todas <ArrowRight size={15} /></Button>} />
              <div className="mt-2 divide-y divide-line">
                {d.ultimasEntradas.length === 0 ? (
                  <EmptyState
                    icon={ArrowDownLeft}
                    title="Nenhuma entrada"
                    description={`Registre o que você recebeu ${periodo}.`}
                    action={<Button variant="secondary" size="sm" onClick={newReceita}><Plus size={16} /> Nova receita</Button>}
                  />
                ) : (
                  d.ultimasEntradas.map((r) => (
                    <TxRow
                      key={r.id}
                      icon={categoryIcon(r.categoria)}
                      tone="pos"
                      title={r.descricao}
                      subtitle={<>{r.categoria || 'Outros'} · {formatDayMonth(r.data_recebimento)}</>}
                      amount={`+ ${formatBRL(r.valor)}`}
                      amountTone="pos"
                      onClick={() => navigate('/receitas')}
                    />
                  ))
                )}
              </div>
            </Card>
          </StaggerItem>
        </div>

        <div className="contents lg:block lg:space-y-6">
          {/* Resumo */}
          <StaggerItem className="order-2">
            <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line p-0">
              {[
                { label: `A pagar ${periodo}`, value: formatBRL(d.aPagar), sub: `${d.pendentes.length} ${d.pendentes.length === 1 ? 'conta' : 'contas'}`, icon: Clock, tone: 'warn' as Tone },
                { label: 'Contas pagas', value: `${d.pagasCount} de ${d.despesasCount}`, sub: `${percent(d.pagasCount, d.despesasCount)}% do ${isYear ? 'ano' : 'mês'}`, icon: CircleCheck, tone: 'pos' as Tone },
                { label: 'Atrasadas', value: String(atrasadas.length), sub: atrasadas.length ? formatBRL(atrasadasTotal) : 'Tudo em dia', icon: TriangleAlert, tone: (atrasadas.length ? 'neg' : 'pos') as Tone },
                { label: 'Saúde financeira', value: `${saude}/100`, sub: saude >= 70 ? 'Boa' : saude >= 40 ? 'Atenção' : 'Crítica', icon: ReceiptText, tone: saudeTone },
              ].map((s) => (
                <div key={s.label} className="bg-surface p-4 sm:p-5">
                  <s.icon size={18} className={TONE_TEXT[s.tone]} />
                  <p className="mt-3 truncate text-[13px] text-muted">{s.label}</p>
                  <p className="mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums text-fg">{s.value}</p>
                  <p className={cn('truncate text-xs', s.label === 'Saúde financeira' ? TONE_TEXT[s.tone] : 'text-subtle')}>{s.sub}</p>
                </div>
              ))}
            </Card>
          </StaggerItem>

          {/* Próximos vencimentos */}
          <StaggerItem className="order-3">
            <Card className="overflow-hidden">
              <CardHeader
                title="Contas a pagar"
                description={d.pendentes.length ? `${d.pendentes.length} em aberto ${periodo}` : undefined}
                action={<Button variant="ghost" size="sm" onClick={() => navigate('/pagamentos')}>Ver todas <ArrowRight size={15} /></Button>}
              />
              <div className="mt-2 divide-y divide-line">
                {loading ? (
                  <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : d.pendentes.length === 0 ? (
                  <EmptyState icon={CircleCheck} title="Nada pendente" description={`Nenhuma conta em aberto ${periodo}.`} />
                ) : (
                  d.pendentes.slice(0, 6).map((c) => {
                    const st = dueStatus(c.data_vencimento);
                    return (
                      <TxRow
                        key={c.id}
                        icon={categoryIcon(c.categoria)}
                        tone={st.tone === 'neg' ? 'neg' : st.tone === 'warn' ? 'warn' : 'neutral'}
                        title={c.descricao}
                        subtitle={<span className={TONE_TEXT[st.tone]}>{st.text}</span>}
                        amount={formatBRL(c.valor)}
                        meta={<span className="text-xs text-subtle">{formatDayMonth(c.data_vencimento)}</span>}
                        onClick={() => navigate('/pagamentos')}
                      />
                    );
                  })
                )}
              </div>
            </Card>
          </StaggerItem>

          {/* Orçamentos em atenção */}
          {(alertasOrc.length > 0 || (mesAtual && (orcamentosQ.data ?? []).length === 0 && (todasQ.data ?? []).length > 10)) && (
            <StaggerItem className="order-4">
              <Card className={cn('overflow-hidden', alertasOrc.some((a) => a.gasto >= a.limite) && 'border-neg/30')}>
                <CardHeader
                  title={alertasOrc.length ? 'Orçamentos em atenção' : 'Defina orçamentos'}
                  description={alertasOrc.length ? 'Categorias acima de 80% do limite' : 'Um limite por categoria evita surpresas no fim do mês'}
                  action={<Button variant="ghost" size="sm" onClick={() => navigate('/orcamentos')}>{alertasOrc.length ? 'Ver' : 'Criar'} <ArrowRight size={15} /></Button>}
                />
                {alertasOrc.length > 0 ? (
                  <ul className="mt-3 space-y-4 px-4 pb-5 sm:px-5">
                    {alertasOrc.slice(0, 4).map(({ o, gasto, limite }) => {
                      const st = tomOrcamento(gasto, limite);
                      return (
                        <li key={o.id}>
                          <div className="mb-1.5 flex items-center gap-2 text-sm">
                            <PiggyBank size={15} className={TONE_TEXT[st.tone]} />
                            <span className="min-w-0 flex-1 truncate text-fg">{o.categoria}</span>
                            <span className="tabular-nums text-muted">{percent(gasto, limite)}%</span>
                          </div>
                          <ProgressBar value={percent(gasto, limite)} tone={st.tone} />
                          <p className={cn('mt-1 text-xs', TONE_TEXT[st.tone])}>{st.texto}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : <div className="h-4" />}
              </Card>
            </StaggerItem>
          )}

          {/* Lembretes */}
          {lembretes.length > 0 && (
            <StaggerItem className="order-9">
              <Card className="overflow-hidden">
                <CardHeader title="Lembretes" action={<Button variant="ghost" size="sm" onClick={() => navigate('/calendario')}>Agenda <ArrowRight size={15} /></Button>} />
                <div className="mt-2 divide-y divide-line">
                  {lembretes.map((l) => {
                    const late = new Date(l.data_lembrete) < now;
                    return (
                      <TxRow
                        key={l.id}
                        icon={Bell}
                        tone={late ? 'neg' : 'warn'}
                        title={l.titulo}
                        subtitle={<span className={late ? 'text-neg' : ''}>{formatDateTime(l.data_lembrete)}</span>}
                        amount=""
                        onClick={() => navigate('/calendario')}
                      />
                    );
                  })}
                </div>
              </Card>
            </StaggerItem>
          )}

          {/* A receber */}
          {d.aReceber > 0 && (
            <StaggerItem className="order-9">
              <button type="button" onClick={() => navigate('/receitas')} className="block w-full text-left">
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/12 text-info"><CalendarClock size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">A receber {periodo}</span>
                    <span className="block text-[13px] text-muted">Confirme quando entrar na conta</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-info">{formatBRL(d.aReceber)}</span>
                </Card>
              </button>
            </StaggerItem>
          )}

          {contas.length === 0 && !loading && !vazio && !compartilhado && (
            <StaggerItem className="order-9">
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><Wallet size={19} /></span>
                  <div>
                    <p className="text-sm font-semibold text-fg">Cadastre suas contas e cartões</p>
                    <p className="mt-0.5 text-[13px] text-muted">O saldo passa a ser por conta e as compras no cartão caem na fatura certa.</p>
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate('/carteira')}>Abrir contas e cartões</Button>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          )}
        </div>
      </Stagger>

      {!loading && d.despesasCount === 0 && d.entradas === 0 && !mostrarOnboarding && (
        <Card className="p-5 text-center sm:p-6">
          <p className="text-[15px] font-semibold text-fg">Comece registrando seus lançamentos</p>
          <p className="mt-1 text-sm text-muted">Adicione o que entrou e o que vai sair para ver o mês com clareza.</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => newDespesa()}><Plus size={17} /> Nova despesa</Button>
            <Button variant="secondary" onClick={newReceita}><Plus size={17} /> Nova receita</Button>
          </div>
        </Card>
      )}

      <Onboarding open={mostrarOnboarding} mes={chaveMes(now.getFullYear(), now.getMonth() + 1)} />
    </div>
  );
}
