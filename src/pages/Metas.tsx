import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Goal, Minus, Plus, Trash2, Trophy } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useMetas } from '../hooks/queries';
import { useEspaco } from '../contexts/EspacoContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input, MoneyInput } from '../components/ui/input';
import { Badge, Card, EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui/primitives';
import { Stagger, StaggerItem } from '../components/ui/motion';
import { EASE_OUT } from '../lib/motion';
import { Sheet } from '../components/ui/sheet';
import { useChartColors } from '../components/finance/charts';
import { dateKey, daysUntil, formatBRL, formatDate, parseDateOnly, parseMoney, percent, todayISO, toMoneyInput } from '../lib/format';
import { asArray, type Meta, type MetaAporte } from '../lib/types';

/** Quanto guardar por mês para chegar no prazo. */
function porMes(m: Meta) {
  const falta = Number(m.valor_alvo) - Number(m.guardado);
  if (!m.prazo || falta <= 0) return null;
  const fim = parseDateOnly(m.prazo);
  if (!fim) return null;
  const hoje = new Date();
  const meses = Math.max(1, (fim.getFullYear() - hoje.getFullYear()) * 12 + fim.getMonth() - hoje.getMonth());
  return falta / meses;
}

/** Anel de progresso animado. */
function Anel({ pct, cor }: { pct: number; cor: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const { grid } = useChartColors();
  return (
    <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke={grid} strokeWidth="7" />
      <motion.circle
        cx="36" cy="36" r={r} fill="none" stroke={cor} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (Math.min(100, pct) / 100) * c }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      />
    </svg>
  );
}

export default function Metas() {
  const { somenteLeitura } = useEspaco();
  const metasQ = useMetas();
  const colors = useChartColors();
  const [form, setForm] = useState<{ meta?: Meta } | null>(null);
  const [aberta, setAberta] = useState<Meta | null>(null);
  const metas = metasQ.data ?? [];
  const ativas = metas.filter((m) => !m.concluida);
  const concluidas = metas.filter((m) => m.concluida);
  const totalGuardado = metas.reduce((a, m) => a + Number(m.guardado), 0);

  const card = (m: Meta) => {
    const pct = percent(Number(m.guardado), Number(m.valor_alvo));
    const mensal = porMes(m);
    const dias = m.prazo ? daysUntil(m.prazo) : null;
    return (
      <StaggerItem key={m.id}>
        <button type="button" onClick={() => setAberta(m)} className="block w-full text-left">
          <Card className="flex items-center gap-4 p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
            <div className="relative shrink-0">
              <Anel pct={pct} cor={m.concluida || pct >= 100 ? colors.pos : colors.brand} />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-fg">{pct}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-fg">{m.nome}</p>
              <p className="mt-0.5 text-sm tabular-nums text-muted"><span className="font-semibold text-fg">{formatBRL(m.guardado)}</span> de {formatBRL(m.valor_alvo)}</p>
              <p className="mt-1 text-[13px] text-subtle">
                {m.concluida ? 'Concluída' : mensal ? `Guarde ${formatBRL(mensal)}/mês para chegar até ${formatDate(m.prazo)}` : m.prazo ? (dias! < 0 ? 'Prazo passou' : `Até ${formatDate(m.prazo)}`) : 'Sem prazo'}
              </p>
            </div>
          </Card>
        </button>
      </StaggerItem>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Metas"
        description="Reserva de emergência, viagem, entrada do carro."
        actions={!somenteLeitura ? <Button onClick={() => setForm({})} className="w-full lg:w-auto"><Plus size={18} /> Nova meta</Button> : undefined}
      />

      {metas.length > 0 && (
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand"><Trophy size={22} /></span>
          <div>
            <p className="text-[13px] text-muted">Guardado em todas as metas</p>
            <p className="text-2xl font-semibold tabular-nums text-fg">{formatBRL(totalGuardado)}</p>
          </div>
        </Card>
      )}

      {metasQ.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : metas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Goal}
            title="Nenhuma meta ainda"
            description="Defina um valor e um prazo. O Lyonk mostra quanto guardar por mês."
            action={!somenteLeitura ? <Button onClick={() => setForm({})}><Plus size={17} /> Nova meta</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          <Stagger className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{ativas.map(card)}</Stagger>
          {concluidas.length > 0 && (
            <>
              <h2 className="px-1 pt-2 text-[15px] font-semibold text-fg">Concluídas</h2>
              <Stagger className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{concluidas.map(card)}</Stagger>
            </>
          )}
        </>
      )}

      <MetaFormSheet alvo={form} onClose={() => setForm(null)} />
      <MetaSheet meta={aberta} onClose={() => setAberta(null)} onEdit={(m) => { setAberta(null); setForm({ meta: m }); }} />
    </div>
  );
}

function MetaFormSheet({ alvo, onClose }: { alvo: { meta?: Meta } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const m = alvo?.meta;
  const [chave, setChave] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [prazo, setPrazo] = useState('');
  const [concluida, setConcluida] = useState(false);
  const k = alvo ? m?.id ?? 'nova' : null;
  if (k !== chave) {
    setChave(k);
    setNome(m?.nome ?? '');
    setValor(m ? toMoneyInput(m.valor_alvo) : '');
    setPrazo(m?.prazo ? dateKey(m.prazo) : '');
    setConcluida(!!m?.concluida);
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ nome: nome.trim(), valor_alvo: parseMoney(valor), prazo: prazo || null, concluida });
      return m ? apiFetch(`/api/metas/${m.id}`, { method: 'PUT', body }) : apiFetch('/api/metas', { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['metas'] }); toast.success(m ? 'Meta atualizada' : 'Meta criada'); onClose(); },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });
  const remover = useMutation({
    mutationFn: () => apiFetch(`/api/metas/${m!.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['metas'] }); toast.success('Meta excluída'); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet
      open={!!alvo}
      onClose={onClose}
      title={m ? 'Editar meta' : 'Nova meta'}
      size="sm"
      footer={
        <div className="flex gap-2">
          {m && (
            <Button variant="danger-soft" size="icon-lg" aria-label="Excluir meta" onClick={async () => {
              if (await confirm({ title: `Excluir ${m.nome}?`, description: 'Os aportes registrados também serão apagados.', confirmText: 'Excluir', danger: true })) remover.mutate();
            }}>
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" disabled={!nome.trim() || !(parseMoney(valor) > 0)} isLoading={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reserva de emergência" maxLength={80} autoFocus={!m} />
        <MoneyInput size="lg" label="Quanto quer juntar" value={valor} onChange={setValor} />
        <Input label="Prazo" type="date" value={prazo} min={todayISO()} onChange={(e) => setPrazo(e.target.value)} hint="Opcional. Com prazo, mostramos quanto guardar por mês." />
        {m && (
          <Segmented value={concluida ? 'sim' : 'nao'} onChange={(v) => setConcluida(v === 'sim')} options={[{ value: 'nao', label: 'Em andamento' }, { value: 'sim', label: 'Concluída' }]} />
        )}
      </div>
    </Sheet>
  );
}

function MetaSheet({ meta, onClose, onEdit }: { meta: Meta | null; onClose: () => void; onEdit: (m: Meta) => void }) {
  const qc = useQueryClient();
  const { somenteLeitura } = useEspaco();
  const [valor, setValor] = useState('');
  const [modo, setModo] = useState<'aporte' | 'retirada'>('aporte');
  const aportesQ = useQuery({
    queryKey: ['metas', meta?.id, 'aportes'],
    queryFn: () => apiFetch(`/api/metas/${meta!.id}/aportes`),
    enabled: !!meta,
    select: (d) => asArray<MetaAporte>(d),
  });
  const metasQ = useMetas();
  // Usa a versão mais nova da meta (o total muda depois de cada aporte)
  const atual = metasQ.data?.find((m) => m.id === meta?.id) ?? meta;

  const aportar = useMutation({
    mutationFn: () => apiFetch(`/api/metas/${meta!.id}/aportes`, {
      method: 'POST',
      body: JSON.stringify({ valor: (modo === 'retirada' ? -1 : 1) * parseMoney(valor) }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metas'] });
      toast.success(modo === 'aporte' ? 'Aporte registrado' : 'Retirada registrada');
      setValor('');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/metas/${meta!.id}/aportes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas'] }),
  });

  const pct = atual ? percent(Number(atual.guardado), Number(atual.valor_alvo)) : 0;

  return (
    <Sheet open={!!meta} onClose={onClose} title={atual?.nome} description={atual?.prazo ? `Prazo: ${formatDate(atual.prazo)}` : 'Sem prazo'} size="sm">
      {atual && (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-muted">Guardado</p>
              <p className="text-[30px] font-semibold leading-tight tabular-nums text-fg">{formatBRL(atual.guardado)}</p>
            </div>
            <Badge tone={pct >= 100 ? 'pos' : 'brand'}>{pct}% de {formatBRL(atual.valor_alvo, { cents: false })}</Badge>
          </div>
          {!somenteLeitura && (
            <div className="space-y-3 rounded-2xl border border-line bg-bg p-4">
              <Segmented size="sm" value={modo} onChange={setModo} options={[{ value: 'aporte', label: 'Guardar' }, { value: 'retirada', label: 'Retirar' }]} />
              <div className="flex items-end gap-2">
                <MoneyInput label="Valor" value={valor} onChange={setValor} />
                <Button size="lg" variant={modo === 'aporte' ? 'primary' : 'secondary'} disabled={!(parseMoney(valor) > 0)} isLoading={aportar.isPending} onClick={() => aportar.mutate()}>
                  {modo === 'aporte' ? <Plus size={18} /> : <Minus size={18} />}
                </Button>
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">Histórico</p>
            {(aportesQ.data ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-subtle">Nenhum aporte ainda.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-bg">
                {(aportesQ.data ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex-1 text-muted">{formatDate(a.data)}</span>
                    <span className={Number(a.valor) < 0 ? 'font-semibold tabular-nums text-neg' : 'font-semibold tabular-nums text-pos'}>{formatBRL(a.valor, { sign: true })}</span>
                    {!somenteLeitura && (
                      <button type="button" onClick={() => apagar.mutate(a.id)} aria-label="Apagar aporte" className="text-subtle hover:text-neg"><Trash2 size={14} /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!somenteLeitura && <Button variant="secondary" fullWidth onClick={() => onEdit(atual)}>Editar meta</Button>}
        </div>
      )}
    </Sheet>
  );
}
