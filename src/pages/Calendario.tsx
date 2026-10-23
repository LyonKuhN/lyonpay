import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDownLeft, Bell, CalendarDays, Check, ChevronDown, CircleCheck, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useDespesas, useLembretes, useReceitas } from '../hooks/queries';
import { useQuickActions } from '../components/layout/AppShell';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Card, CardHeader, EmptyState, PageHeader, Skeleton } from '../components/ui/primitives';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { TxRow } from '../components/finance/TxRow';
import { DespesaDetailSheet } from '../components/finance/DespesaDetailSheet';
import { DespesaFormSheet, type DespesaFormTarget } from '../components/forms/DespesaForm';
import { categoryIcon } from '../lib/categories';
import { cn } from '../lib/cn';
import { dateKey, daysInMonth, formatBRL, formatBRLCompact, formatDateTime, parseDateOnly, timestampKey, todayISO } from '../lib/format';
import type { Despesa, Lembrete, Receita } from '../lib/types';

interface DayEvents { despesas: Despesa[]; receitas: Receita[]; lembretes: Lembrete[] }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const sum = (arr: Array<{ valor: number | string }>) => arr.reduce((acc, x) => acc + (Number(x.valor) || 0), 0);

export default function Calendario() {
  const now = new Date();
  const today = todayISO();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(today);
  const [showDone, setShowDone] = useState(false);
  const [detail, setDetail] = useState<Despesa | null>(null);
  const [editTarget, setEditTarget] = useState<DespesaFormTarget | null>(null);
  const { newLembrete } = useQuickActions();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const despesasQ = useDespesas();
  const receitasQ = useReceitas();
  const lembretesQ = useLembretes();
  const loading = despesasQ.isLoading || receitasQ.isLoading || lembretesQ.isLoading;

  const prefix = `${year}-${String(month).padStart(2, '0')}-`;

  const byDay = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { despesas: [], receitas: [], lembretes: [] });
      return map.get(k)!;
    };
    for (const d of despesasQ.data ?? []) get(dateKey(d.data_vencimento)).despesas.push(d);
    for (const r of receitasQ.data ?? []) get(dateKey(r.data_recebimento)).receitas.push(r);
    // Lembrete tem horário: usa o dia local do instante, não a parte UTC do texto
    for (const l of lembretesQ.data ?? []) get(timestampKey(l.data_lembrete)).lembretes.push(l);
    return map;
  }, [despesasQ.data, receitasQ.data, lembretesQ.data]);

  const monthTotals = useMemo(() => {
    let rec = 0;
    let des = 0;
    for (const [k, ev] of byDay) {
      if (!k.startsWith(prefix)) continue;
      rec += sum(ev.receitas);
      des += sum(ev.despesas);
    }
    return { rec, des };
  }, [byDay, prefix]);

  const lembretes = lembretesQ.data ?? [];
  const pendentes = lembretes.filter((l) => !l.concluido).sort((a, b) => a.data_lembrete.localeCompare(b.data_lembrete));
  const concluidos = lembretes.filter((l) => l.concluido).sort((a, b) => b.data_lembrete.localeCompare(a.data_lembrete));

  const toggle = useMutation({
    mutationFn: (l: Lembrete) => apiFetch(`/api/lembretes/${l.id}/concluir`, { method: 'PATCH', body: JSON.stringify({ concluido: !l.concluido }) }),
    onSuccess: (_, l) => {
      qc.invalidateQueries({ queryKey: ['lembretes'] });
      toast.success(l.concluido ? 'Lembrete reaberto' : 'Lembrete concluído');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível atualizar'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/lembretes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lembretes'] });
      toast.success('Lembrete excluído');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível excluir'),
  });

  const askRemove = async (l: Lembrete) => {
    if (await confirm({ title: 'Excluir lembrete?', description: l.titulo, confirmText: 'Excluir', danger: true })) remove.mutate(l.id);
  };

  const changeMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    const p = `${y}-${String(m).padStart(2, '0')}-`;
    setSelected(today.startsWith(p) ? today : `${p}01`);
  };

  const offset = new Date(year, month - 1, 1).getDay();
  const days = daysInMonth(year, month);
  const sel = byDay.get(selected) ?? { despesas: [], receitas: [], lembretes: [] };
  const selDate = parseDateOnly(selected);
  const selEmpty = sel.despesas.length + sel.receitas.length + sel.lembretes.length === 0;

  const reminderRow = (l: Lembrete) => {
    const late = !l.concluido && new Date(l.data_lembrete) < now;
    return (
      <div key={l.id} className={cn('flex items-start gap-3 px-4 py-3 sm:px-5', l.concluido && 'opacity-60')}>
        <button
          type="button"
          onClick={() => toggle.mutate(l)}
          aria-label={l.concluido ? 'Reabrir lembrete' : 'Concluir lembrete'}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            l.concluido ? 'border-pos bg-pos text-white' : 'border-line-strong hover:border-pos',
          )}
        >
          {l.concluido && <Check size={14} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[15px] font-medium text-fg', l.concluido && 'line-through')}>{l.titulo}</p>
          {l.descricao && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{l.descricao}</p>}
          <p className={cn('mt-1 text-xs', late ? 'font-medium text-neg' : 'text-subtle')}>{formatDateTime(l.data_lembrete)}{late ? ' · atrasado' : ''}</p>
        </div>
        <button type="button" onClick={() => askRemove(l)} aria-label="Excluir lembrete" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-neg/10 hover:text-neg">
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title="Agenda"
        description="Vencimentos, recebimentos e lembretes no tempo."
        actions={
          <div className="flex w-full gap-2 lg:w-auto">
            <MonthSwitcher year={year} month={month} onChange={changeMonth} className="flex-1 lg:w-64 lg:flex-none" />
            <Button className="h-11" onClick={() => newLembrete()}><Plus size={18} /><span className="hidden sm:inline">Lembrete</span></Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((w) => <span key={w} className="py-2.5 text-center text-xs font-medium text-subtle">{w}</span>)}
            </div>
            {loading ? (
              <Skeleton className="m-4 h-72" />
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} className="border-b border-r border-line/60 bg-bg/30" />)}
                {Array.from({ length: days }, (_, i) => {
                  const key = `${prefix}${String(i + 1).padStart(2, '0')}`;
                  const ev = byDay.get(key);
                  const pend = ev?.despesas.some((d) => !d.pago);
                  const isSel = key === selected;
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      className={cn(
                        'relative flex min-h-14 flex-col items-center gap-1 border-b border-r border-line/60 p-1.5 text-left transition-colors sm:min-h-16 lg:min-h-24 lg:items-stretch lg:p-2 xl:min-h-32',
                        (offset + i) % 7 === 6 && 'border-r-0',
                        isSel ? 'bg-brand/10' : 'hover:bg-elevated/60',
                      )}
                    >
                      <span className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium tabular-nums',
                        isToday ? 'bg-brand text-on-brand' : isSel ? 'text-brand' : 'text-fg',
                      )}>
                        {i + 1}
                      </span>
                      {/* Celular: pontos. Notebook: totais do dia. Tela larga: nome de cada lançamento. */}
                      <span className="flex gap-1 lg:hidden">
                        {ev?.receitas.length ? <span className="h-1.5 w-1.5 rounded-full bg-pos" /> : null}
                        {ev?.despesas.length ? <span className={cn('h-1.5 w-1.5 rounded-full', pend ? (key < today ? 'bg-neg' : 'bg-warn') : 'bg-subtle')} /> : null}
                        {ev?.lembretes.some((l) => !l.concluido) ? <span className="h-1.5 w-1.5 rounded-full bg-info" /> : null}
                      </span>
                      <span className="hidden w-full space-y-0.5 lg:block xl:hidden">
                        {ev?.receitas.length ? <span className="block truncate rounded bg-pos/12 px-1 text-[11px] font-medium text-pos tabular-nums">+{formatBRLCompact(sum(ev.receitas)).replace('R$ ', '')}</span> : null}
                        {ev?.despesas.length ? <span className={cn('block truncate rounded px-1 text-[11px] font-medium tabular-nums', pend ? 'bg-warn/14 text-warn' : 'bg-elevated text-muted')}>−{formatBRLCompact(sum(ev.despesas)).replace('R$ ', '')}</span> : null}
                        {ev?.lembretes.some((l) => !l.concluido) ? <span className="block truncate rounded bg-info/12 px-1 text-[11px] font-medium text-info">{ev.lembretes.filter((l) => !l.concluido).length} lembrete(s)</span> : null}
                      </span>
                      {ev && <DayChips ev={ev} late={key < today} />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted lg:hidden">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-pos" />Receita</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warn" />A pagar</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-neg" />Atrasada</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-info" />Lembrete</span>
            </div>
          </Card>

          {/* Dia selecionado */}
          <Card className="overflow-hidden">
            <CardHeader
              title={selDate ? selDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
              description={selected === today ? 'Hoje' : undefined}
              action={<Button variant="ghost" size="sm" onClick={() => newLembrete(selected)}><Bell size={15} /> Lembrar</Button>}
            />
            <div className="mt-2 divide-y divide-line">
              {selEmpty ? (
                <EmptyState icon={CalendarDays} title="Nada neste dia" className="py-8" />
              ) : (
                <>
                  {sel.receitas.map((r) => (
                    <TxRow key={r.id} icon={categoryIcon(r.categoria)} tone="pos" title={r.descricao} subtitle={r.categoria || 'Receita'} amount={`+ ${formatBRL(r.valor)}`} amountTone="pos" />
                  ))}
                  {sel.despesas.map((d) => (
                    <TxRow
                      key={d.id}
                      icon={d.pago ? CircleCheck : categoryIcon(d.categoria)}
                      tone={d.pago ? 'pos' : selected < today ? 'neg' : 'warn'}
                      title={d.descricao}
                      subtitle={d.pago ? 'Paga' : selected < today ? 'Atrasada' : 'A pagar'}
                      amount={formatBRL(d.valor)}
                      onClick={() => setDetail(d)}
                    />
                  ))}
                  {sel.lembretes.map(reminderRow)}
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[15px] font-semibold text-fg">Resumo do mês</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted"><ArrowDownLeft size={15} className="text-pos" />Receitas</dt><dd className="font-semibold tabular-nums text-pos">{formatBRL(monthTotals.rec)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Despesas</dt><dd className="font-semibold tabular-nums text-fg">{formatBRL(monthTotals.des)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2.5"><dt className="font-medium text-fg">Resultado previsto</dt><dd className={cn('font-semibold tabular-nums', monthTotals.rec - monthTotals.des >= 0 ? 'text-pos' : 'text-neg')}>{formatBRL(monthTotals.rec - monthTotals.des)}</dd></div>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Lembretes" description={pendentes.length ? `${pendentes.length} em aberto` : 'Nenhum em aberto'} />
            <div className="mt-2 divide-y divide-line">
              {pendentes.length === 0 && concluidos.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Sem lembretes"
                  description="Crie avisos para renovar seguros, cobrar alguém ou revisar o orçamento."
                  action={<Button variant="secondary" size="sm" onClick={() => newLembrete()}><Plus size={16} /> Novo lembrete</Button>}
                  className="py-8"
                />
              ) : (
                <>
                  {pendentes.map(reminderRow)}
                  {concluidos.length > 0 && (
                    <button type="button" onClick={() => setShowDone((v) => !v)} className="flex h-11 w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted hover:bg-elevated/60">
                      <ChevronDown size={15} className={cn('transition-transform', showDone && 'rotate-180')} />
                      {showDone ? 'Ocultar concluídos' : `Ver ${concluidos.length} concluído(s)`}
                    </button>
                  )}
                  {showDone && concluidos.map(reminderRow)}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <DespesaDetailSheet despesa={detail} onClose={() => setDetail(null)} onEdit={(d) => setEditTarget({ despesa: d })} />
      <DespesaFormSheet open={!!editTarget} target={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}

/** Em telas largas, cada dia lista os lançamentos pelo nome (até 3, depois "+N"). */
function DayChips({ ev, late }: { ev: DayEvents; late: boolean }) {
  const chips = [
    ...ev.receitas.map((r) => ({ id: `r${r.id}`, text: r.descricao, value: `+${formatBRLCompact(Number(r.valor)).replace('R$ ', '')}`, cls: 'bg-pos/12 text-pos' })),
    ...ev.despesas.map((d) => ({
      id: `d${d.id}`,
      text: d.descricao,
      value: formatBRLCompact(Number(d.valor)).replace('R$ ', ''),
      cls: d.pago ? 'bg-elevated text-muted line-through decoration-1' : late ? 'bg-neg/12 text-neg' : 'bg-warn/14 text-warn',
    })),
    ...ev.lembretes.filter((l) => !l.concluido).map((l) => ({ id: `l${l.id}`, text: l.titulo, value: '', cls: 'bg-info/12 text-info' })),
  ];
  if (chips.length === 0) return null;
  return (
    <span className="hidden w-full space-y-0.5 xl:block">
      {chips.slice(0, 3).map((c) => (
        <span key={c.id} className={cn('flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium', c.cls)}>
          <span className="min-w-0 flex-1 truncate">{c.text}</span>
          {c.value && <span className="shrink-0 tabular-nums opacity-80">{c.value}</span>}
        </span>
      ))}
      {chips.length > 3 && <span className="block px-1.5 text-[11px] font-medium text-subtle">+{chips.length - 3} mais</span>}
    </span>
  );
}
