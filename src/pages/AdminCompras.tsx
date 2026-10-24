import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, ChevronDown, Plus, Search, Share2, ShoppingCart, Tag, Trash2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Field, Input, MoneyInput } from '../components/ui/input';
import { Badge, Card, EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui/primitives';
import { Sheet } from '../components/ui/sheet';
import { ListGroupHeader } from '../components/finance/TxRow';
import { cn } from '../lib/cn';
import { formatBRL, parseMoney, toMoneyInput, type Tone } from '../lib/format';

type Prioridade = 'Alta' | 'Média' | 'Baixa';

interface Compra {
  id: string;
  item: string;
  grupo?: string | null;
  prioridade: Prioridade;
  valor: number | string;
  comprado: boolean;
}

const PRIORIDADES: Prioridade[] = ['Alta', 'Média', 'Baixa'];
const PESO: Record<Prioridade, number> = { Alta: 3, Média: 2, Baixa: 1 };
const TOM: Record<Prioridade, Tone> = { Alta: 'neg', Média: 'warn', Baixa: 'info' };
const KEY = ['admin', 'compras'];

const sum = (arr: Compra[]) => arr.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

export default function AdminCompras() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const gruposListId = useId();

  const [tab, setTab] = useState<'pendentes' | 'comprados'>('pendentes');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [editando, setEditando] = useState<Compra | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Formulário de novo item
  const [item, setItem] = useState('');
  const [grupo, setGrupo] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('Média');
  const [valor, setValor] = useState('');

  const comprasQ = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch('/api/admin/compras') as Promise<Compra[]>,
    enabled: isAuthenticated,
  });
  const compras = useMemo(() => (Array.isArray(comprasQ.data) ? comprasQ.data : []), [comprasQ.data]);

  const setLista = (fn: (lista: Compra[]) => Compra[]) => qc.setQueryData<Compra[]>(KEY, (old) => fn(Array.isArray(old) ? old : []));

  const criar = useMutation({
    mutationFn: (body: { item: string; grupo: string | null; prioridade: Prioridade; valor: number }) =>
      apiFetch('/api/admin/compras', { method: 'POST', body: JSON.stringify(body) }) as Promise<Compra>,
    onSuccess: (nova) => {
      setLista((l) => [nova, ...l]);
      setItem('');
      setValor('');
      setGrupo('');
      setPrioridade('Média');
      setTab('pendentes');
      toast.success('Item adicionado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível adicionar'),
  });

  const alternar = useMutation({
    mutationFn: (c: Compra) => apiFetch(`/api/admin/compras/${c.id}`, { method: 'PUT', body: JSON.stringify({ comprado: !c.comprado }) }),
    onMutate: (c) => setLista((l) => l.map((x) => (x.id === c.id ? { ...x, comprado: !c.comprado } : x))),
    onError: (err: Error, c) => {
      setLista((l) => l.map((x) => (x.id === c.id ? { ...x, comprado: c.comprado } : x)));
      toast.error(err.message || 'Não foi possível atualizar');
    },
  });

  const salvar = useMutation({
    mutationFn: (c: Compra) => apiFetch(`/api/admin/compras/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ item: c.item, grupo: c.grupo || null, prioridade: c.prioridade, valor: Number(c.valor), comprado: c.comprado }),
    }) as Promise<Compra>,
    onSuccess: (atual) => {
      setLista((l) => l.map((x) => (x.id === atual.id ? atual : x)));
      setEditando(null);
      toast.success('Item atualizado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/compras/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      setLista((l) => l.filter((x) => x.id !== id));
      setEditando(null);
      toast.success('Item removido');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível remover'),
  });

  const pedirRemocao = async (c: Compra) => {
    if (await confirm({ title: 'Remover item?', description: c.item, confirmText: 'Remover', danger: true })) remover.mutate(c.id);
  };

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseMoney(valor);
    if (!item.trim() || !(v >= 0)) return;
    criar.mutate({ item: item.trim(), grupo: grupo.trim() || null, prioridade, valor: v });
  };

  const pendentes = compras.filter((c) => !c.comprado);
  const grupos = useMemo(() => [...new Set(compras.map((c) => c.grupo).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [compras]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return compras
      .filter((c) => (tab === 'pendentes' ? !c.comprado : c.comprado))
      .filter((c) => !t || c.item.toLowerCase().includes(t) || (c.grupo || '').toLowerCase().includes(t))
      .sort((a, b) => PESO[b.prioridade] - PESO[a.prioridade]);
  }, [compras, tab, busca]);

  const porGrupo = useMemo(() => {
    const map = new Map<string, Compra[]>();
    for (const c of visiveis) if (c.grupo) map.set(c.grupo, [...(map.get(c.grupo) ?? []), c]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visiveis]);
  const avulsos = visiveis.filter((c) => !c.grupo);

  const exportar = (tipo: 'tudo' | 'avulso' | 'grupo' | 'prioridade', extra?: string) => {
    let itens = pendentes;
    let titulo = 'Lista de Compras Pendentes';
    if (tipo === 'avulso') { itens = itens.filter((c) => !c.grupo); titulo += ' (Itens Avulsos)'; }
    if (tipo === 'grupo' && extra) { itens = itens.filter((c) => c.grupo === extra); titulo += ` (Grupo: ${extra})`; }
    if (tipo === 'prioridade' && extra) { itens = itens.filter((c) => c.prioridade === extra); titulo += ` (Prioridade: ${extra})`; }
    if (itens.length === 0) {
      toast('Nenhum item pendente nessa seleção.');
      return;
    }
    const linha = (c: Compra) => `${c.item} (${formatBRL(c.valor)}) [${c.prioridade}]`;
    let text = `🛒 *${titulo}*\n\n`;
    if (tipo === 'tudo' || tipo === 'prioridade') {
      const mapa = new Map<string, Compra[]>();
      for (const c of itens.filter((x) => x.grupo)) mapa.set(c.grupo!, [...(mapa.get(c.grupo!) ?? []), c]);
      for (const [g, lista] of mapa) text += `📁 *${g}*\n${lista.map((c) => `  - ${linha(c)}`).join('\n')}\n\n`;
      const soltos = itens.filter((x) => !x.grupo);
      if (soltos.length) text += `🏷️ *Avulsos*\n${soltos.map((c) => `  - ${linha(c)}`).join('\n')}\n\n`;
    } else {
      text += `${itens.map((c) => `- ${linha(c)}`).join('\n')}\n`;
    }
    text += `\n💰 *Total estimado: ${formatBRL(sum(itens))}*\n\nGerado via Lyonk.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setExportOpen(false);
  };

  const row = (c: Compra, mostrarGrupo: boolean) => (
    <div key={c.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', c.comprado && 'opacity-60')}>
      <button
        type="button"
        onClick={() => alternar.mutate(c)}
        aria-label={c.comprado ? 'Voltar para pendente' : 'Marcar como comprado'}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          c.comprado ? 'border-pos bg-pos text-white' : 'border-line-strong hover:border-pos',
        )}
      >
        {c.comprado && <Check size={15} strokeWidth={3} />}
      </button>
      <button type="button" onClick={() => setEditando(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[15px] font-medium text-fg', c.comprado && 'line-through')}>{c.item}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Badge tone={TOM[c.prioridade]}>{c.prioridade}</Badge>
            {mostrarGrupo && <span className="truncate">{c.grupo || 'Avulso'}</span>}
          </span>
        </span>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-fg">{formatBRL(c.valor)}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 lg:space-y-5">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} /> Administração
      </Link>

      <PageHeader
        title="Lista de compras"
        description="Planejamento de aquisições por grupo e prioridade."
        actions={<Button variant="secondary" onClick={() => setExportOpen(true)} className="w-full sm:w-auto"><Share2 size={17} /> Enviar no WhatsApp</Button>}
      />

      <Card className="p-5 sm:p-6">
        <p className="text-[13px] font-medium text-muted">A comprar</p>
        {comprasQ.isLoading ? <Skeleton className="mt-2 h-9 w-40" /> : (
          <p className="mt-1 text-[30px] font-semibold leading-tight tracking-tight tabular-nums text-fg">{formatBRL(sum(pendentes))}</p>
        )}
        <p className="mt-0.5 text-[13px] text-muted">{pendentes.length} {pendentes.length === 1 ? 'item pendente' : 'itens pendentes'}</p>
        <div className="mt-5 grid divide-y divide-line rounded-xl border border-line bg-bg/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {PRIORIDADES.map((p) => (
            <div key={p} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block sm:p-3">
              <p className="flex items-center gap-1.5 text-[13px] text-muted sm:text-xs"><span className={cn('h-2 w-2 rounded-full', p === 'Alta' ? 'bg-neg' : p === 'Média' ? 'bg-warn' : 'bg-info')} />Prioridade {p.toLowerCase()}</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg sm:text-base">{formatBRL(sum(pendentes.filter((c) => c.prioridade === p)))}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="mb-4 text-[15px] font-semibold text-fg">Novo item</p>
        <form onSubmit={adicionar} className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <Input label="Item" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ex.: celular, papel A4" required maxLength={120} />
          </div>
          <div className="lg:col-span-3">
            <Input label="Grupo (opcional)" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: mercado, escritório" list={gruposListId} maxLength={60} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <Field label="Prioridade">
              <Segmented size="sm" className="h-12 items-center" value={prioridade} onChange={setPrioridade} options={PRIORIDADES.map((p) => ({ value: p, label: p }))} />
            </Field>
            <MoneyInput label="Valor" value={valor} onChange={setValor} required />
          </div>
          <div className="lg:col-span-1">
            <Button type="submit" size="lg" fullWidth isLoading={criar.isPending} aria-label="Adicionar item">
              <Plus size={19} /><span className="lg:hidden">Adicionar</span>
            </Button>
          </div>
        </form>
        <datalist id={gruposListId}>{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pendentes', label: 'Pendentes', count: pendentes.length },
            { value: 'comprados', label: 'Comprados', count: compras.length - pendentes.length },
          ]}
          className="sm:w-80"
        />
        <div className="sm:ml-auto sm:w-72">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item ou grupo" leftIcon={<Search size={17} />} className="h-11 bg-surface" />
        </div>
      </div>

      {comprasQ.isLoading ? (
        <Card className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</Card>
      ) : visiveis.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title={tab === 'pendentes' ? 'Nada a comprar' : 'Nenhum item comprado'}
            description={tab === 'pendentes' ? 'Adicione itens no formulário acima.' : 'Marque um item pendente como comprado.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          {porGrupo.map(([g, itens]) => {
            const aberto = abertos[g] ?? true;
            return (
              <Card key={g} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAbertos((s) => ({ ...s, [g]: !aberto }))}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-elevated/60 sm:px-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/12 text-info"><ShoppingCart size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-fg">{g}</span>
                    <span className="block text-[13px] text-muted">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-fg">{formatBRL(sum(itens))}</span>
                  <ChevronDown size={18} className={cn('shrink-0 text-subtle transition-transform', aberto && 'rotate-180')} />
                </button>
                {aberto && <div className="divide-y divide-line border-t border-line">{itens.map((c) => row(c, false))}</div>}
              </Card>
            );
          })}
          {avulsos.length > 0 && (
            <Card className="overflow-hidden">
              <ListGroupHeader title={<span className="flex items-center gap-1.5"><Tag size={14} /> Avulsos</span>} aside={formatBRL(sum(avulsos))} />
              <div className="divide-y divide-line">{avulsos.map((c) => row(c, false))}</div>
            </Card>
          )}
        </div>
      )}

      <EditarCompraSheet
        compra={editando}
        grupos={grupos}
        salvando={salvar.isPending}
        onClose={() => setEditando(null)}
        onSalvar={(c) => salvar.mutate(c)}
        onRemover={pedirRemocao}
      />

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Enviar no WhatsApp" description="Só os itens pendentes vão na mensagem." size="sm">
        <div className="space-y-2">
          {[
            { titulo: 'Toda a lista pendente', desc: 'Organizada por grupo', run: () => exportar('tudo') },
            { titulo: 'Só os itens avulsos', desc: 'Itens sem grupo', run: () => exportar('avulso') },
          ].map((o) => (
            <button key={o.titulo} type="button" onClick={o.run} className="w-full rounded-2xl border border-line bg-bg px-4 py-3.5 text-left transition-colors hover:border-line-strong">
              <span className="block text-[15px] font-semibold text-fg">{o.titulo}</span>
              <span className="block text-[13px] text-muted">{o.desc}</span>
            </button>
          ))}
          {grupos.length > 0 && (
            <div className="rounded-2xl border border-line bg-bg p-4">
              <p className="mb-3 text-sm font-semibold text-fg">Um grupo</p>
              <div className="flex flex-wrap gap-2">
                {grupos.map((g) => (
                  <Button key={g} variant="secondary" size="sm" onClick={() => exportar('grupo', g)}>{g}</Button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-bg p-4">
            <p className="mb-3 text-sm font-semibold text-fg">Por prioridade</p>
            <div className="grid grid-cols-3 gap-2">
              {PRIORIDADES.map((p) => (
                <Button key={p} variant="secondary" size="sm" onClick={() => exportar('prioridade', p)}>
                  <span className={cn('h-2 w-2 rounded-full', p === 'Alta' ? 'bg-neg' : p === 'Média' ? 'bg-warn' : 'bg-info')} />{p}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function EditarCompraSheet({ compra, grupos, salvando, onClose, onSalvar, onRemover }: {
  compra: Compra | null;
  grupos: string[];
  salvando: boolean;
  onClose: () => void;
  onSalvar: (c: Compra) => void;
  onRemover: (c: Compra) => void;
}) {
  const formId = useId();
  return (
    <Sheet
      open={!!compra}
      onClose={onClose}
      title="Editar item"
      size="sm"
      footer={compra && (
        <div className="flex gap-2">
          <Button variant="danger-soft" size="icon-lg" onClick={() => onRemover(compra)} aria-label="Remover item"><Trash2 size={18} /></Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId} size="lg" className="flex-[2]" isLoading={salvando}>Salvar</Button>
        </div>
      )}
    >
      {compra && <EditarCompraForm key={compra.id} formId={formId} compra={compra} grupos={grupos} onSalvar={onSalvar} />}
    </Sheet>
  );
}

function EditarCompraForm({ formId, compra, grupos, onSalvar }: { formId: string; compra: Compra; grupos: string[]; onSalvar: (c: Compra) => void }) {
  const listId = useId();
  const [item, setItem] = useState(compra.item);
  const [grupo, setGrupo] = useState(compra.grupo || '');
  const [prioridade, setPrioridade] = useState<Prioridade>(compra.prioridade);
  const [valor, setValor] = useState(toMoneyInput(compra.valor));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseMoney(valor);
    if (!item.trim() || !(v >= 0)) return;
    onSalvar({ ...compra, item: item.trim(), grupo: grupo.trim() || null, prioridade, valor: v });
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-4 pt-1">
      <Input label="Item" value={item} onChange={(e) => setItem(e.target.value)} required maxLength={120} />
      <Input label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Vazio para avulso" list={listId} maxLength={60} />
      <datalist id={listId}>{grupos.map((g) => <option key={g} value={g} />)}</datalist>
      <Field label="Prioridade">
        <Segmented value={prioridade} onChange={setPrioridade} options={PRIORIDADES.map((p) => ({ value: p, label: p }))} />
      </Field>
      <MoneyInput label="Valor" value={valor} onChange={setValor} required />
    </form>
  );
}
