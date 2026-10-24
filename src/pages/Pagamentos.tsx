import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowDown, ArrowUp, CalendarDays, Check, CircleCheck, CreditCard, Info, ListChecks, Repeat, Search, SlidersHorizontal, TriangleAlert, X,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { invalidateFinance, useAtrasadas, useCartoes, useCategorias, useDespesasMes, useModelos, useSaldo } from '../hooks/queries';
import { useDespesaActions } from '../hooks/useDespesaActions';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useEspaco } from '../contexts/EspacoContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input, MoneyInput, Select } from '../components/ui/input';
import { Card, EmptyState, IconTile, PageHeader, ProgressBar, Segmented, Skeleton, TONE_TEXT } from '../components/ui/primitives';
import { AnimatedNumber, SaidaSuave, SwipeParaPagar } from '../components/ui/motion';
import { EASE_OUT } from '../lib/motion';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { Sheet } from '../components/ui/sheet';
import { ListGroupHeader, TxRow } from '../components/finance/TxRow';
import { DespesaDetailSheet } from '../components/finance/DespesaDetailSheet';
import { FaturaSheet } from '../components/finance/FaturaSheet';
import { PagamentoSheet } from '../components/finance/PagamentoSheet';
import { DespesaFormSheet, type DespesaFormTarget } from '../components/forms/DespesaForm';
import { categoryIcon } from '../lib/categories';
import { agruparFaturas, type Fatura } from '../lib/fatura';
import { cn } from '../lib/cn';
import {
  dateKey, daysInMonth, dueStatus, formatBRL, formatDate, formatDayMonth, MONTHS, parseDateOnly, parseMoney, percent, todayISO,
} from '../lib/format';
import { somaEfetiva, valorEfetivo, type Despesa } from '../lib/types';

interface Filters { q: string; categoria: string; min: string; max: string }
const EMPTY_FILTERS: Filters = { q: '', categoria: '', min: '', max: '' };

const sum = (arr: Despesa[]) => arr.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
const byDue = (a: Despesa, b: Despesa) => dateKey(a.data_vencimento).localeCompare(dateKey(b.data_vencimento));

/** Linha da lista: uma conta avulsa ou a fatura inteira de um cartão. */
type Linha =
  | { kind: 'despesa'; key: string; venc: string; valor: number; d: Despesa }
  | { kind: 'fatura'; key: string; venc: string; valor: number; f: Fatura };

export default function Pagamentos() {
  const now = new Date();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const actions = useDespesaActions();
  const { somenteLeitura } = useEspaco();
  const toque = useMediaQuery('(pointer: coarse)');

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<'pendentes' | 'pagas'>('pendentes');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detail, setDetail] = useState<Despesa | null>(null);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [editTarget, setEditTarget] = useState<DespesaFormTarget | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [pagando, setPagando] = useState<Despesa[] | null>(null);

  const prev = new Date(year, month - 2, 1);
  const despesasQ = useDespesasMes(year, month);
  const prevQ = useDespesasMes(prev.getFullYear(), prev.getMonth() + 1);
  const atrasadasQ = useAtrasadas();
  const modelosQ = useModelos();
  const saldoQ = useSaldo();
  const { data: cartoes = [] } = useCartoes();
  const { data: categorias = [] } = useCategorias('despesa');

  const monthName = MONTHS[month - 1];
  const firstDayKey = `${year}-${String(month).padStart(2, '0')}-01`;

  const view = useMemo(() => {
    const all = despesasQ.data ?? [];
    const min = parseMoney(filters.min);
    const max = parseMoney(filters.max);
    const q = filters.q.trim().toLowerCase();
    const filtered = all.filter((d) => {
      if (q && !d.descricao.toLowerCase().includes(q) && !String(d.valor).includes(q)) return false;
      if (filters.categoria && (d.categoria || 'Outros') !== filters.categoria) return false;
      const v = Number(d.valor);
      if (min > 0 && v < min) return false;
      if (max > 0 && v > max) return false;
      return true;
    });
    const { faturas, avulsas } = agruparFaturas(filtered, cartoes);
    const linhasPend: Linha[] = [
      ...avulsas.filter((d) => !d.pago).map((d): Linha => ({ kind: 'despesa', key: `d:${d.id}`, venc: dateKey(d.data_vencimento), valor: Number(d.valor) || 0, d })),
      ...faturas.filter((f) => !f.paga).map((f): Linha => ({ kind: 'fatura', key: `f:${f.key}`, venc: f.vencimento, valor: f.pendente, f })),
    ].sort((a, b) => a.venc.localeCompare(b.venc));
    const linhasPagas: Linha[] = [
      ...avulsas.filter((d) => d.pago).map((d): Linha => ({ kind: 'despesa', key: `d:${d.id}`, venc: dateKey(d.data_vencimento), valor: valorEfetivo(d), d })),
      ...faturas.filter((f) => f.paga).map((f): Linha => ({ kind: 'fatura', key: `f:${f.key}`, venc: f.vencimento, valor: f.total, f })),
    ].sort((a, b) => a.venc.localeCompare(b.venc));
    return { all, filtered, linhasPend, linhasPagas, pendCount: filtered.filter((d) => !d.pago).length };
  }, [despesasQ.data, filters, cartoes]);

  // Atrasadas de meses anteriores ao que está na tela (as do próprio mês já aparecem na lista)
  const anteriores = (atrasadasQ.data ?? []).filter((d) => !d.pago && dateKey(d.data_vencimento) < firstDayKey).sort(byDue);
  const anterioresTotal = sum(anteriores);

  const pagas = view.all.filter((d) => d.pago);
  const pago = somaEfetiva(pagas);
  const aPagar = sum(view.all.filter((d) => !d.pago));
  const total = pago + aPagar;
  const prevTotal = somaEfetiva(prevQ.data ?? []);
  const diff = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const saldo = saldoQ.data ?? 0;
  const sobra = saldo - aPagar - anterioresTotal;

  const activeFilters = [filters.q, filters.categoria, filters.min, filters.max].filter(Boolean).length;

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of view.all) map.set(d.categoria || 'Outros', (map.get(d.categoria || 'Outros') ?? 0) + valorEfetivo(d));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [view.all]);

  const gerarFixas = useMutation({
    mutationFn: (replace: boolean) => apiFetch('/api/despesas/gerar-fixas', { method: 'POST', body: JSON.stringify({ month, year, replace }) }),
    onSuccess: async (res: { createdCount?: number; receitasCount?: number; jaGeradas?: boolean } | null, replace) => {
      invalidateFinance(qc);
      const n = res?.createdCount ?? 0;
      const r = res?.receitasCount ?? 0;
      if (n === 0 && res?.jaGeradas && !replace) {
        const ok = await confirm({
          title: `As fixas de ${monthName.toLowerCase()} já estão no mês`,
          description: 'Quer recriar as contas fixas pendentes com os valores atuais dos modelos? As que você já pagou não mudam.',
          confirmText: 'Recriar pendentes',
        });
        if (ok) gerarFixas.mutate(true);
        return;
      }
      const partes = [n > 0 && `${n} ${n === 1 ? 'conta fixa' : 'contas fixas'}`, r > 0 && `${r} ${r === 1 ? 'receita recorrente' : 'receitas recorrentes'}`].filter(Boolean);
      toast.success(partes.length ? `${partes.join(' e ')} em ${monthName.toLowerCase()}` : 'Nada novo para gerar neste mês');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível gerar as contas fixas'),
  });

  const handleGerar = () => {
    if ((modelosQ.data ?? []).length === 0) {
      toast('Cadastre um modelo fixo em Despesas para gerar as contas do mês.', { icon: <Info size={18} className="shrink-0 text-info" /> });
      navigate('/despesas?aba=modelos');
      return;
    }
    gerarFixas.mutate(false);
  };

  const loading = despesasQ.isLoading;

  // Pendentes agrupadas por urgência
  const groups = useMemo(() => {
    const buckets: Array<{ key: string; title: string; items: Linha[] }> = [
      { key: 'vencidas', title: 'Vencidas', items: [] },
      { key: 'hoje', title: 'Vencem hoje', items: [] },
      { key: 'semana', title: 'Próximos 7 dias', items: [] },
      { key: 'depois', title: 'Mais adiante', items: [] },
    ];
    for (const l of view.linhasPend) {
      const days = dueStatus(l.venc).days;
      buckets[days < 0 ? 0 : days === 0 ? 1 : days <= 7 ? 2 : 3].items.push(l);
    }
    return buckets.filter((b) => b.items.length > 0);
  }, [view.linhasPend]);

  // ---------------------------------------------------------------- seleção para pagar várias
  const idsDaLinha = (l: Linha) => (l.kind === 'despesa' ? [l.d] : l.f.itens.filter((d) => !d.pago));
  const todasPend = [...view.linhasPend, ...(tab === 'pendentes' ? anteriores.map((d): Linha => ({ kind: 'despesa', key: `d:${d.id}`, venc: dateKey(d.data_vencimento), valor: Number(d.valor) || 0, d })) : [])];
  const selecionadas = todasPend.filter((l) => selecao.has(l.key));
  const totalSelecao = selecionadas.reduce((a, l) => a + l.valor, 0);
  const alternar = (key: string) => setSelecao((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  const sairSelecao = () => { setSelecionando(false); setSelecao(new Set()); };

  const renderLinha = (l: Linha) => {
    const marcada = selecao.has(l.key);
    const check = selecionando ? (
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors', marcada ? 'border-brand bg-brand text-on-brand' : 'border-line-strong')}>
        {marcada && <Check size={14} strokeWidth={3} />}
      </span>
    ) : null;

    if (l.kind === 'fatura') {
      const f = l.f;
      const st = dueStatus(f.vencimento);
      const row = (
        <TxRow
          icon={f.paga ? CircleCheck : CreditCard}
          tone={f.paga ? 'pos' : st.tone === 'neg' ? 'neg' : st.tone === 'warn' ? 'warn' : 'brand'}
          title={<>Fatura {f.cartao.nome}</>}
          subtitle={f.paga ? <span>Paga · {f.itens.length} {f.itens.length === 1 ? 'compra' : 'compras'}</span> : (
            <>
              <span className={cn('shrink-0', TONE_TEXT[st.tone])}>{st.text}</span>
              <span className="truncate text-subtle">· {f.itens.length} {f.itens.length === 1 ? 'compra' : 'compras'}</span>
            </>
          )}
          amount={formatBRL(l.valor)}
          meta={!f.paga && !selecionando && !somenteLeitura ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); setPagando(f.itens.filter((d) => !d.pago)); }} className="h-7 rounded-lg bg-brand/12 px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-on-brand">
              Pagar
            </button>
          ) : check}
          onClick={() => (selecionando && !f.paga ? alternar(l.key) : setFatura(f))}
        />
      );
      return row;
    }

    const d = l.d;
    const st = dueStatus(d.data_vencimento);
    const parcela = d.parcela_atual && Number(d.numero_parcelas) > 1 ? `${d.parcela_atual}/${d.numero_parcelas}` : null;
    const row = (
      <TxRow
        icon={d.pago ? CircleCheck : categoryIcon(d.categoria)}
        tone={d.pago ? 'pos' : st.tone === 'neg' ? 'neg' : st.tone === 'warn' ? 'warn' : 'neutral'}
        title={d.descricao}
        subtitle={
          d.pago ? (
            <span>Paga{d.data_pagamento ? ` em ${formatDayMonth(d.data_pagamento)}` : ''} · venc. {formatDayMonth(d.data_vencimento)}{d.categoria ? ` · ${d.categoria}` : ''}</span>
          ) : (
            <>
              <span className={cn('shrink-0', TONE_TEXT[st.tone])}>{st.text}</span>
              <span className="truncate text-subtle">· {parcela ? `Parcela ${parcela}` : d.categoria || 'Outros'}</span>
            </>
          )
        }
        amount={formatBRL(l.valor)}
        meta={
          selecionando ? check : d.pago || somenteLeitura ? undefined : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actions.pagar(d); }}
              disabled={actions.busyId === d.id}
              className="h-7 rounded-lg bg-brand/12 px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-on-brand disabled:opacity-50"
            >
              Pagar
            </button>
          )
        }
        onClick={() => (selecionando && !d.pago ? alternar(l.key) : setDetail(d))}
      />
    );
    return (
      <SwipeParaPagar disabled={!toque || d.pago || selecionando || somenteLeitura} onPagar={() => actions.pagar(d)}>
        {row}
      </SwipeParaPagar>
    );
  };

  const lista = (linhas: Linha[]) => (
    <div className="divide-y divide-line">
      <AnimatePresence initial={false}>
        {linhas.map((l) => <SaidaSuave key={l.key}>{renderLinha(l)}</SaidaSuave>)}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title="Contas a pagar"
        description="Acompanhe e quite as contas de cada mês."
        actions={<MonthSwitcher year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); sairSelecao(); }} className="w-full lg:w-64" />}
      />

      <div className="grid gap-4 lg:gap-5 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start xl:gap-6">
      <div className="space-y-4 lg:space-y-5 xl:sticky xl:top-8">
      {/* Resumo do mês */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">A pagar em {monthName.toLowerCase()}</p>
            {loading ? <Skeleton className="mt-2 h-9 w-40" /> : (
              <AnimatedNumber value={aPagar} format={(n) => formatBRL(n)} className="mt-1 block text-[30px] font-semibold leading-tight tracking-tight text-fg sm:text-[34px]" />
            )}
          </div>
          {diff !== null && !loading && (
            <span className={cn('mt-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold', diff > 0 ? 'bg-neg/10 text-neg' : 'bg-pos/10 text-pos')}>
              {diff > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              {Math.abs(diff)}% vs. {MONTHS[prev.getMonth()].toLowerCase().slice(0, 3)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
            <span className="text-muted"><span className="font-semibold text-fg tabular-nums">{formatBRL(pago)}</span> pagos de {formatBRL(total)}</span>
            <span className="font-medium text-muted tabular-nums">{percent(pago, total)}%</span>
          </div>
          <ProgressBar value={percent(pago, total)} tone="pos" />
        </div>

        <div className="mt-5 grid divide-y divide-line rounded-xl border border-line bg-bg/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">Saldo atual</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(saldo)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">Atrasadas antes</p>
            <p className={cn('mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base', anterioresTotal > 0 ? 'text-neg' : 'text-fg')}>{formatBRL(anterioresTotal)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">{sobra >= 0 ? 'Vai sobrar' : 'Vai faltar'}</p>
            <p className={cn('mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base', sobra >= 0 ? 'text-pos' : 'text-neg')}>{formatBRL(Math.abs(sobra))}</p>
          </div>
        </div>
      </Card>

      {/* Ações */}
      <div className="flex items-center gap-2">
        {!somenteLeitura && (
          <Button variant="secondary" onClick={handleGerar} isLoading={gerarFixas.isPending} className="flex-1 sm:flex-none xl:flex-1">
            <Repeat size={17} /> Gerar fixas do mês
          </Button>
        )}
        <div className="hidden flex-1 sm:block xl:hidden">
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por descrição ou valor"
            leftIcon={<Search size={17} />}
            className="h-11 bg-surface"
          />
        </div>
        <Button variant="secondary" size="icon" className="h-11 w-11" onClick={() => setCalendarOpen(true)} aria-label="Ver calendário do mês">
          <CalendarDays size={19} />
        </Button>
        <Button variant="secondary" size="icon" className="relative h-11 w-11" onClick={() => setFiltersOpen(true)} aria-label="Filtros">
          <SlidersHorizontal size={19} />
          {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-on-brand">{activeFilters}</span>}
        </Button>
      </div>

      {porCategoria.length > 0 && (
        <Card className="hidden p-5 xl:block">
          <p className="text-[15px] font-semibold text-fg">Por categoria</p>
          <p className="mt-0.5 text-[13px] text-muted">Contas de {monthName.toLowerCase()}</p>
          <ul className="mt-4 space-y-3">
            {porCategoria.map(([nome, valor], i) => {
              const Icon = categoryIcon(nome);
              return (
                <li key={nome}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <Icon size={15} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-fg">{nome}</span>
                    <span className="font-medium tabular-nums text-fg">{formatBRL(valor)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                    <motion.div
                      className="h-full rounded-full bg-brand"
                      initial={{ width: 0 }}
                      animate={{ width: `${(valor / porCategoria[0][1]) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: EASE_OUT }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      </div>

      <div className="min-w-0 space-y-4 lg:space-y-5">
      {activeFilters > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">{view.filtered.length} de {view.all.length} contas com os filtros</span>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 font-medium text-brand"><X size={15} /> Limpar</button>
        </div>
      )}

      <div className="flex items-center gap-2 sm:gap-3">
        <Segmented
          value={tab}
          onChange={(t) => { setTab(t); sairSelecao(); }}
          options={[
            { value: 'pendentes', label: 'Pendentes', count: view.pendCount },
            { value: 'pagas', label: 'Pagas', count: pagas.length },
          ]}
          className="min-w-0 flex-1 sm:w-80 sm:flex-none"
        />
        {tab === 'pendentes' && !somenteLeitura && todasPend.length > 1 && (
          <Button
            variant={selecionando ? 'primary' : 'secondary'}
            size="icon"
            className="h-11 w-11 sm:w-auto sm:px-4"
            onClick={() => (selecionando ? sairSelecao() : setSelecionando(true))}
            aria-label={selecionando ? 'Cancelar seleção' : 'Selecionar várias'}
          >
            {selecionando ? <X size={18} /> : <ListChecks size={18} />}
            <span className="hidden sm:inline">{selecionando ? 'Cancelar' : 'Selecionar'}</span>
          </Button>
        )}
        <div className="ml-auto hidden w-80 xl:block">
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por descrição ou valor"
            leftIcon={<Search size={17} />}
            className="h-11 bg-surface"
          />
        </div>
      </div>

      {toque && tab === 'pendentes' && !selecionando && !somenteLeitura && view.linhasPend.length > 0 && (
        <p className="-mt-1 text-center text-xs text-subtle">Dica: deslize uma conta para a direita para pagar.</p>
      )}

      {/* Atrasadas de meses anteriores */}
      {tab === 'pendentes' && anteriores.length > 0 && (
        <Card className="overflow-hidden border-neg/25">
          <div className="flex items-center gap-3 border-b border-line bg-neg/6 px-4 py-3 sm:px-5">
            <TriangleAlert size={18} className="shrink-0 text-neg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">Atrasadas de meses anteriores</p>
              <p className="text-[13px] text-muted">{anteriores.length} {anteriores.length === 1 ? 'conta' : 'contas'} · {formatBRL(anterioresTotal)}</p>
            </div>
          </div>
          {lista(anteriores.map((d): Linha => ({ kind: 'despesa', key: `d:${d.id}`, venc: dateKey(d.data_vencimento), valor: Number(d.valor) || 0, d })))}
        </Card>
      )}

      {/* Lista */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : tab === 'pendentes' ? (
          groups.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title={view.all.length === 0 ? `Nenhuma conta em ${monthName.toLowerCase()}` : 'Tudo pago'}
              description={view.all.length === 0 ? 'Gere as contas fixas do mês ou adicione uma despesa.' : activeFilters ? 'Nenhuma conta pendente com esses filtros.' : `Nenhuma conta pendente em ${monthName.toLowerCase()}.`}
              action={view.all.length === 0 && !somenteLeitura ? <Button onClick={handleGerar} isLoading={gerarFixas.isPending}><Repeat size={17} /> Gerar fixas do mês</Button> : undefined}
            />
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <ListGroupHeader
                  title={<span className={g.key === 'vencidas' ? 'text-neg' : g.key === 'hoje' ? 'text-warn' : ''}>{g.title} · {g.items.length}</span>}
                  aside={formatBRL(g.items.reduce((a, l) => a + l.valor, 0))}
                />
                {lista(g.items)}
              </div>
            ))
          )
        ) : view.linhasPagas.length === 0 ? (
          <EmptyState icon={CircleCheck} title="Nenhuma conta paga ainda" description={`As contas que você pagar em ${monthName.toLowerCase()} aparecem aqui.`} />
        ) : (
          lista(view.linhasPagas)
        )}
      </Card>
      </div>
      </div>

      {/* Barra da seleção: fica acima da navegação inferior no celular */}
      {createPortal(
        <AnimatePresence>
          {selecionando && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 lg:bottom-6 lg:left-[calc(16rem+2rem)] lg:right-8"
            >
              <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-pop">
                <IconTile icon={ListChecks} tone="brand" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{selecionadas.length} {selecionadas.length === 1 ? 'selecionada' : 'selecionadas'}</p>
                  <p className="text-[13px] tabular-nums text-muted">{formatBRL(totalSelecao)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelecao(selecao.size === todasPend.length ? new Set() : new Set(todasPend.map((l) => l.key)))}>
                  {selecao.size === todasPend.length ? 'Nenhuma' : 'Todas'}
                </Button>
                <Button size="md" disabled={selecionadas.length === 0} onClick={() => setPagando(selecionadas.flatMap(idsDaLinha))}>
                  Pagar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Filtros */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar contas"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar</Button>
            <Button size="lg" className="flex-[2]" onClick={() => setFiltersOpen(false)}>Ver {view.filtered.length} contas</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Buscar" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Descrição ou valor" leftIcon={<Search size={17} />} />
          <Select label="Categoria" value={filters.categoria} onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor mínimo" value={filters.min} onChange={(v) => setFilters((f) => ({ ...f, min: v }))} />
            <MoneyInput label="Valor máximo" value={filters.max} onChange={(v) => setFilters((f) => ({ ...f, max: v }))} />
          </div>
        </div>
      </Sheet>

      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        year={year}
        month={month}
        despesas={view.all}
        onSelect={(d) => { setCalendarOpen(false); setDetail(d); }}
      />

      <DespesaDetailSheet despesa={detail} onClose={() => setDetail(null)} onEdit={(d) => setEditTarget({ despesa: d })} />
      <FaturaSheet fatura={fatura} onClose={() => setFatura(null)} onOpenDespesa={(d) => { setFatura(null); setDetail(d); }} />
      <PagamentoSheet
        despesas={pagando}
        title={pagando && pagando.length > 1 ? `Pagar ${pagando.length} contas` : undefined}
        onClose={() => setPagando(null)}
        onPaid={sairSelecao}
      />
      <DespesaFormSheet open={!!editTarget} target={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}

function CalendarSheet({ open, onClose, year, month, despesas, onSelect }: {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  despesas: Despesa[];
  onSelect: (d: Despesa) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayISO();
  const offset = new Date(year, month - 1, 1).getDay();
  const days = daysInMonth(year, month);

  const byDay = useMemo(() => {
    const map = new Map<string, Despesa[]>();
    for (const d of despesas) {
      const k = dateKey(d.data_vencimento);
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return map;
  }, [despesas]);

  const selectedItems = selected ? byDay.get(selected) ?? [] : [];

  return (
    <Sheet open={open} onClose={onClose} title={`${MONTHS[month - 1]} ${year}`} description="Toque em um dia para ver as contas." size="md">
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => (
          <span key={i} className="pb-1 text-xs font-medium text-subtle">{w}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const key = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const items = byDay.get(key) ?? [];
          const pend = items.some((x) => !x.pago);
          const paid = items.length > 0 && !pend;
          const late = pend && key < today;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium tabular-nums transition-colors',
                selected === key ? 'bg-brand text-on-brand' : 'text-fg hover:bg-elevated',
                key === today && selected !== key && 'ring-1 ring-brand/60',
              )}
            >
              {i + 1}
              {items.length > 0 && (
                <span className={cn(
                  'absolute bottom-1.5 h-1.5 w-1.5 rounded-full',
                  selected === key ? 'bg-on-brand' : late ? 'bg-neg' : pend ? 'bg-warn' : paid ? 'bg-pos' : '',
                )} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warn" />Pendente</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-neg" />Atrasada</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-pos" />Paga</span>
      </div>

      {selected && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-fg">{formatDate(selected)} · {parseDateOnly(selected)?.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
          {selectedItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-subtle">Nenhuma conta neste dia</p>
          ) : (
            <div className="-mx-5 divide-y divide-line border-y border-line sm:-mx-6">
              {selectedItems.map((d) => (
                <TxRow
                  key={d.id}
                  icon={d.pago ? CircleCheck : categoryIcon(d.categoria)}
                  tone={d.pago ? 'pos' : 'neutral'}
                  title={d.descricao}
                  subtitle={d.pago ? 'Paga' : d.categoria || 'Outros'}
                  amount={formatBRL(d.pago ? valorEfetivo(d) : d.valor)}
                  onClick={() => onSelect(d)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
