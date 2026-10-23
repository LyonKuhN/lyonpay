import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowDown, ArrowUp, CalendarDays, CircleCheck, Info, Repeat, Search, SlidersHorizontal, TriangleAlert, X,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { invalidateFinance, useAtrasadas, useCategorias, useDespesasMes, useModelos, useSaldo } from '../hooks/queries';
import { useDespesaActions } from '../hooks/useDespesaActions';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input, MoneyInput, Select } from '../components/ui/input';
import { Card, EmptyState, PageHeader, ProgressBar, Segmented, Skeleton, TONE_TEXT } from '../components/ui/primitives';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { Sheet } from '../components/ui/sheet';
import { ListGroupHeader, TxRow } from '../components/finance/TxRow';
import { DespesaDetailSheet } from '../components/finance/DespesaDetailSheet';
import { DespesaFormSheet, type DespesaFormTarget } from '../components/forms/DespesaForm';
import { categoryIcon } from '../lib/categories';
import { cn } from '../lib/cn';
import {
  dateKey, daysInMonth, dueStatus, formatBRL, formatDate, formatDayMonth, MONTHS, parseDateOnly, parseMoney, percent, todayISO,
} from '../lib/format';
import type { Despesa } from '../lib/types';

interface Filters { q: string; categoria: string; min: string; max: string }
const EMPTY_FILTERS: Filters = { q: '', categoria: '', min: '', max: '' };

const sum = (arr: Despesa[]) => arr.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
const byDue = (a: Despesa, b: Despesa) => dateKey(a.data_vencimento).localeCompare(dateKey(b.data_vencimento));

export default function Pagamentos() {
  const now = new Date();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const actions = useDespesaActions();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<'pendentes' | 'pagas'>('pendentes');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detail, setDetail] = useState<Despesa | null>(null);
  const [editTarget, setEditTarget] = useState<DespesaFormTarget | null>(null);

  const prev = new Date(year, month - 2, 1);
  const despesasQ = useDespesasMes(year, month);
  const prevQ = useDespesasMes(prev.getFullYear(), prev.getMonth() + 1);
  const atrasadasQ = useAtrasadas();
  const modelosQ = useModelos();
  const saldoQ = useSaldo();
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
    const pendentes = filtered.filter((d) => !d.pago).sort(byDue);
    const pagas = filtered.filter((d) => d.pago).sort(byDue);
    return { all, pendentes, pagas, filtered };
  }, [despesasQ.data, filters]);

  // Atrasadas de meses anteriores ao que está na tela (as do próprio mês já aparecem na lista)
  const anteriores = (atrasadasQ.data ?? []).filter((d) => !d.pago && dateKey(d.data_vencimento) < firstDayKey);
  const anterioresTotal = sum(anteriores);

  const total = sum(view.all);
  const pago = sum(view.all.filter((d) => d.pago));
  const aPagar = total - pago;
  const prevTotal = sum(prevQ.data ?? []);
  const diff = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const saldo = saldoQ.data ?? 0;
  const sobra = saldo - aPagar - anterioresTotal;

  const activeFilters = [filters.q, filters.categoria, filters.min, filters.max].filter(Boolean).length;

  const gerarFixas = useMutation({
    mutationFn: (replace: boolean) => apiFetch('/api/despesas/gerar-fixas', { method: 'POST', body: JSON.stringify({ month, year, replace }) }),
    onSuccess: (res: { createdCount?: number } | null) => {
      invalidateFinance(qc);
      const n = res?.createdCount ?? 0;
      toast.success(n === 0 ? 'Todas as contas fixas já estavam no mês' : `${n} ${n === 1 ? 'conta fixa gerada' : 'contas fixas geradas'} em ${monthName.toLowerCase()}`);
    },
    onError: async (err: Error & { promptReplace?: boolean }) => {
      if (!err.promptReplace) return toast.error(err.message || 'Não foi possível gerar as contas fixas');
      const ok = await confirm({
        title: `As fixas de ${monthName.toLowerCase()} já foram geradas`,
        description: 'Quer gerar de novo? As contas fixas pendentes do mês serão recriadas com os valores atuais dos modelos. As que você já pagou não mudam.',
        confirmText: 'Gerar de novo',
      });
      if (ok) gerarFixas.mutate(true);
    },
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
    const buckets: Array<{ key: string; title: string; items: Despesa[] }> = [
      { key: 'vencidas', title: 'Vencidas', items: [] },
      { key: 'hoje', title: 'Vencem hoje', items: [] },
      { key: 'semana', title: 'Próximos 7 dias', items: [] },
      { key: 'depois', title: 'Mais adiante', items: [] },
    ];
    for (const d of view.pendentes) {
      const days = dueStatus(d.data_vencimento).days;
      buckets[days < 0 ? 0 : days === 0 ? 1 : days <= 7 ? 2 : 3].items.push(d);
    }
    return buckets.filter((b) => b.items.length > 0);
  }, [view.pendentes]);

  const renderRow = (d: Despesa) => {
    const st = dueStatus(d.data_vencimento);
    const parcela = d.parcela_atual && Number(d.numero_parcelas) > 1 ? `${d.parcela_atual}/${d.numero_parcelas}` : null;
    return (
      <TxRow
        key={d.id}
        icon={d.pago ? CircleCheck : categoryIcon(d.categoria)}
        tone={d.pago ? 'pos' : st.tone === 'neg' ? 'neg' : st.tone === 'warn' ? 'warn' : 'neutral'}
        title={d.descricao}
        subtitle={
          d.pago ? (
            <span>Paga · venc. {formatDayMonth(d.data_vencimento)}{d.categoria ? ` · ${d.categoria}` : ''}</span>
          ) : (
            <>
              <span className={cn('shrink-0', TONE_TEXT[st.tone])}>{st.text}</span>
              <span className="truncate text-subtle">· {parcela ? `Parcela ${parcela}` : d.categoria || 'Outros'}</span>
            </>
          )
        }
        amount={formatBRL(d.valor)}
        meta={
          d.pago ? undefined : (
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
        onClick={() => setDetail(d)}
      />
    );
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title="Contas a pagar"
        description="Acompanhe e quite as contas de cada mês."
        actions={<MonthSwitcher year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} className="w-full lg:w-64" />}
      />

      {/* Resumo do mês */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">A pagar em {monthName.toLowerCase()}</p>
            {loading ? <Skeleton className="mt-2 h-9 w-40" /> : (
              <p className="mt-1 text-[30px] font-semibold leading-tight tracking-tight tabular-nums text-fg sm:text-[34px]">{formatBRL(aPagar)}</p>
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

        <div className="mt-5 grid divide-y divide-line rounded-xl border border-line bg-bg/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3">
            <p className="truncate text-[13px] text-muted sm:text-xs">Saldo atual</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(saldo)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3">
            <p className="truncate text-[13px] text-muted sm:text-xs">Atrasadas antes</p>
            <p className={cn('mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base', anterioresTotal > 0 ? 'text-neg' : 'text-fg')}>{formatBRL(anterioresTotal)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3">
            <p className="truncate text-[13px] text-muted sm:text-xs">{sobra >= 0 ? 'Vai sobrar' : 'Vai faltar'}</p>
            <p className={cn('mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base', sobra >= 0 ? 'text-pos' : 'text-neg')}>{formatBRL(Math.abs(sobra))}</p>
          </div>
        </div>
      </Card>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={handleGerar} isLoading={gerarFixas.isPending} className="flex-1 sm:flex-none">
          <Repeat size={17} /> Gerar fixas do mês
        </Button>
        <div className="hidden flex-1 sm:block">
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

      {activeFilters > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">{view.filtered.length} de {view.all.length} contas com os filtros</span>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="flex items-center gap-1 font-medium text-brand"><X size={15} /> Limpar</button>
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pendentes', label: 'Pendentes', count: view.pendentes.length },
          { value: 'pagas', label: 'Pagas', count: view.pagas.length },
        ]}
        className="sm:w-80"
      />

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
          <div className="divide-y divide-line">{anteriores.map(renderRow)}</div>
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
              action={view.all.length === 0 ? <Button onClick={handleGerar} isLoading={gerarFixas.isPending}><Repeat size={17} /> Gerar fixas do mês</Button> : undefined}
            />
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <ListGroupHeader
                  title={<span className={g.key === 'vencidas' ? 'text-neg' : g.key === 'hoje' ? 'text-warn' : ''}>{g.title} · {g.items.length}</span>}
                  aside={formatBRL(sum(g.items))}
                />
                <div className="divide-y divide-line">{g.items.map(renderRow)}</div>
              </div>
            ))
          )
        ) : view.pagas.length === 0 ? (
          <EmptyState icon={CircleCheck} title="Nenhuma conta paga ainda" description={`As contas que você pagar em ${monthName.toLowerCase()} aparecem aqui.`} />
        ) : (
          <div className="divide-y divide-line">{view.pagas.map(renderRow)}</div>
        )}
      </Card>

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
                  amount={formatBRL(d.valor)}
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
