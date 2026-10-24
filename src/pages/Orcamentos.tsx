import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PiggyBank, Plus, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useCategorias, useDespesas, useOrcamentos } from '../hooks/queries';
import { useEspaco } from '../contexts/EspacoContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { MoneyInput, Select } from '../components/ui/input';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, Skeleton } from '../components/ui/primitives';
import { AnimatedNumber, Stagger, StaggerItem } from '../components/ui/motion';
import { MonthSwitcher } from '../components/ui/month-switcher';
import { Sheet } from '../components/ui/sheet';
import { categoryIcon } from '../lib/categories';
import { cn } from '../lib/cn';
import { dateKey, formatBRL, MONTHS, parseMoney, percent, toMoneyInput } from '../lib/format';
import { chaveMes, tomOrcamento } from '../lib/planejamento';
import { valorEfetivo, type Orcamento } from '../lib/types';

export default function Orcamentos() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { somenteLeitura } = useEspaco();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editando, setEditando] = useState<{ categoria?: string; valor?: number } | null>(null);

  const orcQ = useOrcamentos();
  const despesasQ = useDespesas();

  const { linhas, sugestoes, totalLimite, totalGasto } = useMemo(() => {
    const mes = chaveMes(year, month);
    // Últimos 3 meses antes do mês na tela, para sugerir limites
    const anteriores = [1, 2, 3].map((i) => {
      const d = new Date(year, month - 1 - i, 1);
      return chaveMes(d.getFullYear(), d.getMonth() + 1);
    });
    const gastoMes = new Map<string, number>();
    const gastoAnt = new Map<string, number>();
    for (const d of despesasQ.data ?? []) {
      const k = dateKey(d.data_vencimento).slice(0, 7);
      const cat = d.categoria || 'Outros';
      if (k === mes) gastoMes.set(cat, (gastoMes.get(cat) ?? 0) + valorEfetivo(d));
      else if (anteriores.includes(k)) gastoAnt.set(cat, (gastoAnt.get(cat) ?? 0) + valorEfetivo(d));
    }
    const orcs = orcQ.data ?? [];
    const linhas = orcs
      .map((o) => ({ o, limite: Number(o.valor) || 0, gasto: gastoMes.get(o.categoria) ?? 0 }))
      .sort((a, b) => b.gasto / (b.limite || 1) - a.gasto / (a.limite || 1));
    const comOrc = new Set(orcs.map((o) => o.categoria));
    const sugestoes = [...gastoAnt.entries()]
      .filter(([cat]) => !comOrc.has(cat))
      .map(([cat, total]) => ({ categoria: cat, media: Math.ceil(total / 3 / 10) * 10 }))
      .filter((s) => s.media >= 50)
      .sort((a, b) => b.media - a.media)
      .slice(0, 6);
    return {
      linhas,
      sugestoes,
      totalLimite: linhas.reduce((a, l) => a + l.limite, 0),
      totalGasto: linhas.reduce((a, l) => a + l.gasto, 0),
    };
  }, [orcQ.data, despesasQ.data, year, month]);

  const remover = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/orcamentos/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamentos'] }); toast.success('Orçamento removido'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const pctTotal = percent(totalGasto, totalLimite);
  const loading = orcQ.isLoading || despesasQ.isLoading;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Orçamentos"
        description="Um limite por categoria. Avisamos quando passar de 80%."
        actions={
          <>
            <MonthSwitcher year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} className="flex-1 lg:w-64 lg:flex-none" />
            {!somenteLeitura && <Button onClick={() => setEditando({})}><Plus size={18} /> <span className="hidden sm:inline">Novo orçamento</span></Button>}
          </>
        }
      />

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4 xl:sticky xl:top-8">
          <Card className="p-5 sm:p-6">
            <p className="text-[13px] font-medium text-muted">Gasto nas categorias com orçamento · {MONTHS[month - 1].toLowerCase()}</p>
            {loading ? <Skeleton className="mt-2 h-9 w-40" /> : (
              <p className="mt-1 text-[30px] font-semibold leading-tight tracking-tight text-fg">
                <AnimatedNumber value={totalGasto} format={(n) => formatBRL(n)} />
                <span className="ml-2 text-base font-medium text-muted">de {formatBRL(totalLimite)}</span>
              </p>
            )}
            <ProgressBar value={pctTotal} tone={pctTotal >= 100 ? 'neg' : pctTotal >= 80 ? 'warn' : 'pos'} className="mt-4" />
            <p className="mt-2 text-[13px] text-muted">{totalLimite ? `${pctTotal}% do total planejado` : 'Defina limites para acompanhar.'}</p>
          </Card>

          {sugestoes.length > 0 && !somenteLeitura && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-fg"><Sparkles size={16} className="text-brand" /> Sugestões</p>
              <p className="mt-0.5 text-[13px] text-muted">Pela média dos últimos 3 meses</p>
              <ul className="mt-3 space-y-2">
                {sugestoes.map((s) => {
                  const Icon = categoryIcon(s.categoria);
                  return (
                    <li key={s.categoria}>
                      <button
                        type="button"
                        onClick={() => setEditando({ categoria: s.categoria, valor: s.media })}
                        className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5"
                      >
                        <Icon size={16} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-sm text-fg">{s.categoria}</span>
                        <span className="text-sm font-semibold tabular-nums text-fg">{formatBRL(s.media, { cents: false })}</span>
                        <Plus size={15} className="text-brand" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : linhas.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="Nenhum orçamento ainda"
              description="Escolha as categorias que mais pesam (mercado, delivery, lazer) e defina quanto quer gastar por mês."
              action={!somenteLeitura ? <Button onClick={() => setEditando({})}><Plus size={17} /> Novo orçamento</Button> : undefined}
            />
          ) : (
            <Stagger className="divide-y divide-line">
              {linhas.map(({ o, limite, gasto }) => {
                const Icon = categoryIcon(o.categoria);
                const pct = percent(gasto, limite);
                const st = tomOrcamento(gasto, limite);
                return (
                  <StaggerItem key={o.id}>
                    <button
                      type="button"
                      disabled={somenteLeitura}
                      onClick={() => setEditando({ categoria: o.categoria, valor: limite })}
                      className="block w-full px-4 py-4 text-left transition-colors hover:bg-elevated/50 sm:px-5"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-fg">{o.categoria}</span>
                        <Badge tone={pct >= 80 ? st.tone : 'neutral'}>{pct}%</Badge>
                      </div>
                      <ProgressBar value={pct} tone={st.tone} className="mt-2.5" />
                      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                        <span className={cn(st.tone === 'pos' ? 'text-muted' : st.tone === 'warn' ? 'text-warn' : 'text-neg')}>{st.texto}</span>
                        <span className="tabular-nums text-muted"><span className="font-semibold text-fg">{formatBRL(gasto)}</span> de {formatBRL(limite)}</span>
                      </div>
                    </button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </Card>
      </div>

      <OrcamentoSheet
        alvo={editando}
        existentes={orcQ.data ?? []}
        onClose={() => setEditando(null)}
        onDelete={async (o) => {
          if (await confirm({ title: `Remover o orçamento de ${o.categoria}?`, confirmText: 'Remover', danger: true })) {
            remover.mutate(o.id);
            setEditando(null);
          }
        }}
      />
    </div>
  );
}

function OrcamentoSheet({ alvo, existentes, onClose, onDelete }: {
  alvo: { categoria?: string; valor?: number } | null;
  existentes: Orcamento[];
  onClose: () => void;
  onDelete: (o: Orcamento) => void;
}) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useCategorias('despesa');
  const [chave, setChave] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const k = alvo ? `${alvo.categoria ?? ''}|${alvo.valor ?? ''}` : null;
  if (k !== chave) {
    setChave(k);
    setCategoria(alvo?.categoria ?? '');
    setValor(alvo?.valor ? toMoneyInput(alvo.valor) : '');
  }
  const existente = existentes.find((o) => o.categoria === categoria);
  const livres = categorias.filter((c) => c.nome === alvo?.categoria || !existentes.some((o) => o.categoria === c.nome));
  const cat = categoria || livres[0]?.nome || '';

  const salvar = useMutation({
    mutationFn: () => apiFetch('/api/orcamentos', { method: 'PUT', body: JSON.stringify({ categoria: cat, valor: parseMoney(valor) }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success('Orçamento salvo');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  return (
    <Sheet
      open={!!alvo}
      onClose={onClose}
      title={existente ? `Orçamento de ${existente.categoria}` : 'Novo orçamento'}
      size="sm"
      footer={
        <div className="flex gap-2">
          {existente && <Button variant="danger-soft" size="icon-lg" onClick={() => onDelete(existente)} aria-label="Remover orçamento"><Trash2 size={18} /></Button>}
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" disabled={!cat || !(parseMoney(valor) > 0)} isLoading={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {!existente && (
          <Select label="Categoria" value={cat} onChange={(e) => setCategoria(e.target.value)}>
            {livres.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </Select>
        )}
        <MoneyInput size="lg" label="Limite por mês" value={valor} onChange={setValor} autoFocus />
      </div>
    </Sheet>
  );
}
