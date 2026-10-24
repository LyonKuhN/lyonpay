import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight, Banknote, Building2, CreditCard, Landmark, LineChart, Pencil, PiggyBank, Plus, Scale, Trash2, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { invalidateFinance, useCartoes, useDespesas, useSaldoDetalhado, useTransferencias } from '../hooks/queries';
import { useQuickActions } from '../components/layout/AppShell';
import { useEspaco } from '../contexts/EspacoContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Field, Input, MoneyInput, Select } from '../components/ui/input';
import { Badge, Card, CardHeader, EmptyState, IconTile, PageHeader, ProgressBar, Segmented, Skeleton, Switch } from '../components/ui/primitives';
import { AnimatedNumber, Stagger, StaggerItem } from '../components/ui/motion';
import { Sheet } from '../components/ui/sheet';
import { TxRow } from '../components/finance/TxRow';
import { FaturaSheet } from '../components/finance/FaturaSheet';
import { DespesaDetailSheet } from '../components/finance/DespesaDetailSheet';
import { DespesaFormSheet, type DespesaFormTarget } from '../components/forms/DespesaForm';
import { agruparFaturas, type Fatura } from '../lib/fatura';
import { cn } from '../lib/cn';
import { dueStatus, formatBRL, formatDate, formatDayMonth, parseMoney, percent, todayISO, toMoneyInput } from '../lib/format';
import { TIPO_CONTA_LABEL, type Cartao, type Conta, type Despesa, type Escopo, type TipoConta } from '../lib/types';

const ICONE_CONTA: Record<TipoConta, LucideIcon> = {
  corrente: Landmark,
  poupanca: PiggyBank,
  carteira: Banknote,
  investimento: LineChart,
};

export default function Carteira() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { newTransferencia } = useQuickActions();
  const { somenteLeitura } = useEspaco();
  const saldoQ = useSaldoDetalhado();
  const { data: cartoes = [], isLoading: carregandoCartoes } = useCartoes();
  const { data: despesas = [] } = useDespesas();
  const { data: transferencias = [] } = useTransferencias();

  const [contaForm, setContaForm] = useState<{ conta?: Conta } | null>(null);
  const [cartaoForm, setCartaoForm] = useState<{ cartao?: Cartao } | null>(null);
  const [ajustando, setAjustando] = useState<Conta | null>(null);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [detail, setDetail] = useState<Despesa | null>(null);
  const [editTarget, setEditTarget] = useState<DespesaFormTarget | null>(null);

  const contas = saldoQ.data?.contas ?? [];
  const ativas = contas.filter((c) => c.ativo);
  const inativas = contas.filter((c) => !c.ativo);

  // Faturas em aberto por cartão: a próxima a vencer e o limite comprometido
  const porCartao = useMemo(() => {
    const { faturas } = agruparFaturas(despesas.filter((d) => d.cartao_id), cartoes);
    const mapa = new Map<string, { abertas: Fatura[]; usado: number }>();
    for (const c of cartoes) mapa.set(c.id, { abertas: [], usado: 0 });
    for (const f of faturas) {
      const m = mapa.get(f.cartao.id);
      if (!m || f.paga) continue;
      m.abertas.push(f);
      m.usado += f.pendente;
    }
    return mapa;
  }, [despesas, cartoes]);

  const removerConta = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/contas/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateFinance(qc); toast.success('Conta excluída'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const removerCartao = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cartoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateFinance(qc); toast.success('Cartão excluído'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const removerTransf = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/transferencias/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidateFinance(qc); toast.success('Transferência excluída'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? 'Conta excluída';

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Contas e cartões"
        description="Saldo de cada conta, faturas dos cartões e transferências."
        actions={!somenteLeitura ? (
          <>
            <Button variant="secondary" onClick={newTransferencia} className="flex-1 lg:flex-none"><ArrowLeftRight size={17} /> Transferir</Button>
            <Button onClick={() => setContaForm({})} className="flex-1 lg:flex-none"><Plus size={18} /> Nova conta</Button>
          </>
        ) : undefined}
      />

      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
        <p className="text-[13px] font-medium text-muted">Saldo somado das contas</p>
        {saldoQ.isLoading ? <Skeleton className="mt-2 h-10 w-48" /> : (
          <AnimatedNumber value={saldoQ.data?.total ?? 0} format={(n) => formatBRL(n)} className="mt-1 block text-[34px] font-semibold leading-tight tracking-tight text-fg" />
        )}
        {(saldoQ.data?.semConta ?? 0) !== 0 && (
          <p className="mt-1 text-[13px] text-subtle">Inclui {formatBRL(saldoQ.data!.semConta)} de lançamentos sem conta definida.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-2 xl:items-start">
        {/* Contas */}
        <section className="space-y-3">
          <h2 className="px-1 text-[15px] font-semibold text-fg">Contas</h2>
          {saldoQ.isLoading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : ativas.length === 0 ? (
            <Card>
              <EmptyState
                icon={Wallet}
                title="Nenhuma conta cadastrada"
                description="Cadastre suas contas com o saldo de hoje. Daí em diante o Lyonk acompanha cada uma."
                action={!somenteLeitura ? <Button onClick={() => setContaForm({})}><Plus size={17} /> Nova conta</Button> : undefined}
              />
            </Card>
          ) : (
            <Stagger className="grid gap-3 sm:grid-cols-2">
              {ativas.map((c) => {
                const Icon = ICONE_CONTA[c.tipo] ?? Building2;
                return (
                  <StaggerItem key={c.id}>
                    <Card className="group p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong">
                      <div className="flex items-start gap-3">
                        <IconTile icon={Icon} tone={c.escopo === 'empresa' ? 'info' : 'brand'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-fg">{c.nome}</p>
                          <p className="text-[13px] text-muted">{TIPO_CONTA_LABEL[c.tipo]}{c.escopo === 'empresa' ? ' · Empresa' : ''}</p>
                        </div>
                        {!somenteLeitura && (
                          <button type="button" onClick={() => setContaForm({ conta: c })} aria-label={`Editar ${c.nome}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-elevated hover:text-fg">
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                      <p className={cn('mt-4 text-2xl font-semibold tracking-tight tabular-nums', (c.saldo ?? 0) < 0 ? 'text-neg' : 'text-fg')}>{formatBRL(c.saldo)}</p>
                      {!somenteLeitura && (
                        <button type="button" onClick={() => setAjustando(c)} className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
                          <Scale size={14} /> Conferir com o extrato
                        </button>
                      )}
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
          {inativas.length > 0 && (
            <p className="px-1 text-[13px] text-subtle">
              Arquivadas: {inativas.map((c) => (
                <button key={c.id} type="button" onClick={() => setContaForm({ conta: c })} className="mr-2 underline-offset-2 hover:underline">{c.nome}</button>
              ))}
            </p>
          )}
        </section>

        {/* Cartões */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold text-fg">Cartões de crédito</h2>
            {!somenteLeitura && cartoes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCartaoForm({})}><Plus size={15} /> Novo cartão</Button>
            )}
          </div>
          {carregandoCartoes ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : cartoes.length === 0 ? (
            <Card>
              <EmptyState
                icon={CreditCard}
                title="Nenhum cartão cadastrado"
                description="Com o dia de fechamento e de vencimento, cada compra cai sozinha na fatura certa."
                action={!somenteLeitura ? <Button onClick={() => setCartaoForm({})}><Plus size={17} /> Novo cartão</Button> : undefined}
              />
            </Card>
          ) : (
            <Stagger className="space-y-3">
              {cartoes.map((c) => {
                const info = porCartao.get(c.id);
                const proxima = info?.abertas[0];
                const limite = Number(c.limite) || 0;
                const uso = limite ? percent(info?.usado ?? 0, limite) : 0;
                const st = proxima ? dueStatus(proxima.vencimento) : null;
                return (
                  <StaggerItem key={c.id}>
                    <Card className={cn('overflow-hidden', !c.ativo && 'opacity-60')}>
                      {/* Cartão desenhado: dá identidade visual e mostra o essencial */}
                      <div className="relative overflow-hidden bg-gradient-to-br from-[#2a2418] via-[#1a1712] to-[#0e0d0b] p-5 text-white">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#d4af5f]/25 blur-2xl" />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{c.nome}</p>
                            <p className="text-xs text-white/60">{c.bandeira || 'Cartão de crédito'} · fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}</p>
                          </div>
                          {!somenteLeitura && (
                            <button type="button" onClick={() => setCartaoForm({ cartao: c })} aria-label={`Editar ${c.nome}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
                              <Pencil size={15} />
                            </button>
                          )}
                        </div>
                        <div className="relative mt-6 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs text-white/60">Em aberto</p>
                            <p className="text-2xl font-semibold tabular-nums">{formatBRL(info?.usado ?? 0)}</p>
                          </div>
                          {limite > 0 && <p className="text-right text-xs text-white/60">Limite<br /><span className="text-sm font-semibold text-white tabular-nums">{formatBRL(limite)}</span></p>}
                        </div>
                        {limite > 0 && <ProgressBar value={uso} tone={uso > 80 ? 'warn' : 'brand'} className="relative mt-3 bg-white/15" />}
                      </div>
                      {proxima && st ? (
                        <TxRow
                          icon={CreditCard}
                          tone={st.tone === 'neg' ? 'neg' : st.tone === 'warn' ? 'warn' : 'brand'}
                          title="Próxima fatura"
                          subtitle={<span className={st.tone === 'neg' ? 'text-neg' : ''}>{st.text} · {proxima.itens.length} {proxima.itens.length === 1 ? 'compra' : 'compras'}</span>}
                          amount={formatBRL(proxima.pendente)}
                          onClick={() => setFatura(proxima)}
                        />
                      ) : (
                        <p className="px-5 py-3.5 text-[13px] text-subtle">Nenhuma fatura em aberto.</p>
                      )}
                      {info && info.abertas.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-3 sm:px-5">
                          {info.abertas.slice(1, 7).map((f) => (
                            <button key={f.key} type="button" onClick={() => setFatura(f)} className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-left hover:border-line-strong">
                              <span className="block text-[11px] text-subtle">{formatDayMonth(f.vencimento)}</span>
                              <span className="block text-[13px] font-semibold tabular-nums text-fg">{formatBRL(f.pendente)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </section>
      </div>

      {/* Transferências */}
      {transferencias.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Transferências" description="Movimentações entre as suas contas" />
          <div className="mt-3 divide-y divide-line border-t border-line">
            {transferencias.slice(0, 12).map((t) => (
              <TxRow
                key={t.id}
                icon={ArrowLeftRight}
                tone="info"
                title={t.descricao || `${nomeConta(t.origem_id)} → ${nomeConta(t.destino_id)}`}
                subtitle={<span>{formatDate(t.data)}{t.descricao ? ` · ${nomeConta(t.origem_id)} → ${nomeConta(t.destino_id)}` : ''}</span>}
                amount={formatBRL(t.valor)}
                meta={!somenteLeitura ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirm({ title: 'Excluir transferência?', description: 'Os saldos das duas contas voltam ao que eram.', confirmText: 'Excluir', danger: true })) removerTransf.mutate(t.id);
                    }}
                    className="text-xs font-medium text-subtle hover:text-neg"
                  >
                    Excluir
                  </button>
                ) : undefined}
              />
            ))}
          </div>
        </Card>
      )}

      <ContaSheet
        alvo={contaForm}
        onClose={() => setContaForm(null)}
        onDelete={async (c) => {
          const ok = await confirm({
            title: `Excluir ${c.nome}?`,
            description: 'Os lançamentos continuam, só deixam de estar ligados a esta conta. Transferências dela são apagadas. Para guardar o histórico, prefira arquivar.',
            confirmText: 'Excluir',
            danger: true,
          });
          if (ok) {
            removerConta.mutate(c.id);
            setContaForm(null);
          }
        }}
      />
      <CartaoSheet
        alvo={cartaoForm}
        contas={ativas}
        onClose={() => setCartaoForm(null)}
        onDelete={async (c) => {
          const ok = await confirm({
            title: `Excluir ${c.nome}?`,
            description: 'As compras continuam nas contas a pagar, mas sem o agrupamento em fatura.',
            confirmText: 'Excluir',
            danger: true,
          });
          if (ok) {
            removerCartao.mutate(c.id);
            setCartaoForm(null);
          }
        }}
      />
      <AjusteSheet conta={ajustando} onClose={() => setAjustando(null)} />
      <FaturaSheet fatura={fatura} onClose={() => setFatura(null)} onOpenDespesa={(d) => { setFatura(null); setDetail(d); }} />
      <DespesaDetailSheet despesa={detail} onClose={() => setDetail(null)} onEdit={(d) => setEditTarget({ despesa: d })} />
      <DespesaFormSheet open={!!editTarget} target={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- formulários

function EscopoField({ value, onChange }: { value: Escopo; onChange: (v: Escopo) => void }) {
  const { modoEmpresa } = useEspaco();
  if (!modoEmpresa) return null;
  return (
    <Field label="Escopo">
      <Segmented value={value} onChange={onChange} options={[{ value: 'pessoal', label: 'Pessoal' }, { value: 'empresa', label: 'Empresa' }]} />
    </Field>
  );
}

function ContaSheet({ alvo, onClose, onDelete }: { alvo: { conta?: Conta } | null; onClose: () => void; onDelete: (c: Conta) => void }) {
  const qc = useQueryClient();
  const { visao } = useEspaco();
  const c = alvo?.conta;
  const [chave, setChave] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoConta>('corrente');
  const [saldo, setSaldo] = useState('');
  const [escopo, setEscopo] = useState<Escopo>('pessoal');
  const [ativo, setAtivo] = useState(true);

  // Ao abrir, os campos assumem os valores da conta (ou ficam em branco para uma nova)
  const k = alvo ? c?.id ?? 'nova' : null;
  if (k !== chave) {
    setChave(k);
    setNome(c?.nome ?? '');
    setTipo(c?.tipo ?? 'corrente');
    setSaldo(c ? toMoneyInput(c.saldo_inicial) : '');
    setEscopo(c?.escopo ?? (visao !== 'tudo' ? visao : 'pessoal'));
    setAtivo(c?.ativo ?? true);
  }

  const salvar = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ nome: nome.trim(), tipo, saldo_inicial: parseMoney(saldo) || 0, escopo, ativo });
      return c ? apiFetch(`/api/contas/${c.id}`, { method: 'PUT', body }) : apiFetch('/api/contas', { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success(c ? 'Conta atualizada' : 'Conta criada');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  return (
    <Sheet
      open={!!alvo}
      onClose={onClose}
      title={c ? 'Editar conta' : 'Nova conta'}
      size="sm"
      footer={
        <div className="flex gap-2">
          {c && <Button variant="danger-soft" size="icon-lg" onClick={() => onDelete(c)} aria-label="Excluir conta"><Trash2 size={18} /></Button>}
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" isLoading={salvar.isPending} disabled={!nome.trim()} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" maxLength={60} autoFocus={!c} />
        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)}>
          {(Object.keys(TIPO_CONTA_LABEL) as TipoConta[]).map((t) => <option key={t} value={t}>{TIPO_CONTA_LABEL[t]}</option>)}
        </Select>
        <MoneyInput
          label={c ? 'Saldo inicial' : 'Saldo de hoje'}
          value={saldo}
          onChange={setSaldo}
          hint={c ? 'O saldo atual é este valor mais tudo o que entrou e saiu da conta.' : 'Use o saldo que aparece no app do banco agora.'}
        />
        <EscopoField value={escopo} onChange={setEscopo} />
        {c && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Conta ativa</p>
              <p className="mt-0.5 text-[13px] text-subtle">Arquivada, ela sai do saldo e das listas, mas o histórico fica.</p>
            </div>
            <Switch checked={ativo} onChange={setAtivo} label="Conta ativa" />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CartaoSheet({ alvo, contas, onClose, onDelete }: { alvo: { cartao?: Cartao } | null; contas: Conta[]; onClose: () => void; onDelete: (c: Cartao) => void }) {
  const qc = useQueryClient();
  const { visao } = useEspaco();
  const c = alvo?.cartao;
  const [chave, setChave] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [bandeira, setBandeira] = useState('');
  const [limite, setLimite] = useState('');
  const [fechamento, setFechamento] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [contaPag, setContaPag] = useState('');
  const [escopo, setEscopo] = useState<Escopo>('pessoal');
  const [ativo, setAtivo] = useState(true);

  const k = alvo ? c?.id ?? 'novo' : null;
  if (k !== chave) {
    setChave(k);
    setNome(c?.nome ?? '');
    setBandeira(c?.bandeira ?? '');
    setLimite(c?.limite ? toMoneyInput(c.limite) : '');
    setFechamento(c ? String(c.dia_fechamento) : '');
    setVencimento(c ? String(c.dia_vencimento) : '');
    setContaPag(c?.conta_pagamento_id ?? (contas.length === 1 ? contas[0].id : ''));
    setEscopo(c?.escopo ?? (visao !== 'tudo' ? visao : 'pessoal'));
    setAtivo(c?.ativo ?? true);
  }

  const diaOk = (v: string) => parseInt(v) >= 1 && parseInt(v) <= 31;

  const salvar = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        nome: nome.trim(), bandeira: bandeira.trim() || null, limite: parseMoney(limite) || null,
        dia_fechamento: parseInt(fechamento), dia_vencimento: parseInt(vencimento), conta_pagamento_id: contaPag || null, escopo, ativo,
      });
      return c ? apiFetch(`/api/cartoes/${c.id}`, { method: 'PUT', body }) : apiFetch('/api/cartoes', { method: 'POST', body });
    },
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success(c ? 'Cartão atualizado' : 'Cartão criado');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  // Exemplo com a data de hoje, para a pessoa conferir se entendeu o fechamento
  const exemplo = diaOk(fechamento) && diaOk(vencimento) ? (() => {
    const hoje = todayISO();
    const d = parseInt(hoje.slice(8));
    return d >= parseInt(fechamento) ? 'Compras de hoje já entram na fatura seguinte.' : 'Compras de hoje entram na fatura atual.';
  })() : null;

  return (
    <Sheet
      open={!!alvo}
      onClose={onClose}
      title={c ? 'Editar cartão' : 'Novo cartão'}
      size="sm"
      footer={
        <div className="flex gap-2">
          {c && <Button variant="danger-soft" size="icon-lg" onClick={() => onDelete(c)} aria-label="Excluir cartão"><Trash2 size={18} /></Button>}
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" isLoading={salvar.isPending} disabled={!nome.trim() || !diaOk(fechamento) || !diaOk(vencimento)} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank" maxLength={60} autoFocus={!c} />
          <Input label="Bandeira" value={bandeira} onChange={(e) => setBandeira(e.target.value)} placeholder="Visa" maxLength={20} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Dia do fechamento" type="number" inputMode="numeric" min={1} max={31} value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
          <Input label="Dia do vencimento" type="number" inputMode="numeric" min={1} max={31} value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        {exemplo && <p className="-mt-1 text-[13px] text-subtle">{exemplo}</p>}
        <MoneyInput label="Limite" value={limite} onChange={setLimite} hint="Opcional. Mostra quanto do limite está comprometido." />
        <Select label="Fatura paga pela conta" value={contaPag} onChange={(e) => setContaPag(e.target.value)}>
          <option value="">Não informar</option>
          {contas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </Select>
        <EscopoField value={escopo} onChange={setEscopo} />
        {c && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <p className="text-sm font-medium text-fg">Cartão ativo</p>
            <Switch checked={ativo} onChange={setAtivo} label="Cartão ativo" />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Conferência: a pessoa informa o saldo do extrato e o Lyonk acerta a diferença no saldo inicial. */
function AjusteSheet({ conta, onClose }: { conta: Conta | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [real, setReal] = useState('');
  const [chave, setChave] = useState<string | null>(null);
  if ((conta?.id ?? null) !== chave) {
    setChave(conta?.id ?? null);
    setReal(conta ? toMoneyInput(conta.saldo ?? 0) : '');
  }
  const atual = conta?.saldo ?? 0;
  const diferenca = Math.round((parseMoney(real) - atual) * 100) / 100;

  const salvar = useMutation({
    mutationFn: () => apiFetch(`/api/contas/${conta!.id}/ajustar`, { method: 'POST', body: JSON.stringify({ saldo_real: parseMoney(real) }) }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Saldo conferido');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível ajustar'),
  });

  return (
    <Sheet
      open={!!conta}
      onClose={onClose}
      title="Conferir com o extrato"
      description={conta?.nome}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[2]" isLoading={salvar.isPending} disabled={!Number.isFinite(diferenca) || diferenca === 0} onClick={() => salvar.mutate()}>Ajustar saldo</Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-2xl border border-line bg-bg px-4 py-3">
          <p className="text-[13px] text-muted">Saldo no Lyonk</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{formatBRL(atual)}</p>
        </div>
        <MoneyInput size="lg" label="Saldo no app do banco" value={real} onChange={setReal} />
        {Number.isFinite(diferenca) && diferenca !== 0 ? (
          <p className="rounded-xl bg-warn/12 px-4 py-3 text-sm text-fg">
            Diferença de <strong className="font-semibold">{formatBRL(diferenca, { sign: true })}</strong>. Normalmente é um lançamento esquecido; se não achar, ajuste aqui.
          </p>
        ) : (
          <Badge tone="pos">Saldos batem</Badge>
        )}
      </div>
    </Sheet>
  );
}
