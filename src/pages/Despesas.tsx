import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, Bookmark, ChevronDown, CircleCheck, Layers, Plus, Repeat, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { useCategorias, useDespesas, useModelos } from '../hooks/queries';
import { useDespesaActions } from '../hooks/useDespesaActions';
import { useQuickActions } from '../components/layout/AppShell';
import { Button } from '../components/ui/button';
import { Input, MoneyInput, Select } from '../components/ui/input';
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, Skeleton, TONE_TEXT } from '../components/ui/primitives';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { Sheet } from '../components/ui/sheet';
import { ListGroupHeader, TxRow } from '../components/finance/TxRow';
import { DespesaDetailSheet } from '../components/finance/DespesaDetailSheet';
import { DespesaFormSheet, type DespesaFormTarget } from '../components/forms/DespesaForm';
import { categoryIcon, CHART_COLORS } from '../lib/categories';
import { cn } from '../lib/cn';
import {
  dateKey, dueStatus, formatBRL, formatDate, formatDayMonth, MONTHS, parseDateOnly, parseMoney, percent,
} from '../lib/format';
import { normalizeTipo, TIPO_LABEL, type Despesa, type TipoDespesa } from '../lib/types';

type Aba = 'lancamentos' | 'analise' | 'modelos';

interface Filters {
  categoria: string;
  tipo: '' | TipoDespesa;
  status: '' | 'pendente' | 'paga';
  de: string;
  ate: string;
  min: string;
  max: string;
}
const EMPTY: Filters = { categoria: '', tipo: '', status: '', de: '', ate: '', min: '', max: '' };

interface Group {
  id: string;
  nome: string;
  items: Despesa[];
  pagas: number;
  total: number;
  pago: number;
  proxima?: Despesa;
  categoria?: string | null;
}

const sum = (arr: Despesa[]) => arr.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);
const stripParcela = (d: string) => d.replace(/\s*\(\d+\/\d+\)$/, '');

export default function Despesas() {
  const [params, setParams] = useSearchParams();
  const [aba, setAba] = useState<Aba>(params.get('aba') === 'modelos' ? 'modelos' : 'lancamentos');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [months, setMonths] = useState(6);
  const [detail, setDetail] = useState<Despesa | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<DespesaFormTarget | null>(null);
  const { newDespesa } = useQuickActions();
  const actions = useDespesaActions();

  // A busca global abre esta tela com ?q=...; mantém o campo em sincronia.
  const qParam = params.get('q');
  const [lastQParam, setLastQParam] = useState(qParam);
  if (qParam !== lastQParam) {
    setLastQParam(qParam);
    if (qParam !== null) {
      setQ(qParam);
      setAba('lancamentos');
    }
  }

  const changeAba = (a: Aba) => {
    setAba(a);
    const next = new URLSearchParams(params);
    next.delete('q');
    if (a === 'modelos') next.set('aba', 'modelos');
    else next.delete('aba');
    setParams(next, { replace: true });
  };

  const despesasQ = useDespesas();
  const modelosQ = useModelos();
  const { data: categorias = [] } = useCategorias('despesa');
  const all = useMemo(() => despesasQ.data ?? [], [despesasQ.data]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Despesa[]>();
    for (const d of all) if (d.group_id) map.set(d.group_id, [...(map.get(d.group_id) ?? []), d]);
    return [...map.entries()].map(([id, items]) => {
      const sorted = [...items].sort((a, b) => (a.parcela_atual ?? 0) - (b.parcela_atual ?? 0));
      const pagasItems = sorted.filter((x) => x.pago);
      return {
        id,
        nome: stripParcela(sorted[0].descricao),
        items: sorted,
        pagas: pagasItems.length,
        total: sum(sorted),
        pago: sum(pagasItems),
        proxima: sorted.find((x) => !x.pago),
        categoria: sorted[0].categoria,
      };
    }).sort((a, b) => Number(!a.proxima) - Number(!b.proxima) || dateKey(a.proxima?.data_vencimento).localeCompare(dateKey(b.proxima?.data_vencimento)));
  }, [all]);

  const matches = (d: Despesa, text: string) => {
    const t = text.trim().toLowerCase();
    if (t && !d.descricao.toLowerCase().includes(t) && !(d.observacoes || '').toLowerCase().includes(t) && !String(d.valor).includes(t)) return false;
    if (filters.categoria && (d.categoria || 'Outros') !== filters.categoria) return false;
    if (filters.tipo && normalizeTipo(d.tipo) !== filters.tipo) return false;
    if (filters.status === 'paga' && !d.pago) return false;
    if (filters.status === 'pendente' && d.pago) return false;
    const k = dateKey(d.data_vencimento);
    if (filters.de && k < filters.de) return false;
    if (filters.ate && k > filters.ate) return false;
    const v = Number(d.valor);
    const min = parseMoney(filters.min);
    const max = parseMoney(filters.max);
    if (min > 0 && v < min) return false;
    if (max > 0 && v > max) return false;
    return true;
  };

  const filteredGroups = groups.filter((g) => g.items.some((d) => matches(d, q)));
  const singles = all.filter((d) => !d.group_id && matches(d, q));

  const byMonth = useMemo(() => {
    const map = new Map<string, Despesa[]>();
    for (const d of singles) {
      const k = dateKey(d.data_vencimento).slice(0, 7) || 'sem-data';
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, items]) => ({ key: k, items: items.sort((a, b) => dateKey(b.data_vencimento).localeCompare(dateKey(a.data_vencimento))) }));
  }, [singles]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const currentGroup = groups.find((g) => g.id === groupId) ?? null;
  const loading = despesasQ.isLoading;

  const monthTitle = (key: string) => {
    if (key === 'sem-data') return 'Sem data';
    const [y, m] = key.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        desktopOnly
        title="Despesas"
        description="Todos os seus gastos, parcelamentos e contas fixas."
        actions={
          <div className="hidden lg:block">
            <Button onClick={() => (aba === 'modelos' ? newDespesa('fixa') : newDespesa())}>
              <Plus size={18} /> {aba === 'modelos' ? 'Novo modelo fixo' : 'Nova despesa'}
            </Button>
          </div>
        }
      />

      <Segmented
        value={aba}
        onChange={changeAba}
        options={[
          { value: 'lancamentos', label: 'Lançamentos' },
          { value: 'analise', label: 'Análise' },
          { value: 'modelos', label: 'Fixas', count: modelosQ.data?.length },
        ]}
        className="sm:w-[26rem]"
      />

      {aba === 'lancamentos' && (
        <>
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição, valor ou observação"
              leftIcon={<Search size={17} />}
              className="h-11 bg-surface"
            />
            <Button variant="secondary" size="icon" className="relative h-11 w-11" onClick={() => setFiltersOpen(true)} aria-label="Filtros">
              <SlidersHorizontal size={19} />
              {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-on-brand">{activeFilters}</span>}
            </Button>
          </div>

          {(activeFilters > 0 || q) && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <span className="text-muted">{singles.length + filteredGroups.length} resultados</span>
              <button type="button" onClick={() => { setFilters(EMPTY); setQ(''); }} className="flex items-center gap-1 font-medium text-brand"><X size={15} /> Limpar</button>
            </div>
          )}

          {loading ? (
            <Card className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</Card>
          ) : filteredGroups.length === 0 && singles.length === 0 ? (
            <Card>
              <EmptyState
                icon={ArrowUpRight}
                title={all.length === 0 ? 'Nenhuma despesa ainda' : 'Nada encontrado'}
                description={all.length === 0 ? 'Registre gastos, contas e compras parceladas.' : 'Tente outros termos ou limpe os filtros.'}
                action={all.length === 0 ? <Button onClick={() => newDespesa()}><Plus size={17} /> Nova despesa</Button> : undefined}
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
              {filteredGroups.length > 0 && (
                <Card className="overflow-hidden lg:order-2 lg:col-span-2">
                  <CardHeader title="Parcelamentos" description={`${filteredGroups.filter((g) => g.proxima).length} em andamento`} />
                  <div className="mt-2 divide-y divide-line">
                    {filteredGroups.map((g) => <GroupRow key={g.id} g={g} onClick={() => setGroupId(g.id)} />)}
                  </div>
                </Card>
              )}

              <Card className={cn('overflow-hidden lg:order-1', filteredGroups.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5')}>
                {byMonth.length === 0 ? (
                  <EmptyState icon={ArrowUpRight} title="Nenhum lançamento avulso" description="Só há parcelamentos com esses filtros." />
                ) : (
                  <>
                    {byMonth.slice(0, months).map((m) => (
                      <div key={m.key}>
                        <ListGroupHeader title={monthTitle(m.key)} aside={formatBRL(sum(m.items))} />
                        <div className="divide-y divide-line">
                          {m.items.map((d) => {
                            const tipo = normalizeTipo(d.tipo);
                            const st = dueStatus(d.data_vencimento);
                            return (
                              <TxRow
                                key={d.id}
                                icon={categoryIcon(d.categoria)}
                                tone={d.pago ? 'neutral' : st.tone === 'neg' ? 'neg' : 'neutral'}
                                title={d.descricao}
                                subtitle={<>{formatDayMonth(d.data_vencimento)} · {d.categoria || 'Outros'}{tipo === 'fixa' ? ' · Fixa' : ''}</>}
                                amount={formatBRL(d.valor)}
                                meta={d.pago
                                  ? <span className="flex items-center gap-1 text-xs text-pos"><CircleCheck size={12} /> Paga</span>
                                  : <span className={cn('text-xs', st.days < 0 ? 'text-neg' : 'text-subtle')}>{st.days < 0 ? 'Atrasada' : 'Pendente'}</span>}
                                onClick={() => setDetail(d)}
                              />
                            );
                          })}
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
          )}
        </>
      )}

      {aba === 'analise' && <Analise despesas={all} loading={loading} />}

      {aba === 'modelos' && (
        <Modelos
          modelos={modelosQ.data ?? []}
          loading={modelosQ.isLoading}
          onNew={() => newDespesa('fixa')}
          onEdit={(m) => setFormTarget({ despesa: m })}
        />
      )}

      {/* Filtros */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar despesas"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setFilters(EMPTY)}>Limpar</Button>
            <Button size="lg" className="flex-[2]" onClick={() => setFiltersOpen(false)}>Ver resultados</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Categoria" value={filters.categoria} onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value as Filters['tipo'] }))}>
              <option value="">Todos</option>
              <option value="variavel">Variável</option>
              <option value="fixa">Fixa</option>
              <option value="parcelada">Parcelada</option>
            </Select>
            <Select label="Situação" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters['status'] }))}>
              <option value="">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="paga">Pagas</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vencimento de" type="date" value={filters.de} onChange={(e) => setFilters((f) => ({ ...f, de: e.target.value }))} />
            <Input label="até" type="date" value={filters.ate} onChange={(e) => setFilters((f) => ({ ...f, ate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor mínimo" value={filters.min} onChange={(v) => setFilters((f) => ({ ...f, min: v }))} />
            <MoneyInput label="Valor máximo" value={filters.max} onChange={(v) => setFilters((f) => ({ ...f, max: v }))} />
          </div>
        </div>
      </Sheet>

      <GroupSheet
        group={currentGroup}
        onClose={() => setGroupId(null)}
        onOpenItem={(d) => setDetail(d)}
        onEdit={(g) => { setGroupId(null); setFormTarget({ group: g.items }); }}
        onDelete={async (g) => { if (await actions.removeGroup(g.items, g.nome)) setGroupId(null); }}
      />

      <DespesaDetailSheet despesa={detail} onClose={() => setDetail(null)} onEdit={(d) => setFormTarget({ despesa: d })} />
      <DespesaFormSheet
        open={!!formTarget}
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onDelete={formTarget?.despesa?.is_modelo ? async () => {
          if (formTarget.despesa && await actions.remove(formTarget.despesa)) setFormTarget(null);
        } : undefined}
      />
    </div>
  );
}

function GroupRow({ g, onClick }: { g: Group; onClick: () => void }) {
  const done = !g.proxima;
  return (
    <button type="button" onClick={onClick} className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-elevated/60 sm:px-5">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-pos/12 text-pos' : 'bg-brand/14 text-brand')}>
          {done ? <CircleCheck size={18} /> : <Layers size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-fg">{g.nome}</p>
          <p className="truncate text-[13px] text-muted">
            {g.pagas}/{g.items.length} pagas
            {g.proxima ? ` · próx. ${formatDayMonth(g.proxima.data_vencimento)}` : ' · quitado'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-semibold tabular-nums text-fg">{formatBRL(g.items[0]?.valor)}</p>
          <p className="text-xs text-subtle">por parcela</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 pl-[52px]">
        <ProgressBar value={percent(g.pago, g.total)} tone={done ? 'pos' : 'brand'} className="h-1.5" />
        <span className="shrink-0 text-xs font-medium text-muted tabular-nums">{done ? 'Pago' : `Falta ${formatBRL(g.total - g.pago)}`}</span>
      </div>
    </button>
  );
}

function GroupSheet({ group, onClose, onOpenItem, onEdit, onDelete }: {
  group: Group | null;
  onClose: () => void;
  onOpenItem: (d: Despesa) => void;
  onEdit: (g: Group) => void;
  onDelete: (g: Group) => void;
}) {
  const actions = useDespesaActions();
  return (
    <Sheet
      open={!!group}
      onClose={onClose}
      title={group?.nome}
      description={group ? `${group.items.length} parcelas · ${group.categoria || 'Outros'}` : undefined}
      footer={group && (
        <div className="flex gap-2">
          <Button variant="danger-soft" size="lg" className="flex-1" onClick={() => onDelete(group)}>Excluir</Button>
          <Button variant="secondary" size="lg" className="flex-[2]" onClick={() => onEdit(group)}>Editar parcelamento</Button>
        </div>
      )}
    >
      {group && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-bg">
            <div className="p-3"><p className="text-xs text-muted">Total</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{formatBRL(group.total)}</p></div>
            <div className="p-3"><p className="text-xs text-muted">Pago</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-pos">{formatBRL(group.pago)}</p></div>
            <div className="p-3"><p className="text-xs text-muted">Falta</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{formatBRL(group.total - group.pago)}</p></div>
          </div>
          <div className="-mx-5 divide-y divide-line border-y border-line sm:-mx-6">
            {group.items.map((d) => {
              const st = dueStatus(d.data_vencimento);
              return (
                <TxRow
                  key={d.id}
                  icon={d.pago ? CircleCheck : Layers}
                  tone={d.pago ? 'pos' : st.days < 0 ? 'neg' : 'neutral'}
                  title={`Parcela ${d.parcela_atual ?? '?'} de ${d.numero_parcelas ?? group.items.length}`}
                  subtitle={d.pago ? <>Paga · venc. {formatDate(d.data_vencimento)}</> : <span className={TONE_TEXT[st.tone]}>{formatDate(d.data_vencimento)} · {st.text.toLowerCase()}</span>}
                  amount={formatBRL(d.valor)}
                  meta={d.pago ? undefined : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); actions.pagar(d); }}
                      className="h-7 rounded-lg bg-brand/12 px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-on-brand"
                    >
                      Pagar
                    </button>
                  )}
                  onClick={() => onOpenItem(d)}
                />
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Analise({ despesas, loading }: { despesas: Despesa[]; loading: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0);

  const data = useMemo(() => {
    const prefix = month === 0 ? `${year}-` : `${year}-${String(month).padStart(2, '0')}-`;
    const list = despesas.filter((d) => dateKey(d.data_vencimento).startsWith(prefix));
    const porTipo: Record<TipoDespesa, Despesa[]> = { fixa: [], parcelada: [], variavel: [] };
    for (const d of list) porTipo[normalizeTipo(d.tipo)].push(d);
    const total = sum(list);
    const cat = new Map<string, number>();
    for (const d of list) cat.set(d.categoria || 'Outros', (cat.get(d.categoria || 'Outros') ?? 0) + (Number(d.valor) || 0));
    return {
      list,
      total,
      pago: sum(list.filter((d) => d.pago)),
      tipos: (['fixa', 'parcelada', 'variavel'] as TipoDespesa[]).map((t, i) => ({ tipo: t, total: sum(porTipo[t]), count: porTipo[t].length, color: CHART_COLORS[i + 1] })),
      categorias: [...cat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      maiores: [...list].sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5),
    };
  }, [despesas, year, month]);

  const periodo = month === 0 ? `em ${year}` : `em ${MONTHS[month - 1].toLowerCase()}`;

  return (
    <div className="space-y-4 lg:space-y-5">
      <MonthSwitcher year={year} month={month} allowYear onChange={(y, m) => { setYear(y); setMonth(m); }} className="sm:w-72" />

      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : data.list.length === 0 ? (
        <Card><EmptyState icon={ArrowUpRight} title={`Sem despesas ${periodo}`} /></Card>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <p className="text-[13px] font-medium text-muted">Total de despesas {periodo}</p>
            <p className="mt-1 text-[30px] font-semibold tracking-tight tabular-nums text-fg">{formatBRL(data.total)}</p>
            <p className="mt-0.5 text-[13px] text-muted">{data.list.length} lançamentos · {percent(data.pago, data.total)}% já pago</p>

            <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-elevated">
              {data.tipos.filter((t) => t.total > 0).map((t) => (
                <div key={t.tipo} style={{ width: `${(t.total / data.total) * 100}%`, background: t.color }} title={TIPO_LABEL[t.tipo]} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {data.tipos.map((t) => (
                <div key={t.tipo} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                    {t.tipo === 'variavel' ? 'Variáveis' : t.tipo === 'fixa' ? 'Fixas' : 'Parceladas'}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(t.total)}</p>
                  <p className="text-xs text-subtle">{percent(t.total, data.total)}% · {t.count}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <Card>
              <CardHeader title="Por categoria" description={`Onde o dinheiro foi ${periodo}`} />
              <div className="space-y-3.5 p-4 sm:p-5">
                {data.categorias.map(([nome, valor], i) => {
                  const Icon = categoryIcon(nome);
                  return (
                    <div key={nome}>
                      <div className="mb-1.5 flex items-center gap-2 text-sm">
                        <Icon size={15} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-fg">{nome}</span>
                        <span className="text-xs text-subtle tabular-nums">{percent(valor, data.total)}%</span>
                        <span className="w-24 text-right font-medium tabular-nums text-fg">{formatBRL(valor)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                        <div className="h-full rounded-full" style={{ width: `${(valor / data.categorias[0][1]) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Maiores gastos" description={periodo.charAt(0).toUpperCase() + periodo.slice(1)} />
              <div className="mt-2 divide-y divide-line">
                {data.maiores.map((d, i) => (
                  <TxRow
                    key={d.id}
                    icon={categoryIcon(d.categoria)}
                    title={<><span className="mr-1.5 text-subtle tabular-nums">{i + 1}.</span>{d.descricao}</>}
                    subtitle={<>{formatDate(d.data_vencimento)} · {d.categoria || 'Outros'}</>}
                    amount={formatBRL(d.valor)}
                  />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Modelos({ modelos, loading, onNew, onEdit }: {
  modelos: Despesa[];
  loading: boolean;
  onNew: () => void;
  onEdit: (m: Despesa) => void;
}) {
  const total = sum(modelos);
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/14 text-brand"><Bookmark size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">Contas que se repetem todo mês</p>
          <p className="mt-0.5 text-sm text-muted">
            Os modelos viram contas do mês quando você toca em <strong className="font-medium text-fg">Gerar fixas do mês</strong> em{' '}
            <Link to="/pagamentos" className="font-medium text-brand hover:underline">Contas a pagar</Link>.
          </p>
        </div>
        <Button onClick={onNew} className="w-full sm:w-auto"><Plus size={18} /> Novo modelo</Button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : modelos.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhum modelo fixo" description="Cadastre aluguel, internet, academia e outras contas mensais." />
        ) : (
          <>
            <ListGroupHeader title={`${modelos.length} ${modelos.length === 1 ? 'modelo' : 'modelos'}`} aside={`${formatBRL(total)}/mês`} />
            <div className="divide-y divide-line">
              {[...modelos]
                .sort((a, b) => (parseDateOnly(a.data_vencimento)?.getDate() ?? 0) - (parseDateOnly(b.data_vencimento)?.getDate() ?? 0))
                .map((m) => (
                  <TxRow
                    key={m.id}
                    icon={categoryIcon(m.categoria)}
                    title={m.descricao}
                    subtitle={<>Todo dia {parseDateOnly(m.data_vencimento)?.getDate()} · {m.categoria || 'Outros'}</>}
                    amount={formatBRL(m.valor)}
                    meta={m.usa_media ? <Badge tone="info">Pela média</Badge> : undefined}
                    onClick={() => onEdit(m)}
                  />
                ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
