import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowDownLeft, ArrowUp, CalendarClock, ChevronDown, Plus, Repeat, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiFetch } from '../services/api';
import { invalidateFinance, useCategorias, useContas, useReceitas, useRecorrentes } from '../hooks/queries';
import { useEspaco } from '../contexts/EspacoContext';
import { AnimatedNumber, SaidaSuave } from '../components/ui/motion';
import { Badge, Switch } from '../components/ui/primitives';
import { useQuickActions } from '../components/layout/AppShell';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input, MoneyInput, Select } from '../components/ui/input';
import { Card, EmptyState, PageHeader, Skeleton } from '../components/ui/primitives';
import { Sheet } from '../components/ui/sheet';
import { ListGroupHeader, TxRow } from '../components/finance/TxRow';
import { ReceitaFormSheet } from '../components/forms/ReceitaForm';
import { categoryIcon } from '../lib/categories';
import { cn } from '../lib/cn';
import { dateKey, dueStatus, formatBRL, formatDayMonth, MONTHS, parseMoney, todayISO, toMoneyInput } from '../lib/format';
import type { Receita, ReceitaRecorrente } from '../lib/types';

interface Filters { categoria: string; de: string; ate: string; min: string; max: string }
const EMPTY: Filters = { categoria: '', de: '', ate: '', min: '', max: '' };

const sum = (arr: Receita[]) => arr.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function Receitas() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [months, setMonths] = useState(6);
  const [editing, setEditing] = useState<Receita | null>(null);
  const [editRec, setEditRec] = useState<ReceitaRecorrente | null>(null);
  const [novaRec, setNovaRec] = useState(false);
  const [recebendo, setRecebendo] = useState<Receita | null>(null);
  const { somenteLeitura } = useEspaco();
  const { newReceita } = useQuickActions();
  const confirm = useConfirm();
  const qc = useQueryClient();

  // A busca global abre esta tela com ?q=...
  const qParam = params.get('q');
  const [lastQParam, setLastQParam] = useState(qParam);
  if (qParam !== lastQParam) {
    setLastQParam(qParam);
    if (qParam !== null) setQ(qParam);
  }

  const receitasQ = useReceitas();
  const { data: categorias = [] } = useCategorias('receita');
  const recorrentesQ = useRecorrentes();
  // O que ainda vai entrar fica separado do que já entrou
  const all = useMemo(() => (receitasQ.data ?? []).filter((r) => !r.pendente), [receitasQ.data]);
  const aReceber = useMemo(
    () => (receitasQ.data ?? []).filter((r) => r.pendente).sort((a, b) => dateKey(a.data_recebimento).localeCompare(dateKey(b.data_recebimento))),
    [receitasQ.data],
  );
  const recorrentes = recorrentesQ.data ?? [];

  const toggleRec = useMutation({
    mutationFn: (r: ReceitaRecorrente) => apiFetch(`/api/recorrentes/${r.id}`, { method: 'PUT', body: JSON.stringify({ ...r, ativo: !r.ativo }) }),
    onSuccess: () => invalidateFinance(qc),
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  const removeRec = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/recorrentes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Receita recorrente excluída');
      setEditRec(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível excluir'),
  });

  const askDeleteRec = async (r: ReceitaRecorrente) => {
    const ok = await confirm({
      title: 'Excluir receita recorrente?',
      description: <><strong className="text-fg">{r.descricao}</strong> deixa de entrar nos próximos meses. O que já foi lançado continua.</>,
      confirmText: 'Excluir',
      danger: true,
    });
    if (ok) removeRec.mutate(r.id);
  };

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/receitas/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Receita excluída');
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível excluir'),
  });

  const askDelete = async (r: Receita) => {
    const ok = await confirm({
      title: 'Excluir receita?',
      description: <><strong className="text-fg">{r.descricao}</strong> ({formatBRL(r.valor)}) será apagada e sairá do seu saldo.</>,
      confirmText: 'Excluir',
      danger: true,
    });
    if (ok) remove.mutate(r.id);
  };

  // Resumo: este mês, mês anterior, ano e média dos últimos 12 meses
  const kpis = useMemo(() => {
    const now = new Date();
    const thisKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const startKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    const yearPrefix = `${now.getFullYear()}-`;
    const mes = sum(all.filter((r) => dateKey(r.data_recebimento).startsWith(thisKey)));
    const anterior = sum(all.filter((r) => dateKey(r.data_recebimento).startsWith(prevKey)));
    const ano = sum(all.filter((r) => dateKey(r.data_recebimento).startsWith(yearPrefix)));
    const ultimos12 = all.filter((r) => {
      const k = dateKey(r.data_recebimento).slice(0, 7);
      return k >= startKey && k <= thisKey;
    });
    const mesesComEntrada = new Set(ultimos12.map((r) => dateKey(r.data_recebimento).slice(0, 7))).size;
    return {
      mes,
      anterior,
      ano,
      media: mesesComEntrada ? sum(ultimos12) / mesesComEntrada : 0,
      diff: anterior > 0 ? Math.round(((mes - anterior) / anterior) * 100) : null,
      mesNome: MONTHS[now.getMonth()].toLowerCase(),
      anteriorNome: MONTHS[(now.getMonth() + 11) % 12].toLowerCase(),
    };
  }, [all]);

  const porCategoria = useMemo(() => {
    const prefix = `${new Date().getFullYear()}-`;
    const map = new Map<string, number>();
    for (const r of all) {
      if (!dateKey(r.data_recebimento).startsWith(prefix)) continue;
      map.set(r.categoria || 'Outros', (map.get(r.categoria || 'Outros') ?? 0) + (Number(r.valor) || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [all]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const min = parseMoney(filters.min);
    const max = parseMoney(filters.max);
    return all.filter((r) => {
      if (t && !r.descricao.toLowerCase().includes(t) && !String(r.valor).includes(t)) return false;
      if (filters.categoria && (r.categoria || 'Outros') !== filters.categoria) return false;
      const k = dateKey(r.data_recebimento);
      if (filters.de && k < filters.de) return false;
      if (filters.ate && k > filters.ate) return false;
      const v = Number(r.valor);
      if (min > 0 && v < min) return false;
      if (max > 0 && v > max) return false;
      return true;
    });
  }, [all, q, filters]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Receita[]>();
    for (const r of filtered) {
      const k = dateKey(r.data_recebimento).slice(0, 7) || 'sem-data';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({ key, items: items.sort((a, b) => dateKey(b.data_recebimento).localeCompare(dateKey(a.data_recebimento))) }));
  }, [filtered]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const monthTitle = (key: string) => {
    if (key === 'sem-data') return 'Sem data';
    const [y, m] = key.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        desktopOnly
        title="Receitas"
        description="Tudo o que entrou na sua conta."
        actions={<div className="hidden lg:block"><Button onClick={newReceita}><Plus size={18} /> Nova receita</Button></div>}
      />

      <div className="grid gap-4 lg:gap-5 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start xl:gap-6">
      <div className="space-y-4 lg:space-y-5 xl:sticky xl:top-8">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Recebido em {kpis.mesNome}</p>
            {receitasQ.isLoading ? <Skeleton className="mt-2 h-9 w-40" /> : (
              <AnimatedNumber value={kpis.mes} format={(n) => formatBRL(n)} className="mt-1 block text-[30px] font-semibold leading-tight tracking-tight text-fg sm:text-[34px]" />
            )}
          </div>
          {kpis.diff !== null && (
            <span className={cn('mt-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold', kpis.diff >= 0 ? 'bg-pos/10 text-pos' : 'bg-neg/10 text-neg')}>
              {kpis.diff >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              {Math.abs(kpis.diff)}% vs. {kpis.anteriorNome.slice(0, 3)}
            </span>
          )}
        </div>
        <div className="mt-5 grid divide-y divide-line rounded-xl border border-line bg-bg/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">Mês anterior</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(kpis.anterior)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">Neste ano</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(kpis.ano)}</p>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3 xl:flex xl:px-3 xl:py-2.5">
            <p className="truncate text-[13px] text-muted sm:text-xs xl:text-[13px]">Média mensal</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(kpis.media)}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-fg">Recorrentes</p>
            <p className="text-[13px] text-muted">Entram sozinhas todo mês, como "a receber"</p>
          </div>
          {!somenteLeitura && (
            <Button variant="secondary" size="sm" onClick={() => setNovaRec(true)}><Plus size={15} /> Nova</Button>
          )}
        </div>
        {recorrentes.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-subtle sm:px-5">Cadastre salário, pró-labore ou aluguel recebido para não digitar todo mês.</p>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {recorrentes.map((r) => (
              <TxRow
                key={r.id}
                icon={Repeat}
                tone={r.ativo ? 'pos' : 'neutral'}
                title={r.descricao}
                subtitle={<span>Todo dia {r.dia} · {r.categoria || 'Outros'}</span>}
                amount={formatBRL(r.valor)}
                amountTone={r.ativo ? 'pos' : 'fg'}
                dim={!r.ativo}
                meta={!somenteLeitura ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch checked={r.ativo} onChange={() => toggleRec.mutate(r)} label={r.ativo ? 'Pausar' : 'Reativar'} />
                  </span>
                ) : undefined}
                onClick={somenteLeitura ? undefined : () => setEditRec(r)}
              />
            ))}
          </div>
        )}
      </Card>

      {porCategoria.length > 0 && (
        <Card className="hidden p-5 xl:block">
          <p className="text-[15px] font-semibold text-fg">De onde veio</p>
          <p className="mt-0.5 text-[13px] text-muted">Receitas de {new Date().getFullYear()} por categoria</p>
          <ul className="mt-4 space-y-3">
            {porCategoria.map(([nome, valor]) => {
              const Icon = categoryIcon(nome);
              return (
                <li key={nome}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <Icon size={15} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-fg">{nome}</span>
                    <span className="font-medium tabular-nums text-fg">{formatBRL(valor)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-pos" style={{ width: `${(valor / porCategoria[0][1]) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      </div>

      <div className="min-w-0 space-y-4 lg:space-y-5">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descrição ou valor"
          leftIcon={<Search size={17} />}
          className="h-11 bg-surface"
        />
        <Button variant="secondary" size="icon" className="relative h-11 w-11" onClick={() => setFiltersOpen(true)} aria-label="Filtros">
          <SlidersHorizontal size={19} />
          {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-on-brand">{activeFilters}</span>}
        </Button>
      </div>

      {aReceber.length > 0 && (
        <Card className="overflow-hidden border-info/25">
          <div className="flex items-center gap-3 border-b border-line bg-info/6 px-4 py-3 sm:px-5">
            <CalendarClock size={18} className="shrink-0 text-info" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">A receber</p>
              <p className="text-[13px] text-muted">{aReceber.length} {aReceber.length === 1 ? 'entrada prevista' : 'entradas previstas'} · {formatBRL(sum(aReceber))}</p>
            </div>
          </div>
          <div className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {aReceber.map((r) => {
                const st = dueStatus(r.data_recebimento);
                return (
                  <SaidaSuave key={r.id}>
                    <TxRow
                      icon={categoryIcon(r.categoria)}
                      tone="info"
                      title={r.descricao}
                      subtitle={<span className={st.days < 0 ? 'text-warn' : ''}>{st.days < 0 ? `Prevista para ${formatDayMonth(r.data_recebimento)} · atrasada` : st.days === 0 ? 'Prevista para hoje' : `Prevista para ${formatDayMonth(r.data_recebimento)}`}</span>}
                      amount={formatBRL(r.valor)}
                      meta={!somenteLeitura ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setRecebendo(r); }}
                          className="h-7 rounded-lg bg-pos/12 px-2.5 text-xs font-semibold text-pos transition-colors hover:bg-pos hover:text-white"
                        >
                          Recebi
                        </button>
                      ) : undefined}
                      onClick={() => setEditing(r)}
                    />
                  </SaidaSuave>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      )}

      {(activeFilters > 0 || q) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">{filtered.length} receitas · {formatBRL(sum(filtered))}</span>
          <button type="button" onClick={() => { setFilters(EMPTY); setQ(''); }} className="flex items-center gap-1 font-medium text-brand"><X size={15} /> Limpar</button>
        </div>
      )}

      <Card className="overflow-hidden">
        {receitasQ.isLoading ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : byMonth.length === 0 ? (
          <EmptyState
            icon={ArrowDownLeft}
            title={all.length === 0 ? 'Nenhuma receita ainda' : 'Nada encontrado'}
            description={all.length === 0 ? 'Registre salário, vendas e outras entradas.' : 'Tente outros termos ou limpe os filtros.'}
            action={all.length === 0 ? <Button onClick={newReceita}><Plus size={17} /> Nova receita</Button> : undefined}
          />
        ) : (
          <>
            {byMonth.slice(0, months).map((m) => (
              <div key={m.key}>
                <ListGroupHeader title={monthTitle(m.key)} aside={<span className="text-pos">+ {formatBRL(sum(m.items))}</span>} />
                <div className="divide-y divide-line">
                  {m.items.map((r) => (
                    <TxRow
                      key={r.id}
                      icon={categoryIcon(r.categoria)}
                      tone="pos"
                      title={r.descricao}
                      subtitle={<>{formatDayMonth(r.data_recebimento)} · {r.categoria || 'Outros'}</>}
                      amount={`+ ${formatBRL(r.valor)}`}
                      amountTone="pos"
                      onClick={() => setEditing(r)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {byMonth.length > months && (
              <button type="button" onClick={() => setMonths((n) => n + 6)} className="flex h-12 w-full items-center justify-center gap-1.5 border-t border-line text-sm font-medium text-brand hover:bg-elevated/60">
                <ChevronDown size={16} /> Mostrar meses anteriores
              </button>
            )}
          </>
        )}
      </Card>
      </div>
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar receitas"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setFilters(EMPTY)}>Limpar</Button>
            <Button size="lg" className="flex-[2]" onClick={() => setFiltersOpen(false)}>Ver {filtered.length} receitas</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Categoria" value={filters.categoria} onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Recebida de" type="date" value={filters.de} onChange={(e) => setFilters((f) => ({ ...f, de: e.target.value }))} />
            <Input label="até" type="date" value={filters.ate} onChange={(e) => setFilters((f) => ({ ...f, ate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor mínimo" value={filters.min} onChange={(v) => setFilters((f) => ({ ...f, min: v }))} />
            <MoneyInput label="Valor máximo" value={filters.max} onChange={(v) => setFilters((f) => ({ ...f, max: v }))} />
          </div>
        </div>
      </Sheet>

      <ReceitaFormSheet
        open={!!editing}
        receita={editing}
        onClose={() => setEditing(null)}
        onDelete={editing && !somenteLeitura ? () => askDelete(editing) : undefined}
      />
      <ReceitaFormSheet
        open={!!editRec || novaRec}
        recorrente={editRec}
        onClose={() => { setEditRec(null); setNovaRec(false); }}
        onDelete={editRec ? () => askDeleteRec(editRec) : undefined}
      />
      <ReceberSheet receita={recebendo} onClose={() => setRecebendo(null)} />
    </div>
  );
}

/** Confirma que uma receita prevista entrou: data, valor e conta reais. */
function ReceberSheet({ receita, onClose }: { receita: Receita | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: contas = [] } = useContas();
  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState('');
  const [conta, setConta] = useState('');
  const [ultima, setUltima] = useState<string | null>(null);

  // Ao abrir outra receita, os campos voltam aos valores dela
  if (receita && receita.id !== ultima) {
    setUltima(receita.id);
    setData(todayISO());
    setValor(toMoneyInput(receita.valor));
    setConta(receita.conta_id ?? '');
  }

  const salvar = useMutation({
    mutationFn: () => apiFetch(`/api/receitas/${receita!.id}/receber`, {
      method: 'PATCH',
      body: JSON.stringify({ data, valor: parseMoney(valor) || undefined, conta_id: conta || null }),
    }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Recebimento confirmado');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível confirmar'),
  });

  return (
    <Sheet
      open={!!receita}
      onClose={onClose}
      title="Confirmar recebimento"
      description={receita?.descricao}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" isLoading={salvar.isPending} onClick={() => salvar.mutate()}>Confirmar</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <MoneyInput size="lg" label="Valor recebido" value={valor} onChange={setValor} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Select label="Entrou na conta" value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Não informar</option>
            {contas.filter((c) => c.ativo || c.id === conta).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </div>
        {receita?.recorrente_id && <Badge tone="info"><Repeat size={12} /> Receita recorrente</Badge>}
      </div>
    </Sheet>
  );
}
