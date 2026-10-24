import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, CreditCard, Landmark, PartyPopper, Receipt, Sparkles, TrendingUp } from 'lucide-react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Input, MoneyInput } from './ui/input';
import { EASE_OUT } from '../lib/motion';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';
import { invalidateFinance } from '../hooks/queries';
import { cn } from '../lib/cn';
import { parseMoney } from '../lib/format';

const FIXAS_COMUNS = [
  { nome: 'Aluguel', categoria: 'Moradia', dia: '10' },
  { nome: 'Condomínio', categoria: 'Moradia', dia: '10' },
  { nome: 'Energia', categoria: 'Moradia', dia: '15' },
  { nome: 'Água', categoria: 'Moradia', dia: '15' },
  { nome: 'Internet', categoria: 'Moradia', dia: '20' },
  { nome: 'Celular', categoria: 'Outros', dia: '20' },
  { nome: 'Streaming', categoria: 'Lazer', dia: '5' },
  { nome: 'Academia', categoria: 'Saúde', dia: '5' },
];

type Passo = 'inicio' | 'conta' | 'cartao' | 'renda' | 'fixas' | 'fim';
const ORDEM: Passo[] = ['inicio', 'conta', 'cartao', 'renda', 'fixas', 'fim'];

/** Assistente do primeiro acesso: em poucos toques o app já mostra o mês de verdade. */
export function Onboarding({ open, mes }: { open: boolean; mes: string }) {
  const { user, updateUser } = useAuth();
  const qc = useQueryClient();
  const [passo, setPasso] = useState<Passo>('inicio');
  const [direcao, setDirecao] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [fechado, setFechado] = useState(false);

  const [conta, setConta] = useState({ nome: 'Conta corrente', saldo: '' });
  const [cartao, setCartao] = useState({ nome: '', fechamento: '', vencimento: '' });
  const [renda, setRenda] = useState({ descricao: 'Salário', valor: '', dia: '5' });
  const [fixas, setFixas] = useState<Record<string, { valor: string; dia: string } | undefined>>({});
  const [contaId, setContaId] = useState<string | null>(null);

  const [ano, mesNum] = mes.split('-').map(Number);
  const idx = ORDEM.indexOf(passo);

  const ir = (p: Passo) => {
    setDirecao(ORDEM.indexOf(p) > idx ? 1 : -1);
    setPasso(p);
  };

  const concluir = async () => {
    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ onboarding_concluido: true }) });
    } catch {
      // se falhar, o assistente só aparece de novo no próximo acesso
    }
    if (user) updateUser({ ...user, onboarding_concluido: true });
    invalidateFinance(qc);
    setFechado(true);
  };

  /** Executa a gravação do passo e avança; erro fica na tela. */
  const salvarEAvancar = async (acao: () => Promise<void>, proximo: Passo) => {
    setSalvando(true);
    try {
      await acao();
      ir(proximo);
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  const salvarConta = () => salvarEAvancar(async () => {
    if (!conta.nome.trim()) return;
    const c = await apiFetch('/api/contas', { method: 'POST', body: JSON.stringify({ nome: conta.nome.trim(), tipo: 'corrente', saldo_inicial: parseMoney(conta.saldo) || 0 }) });
    setContaId(c.id);
  }, 'cartao');

  const salvarCartao = () => salvarEAvancar(async () => {
    await apiFetch('/api/cartoes', {
      method: 'POST',
      body: JSON.stringify({ nome: cartao.nome.trim(), dia_fechamento: parseInt(cartao.fechamento), dia_vencimento: parseInt(cartao.vencimento), conta_pagamento_id: contaId }),
    });
  }, 'renda');

  const salvarRenda = () => salvarEAvancar(async () => {
    await apiFetch('/api/recorrentes', {
      method: 'POST',
      body: JSON.stringify({
        descricao: renda.descricao.trim() || 'Salário', valor: parseMoney(renda.valor), dia: parseInt(renda.dia) || 5, categoria: 'Salário', conta_id: contaId,
        lancar_mes: { year: ano, month: mesNum },
      }),
    });
  }, 'fixas');

  const salvarFixas = () => salvarEAvancar(async () => {
    const escolhidas = FIXAS_COMUNS.filter((f) => fixas[f.nome] && parseMoney(fixas[f.nome]!.valor) > 0);
    for (const f of escolhidas) {
      const sel = fixas[f.nome]!;
      const dia = Math.max(1, Math.min(28, parseInt(sel.dia) || 10));
      const criada = await apiFetch('/api/despesas', {
        method: 'POST',
        body: JSON.stringify({
          descricao: f.nome, valor: parseMoney(sel.valor).toFixed(2), tipo: 'fixa', categoria: f.categoria, conta_id: contaId,
          data_vencimento: `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        }),
      });
      if (criada?.id) await apiFetch(`/api/despesas/${criada.id}/lancar-mes`, { method: 'POST', body: JSON.stringify({ year: ano, month: mesNum }) });
    }
  }, 'fim');

  const diaOk = (v: string) => parseInt(v) >= 1 && parseInt(v) <= 31;

  const telas: Record<Passo, React.ReactNode> = {
    inicio: (
      <div className="text-center">
        <motion.span
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/14 text-brand"
        >
          <Sparkles size={30} />
        </motion.span>
        <h2 className="text-xl font-semibold text-fg">Vamos deixar o Lyonk pronto</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          Em menos de um minuto: sua conta, seu cartão, sua renda e as contas fixas. Dá para pular qualquer passo.
        </p>
        <div className="mt-7 space-y-2">
          <Button size="lg" fullWidth onClick={() => ir('conta')}>Começar</Button>
          <Button size="lg" variant="ghost" fullWidth onClick={concluir}>Agora não</Button>
        </div>
      </div>
    ),
    conta: (
      <div>
        <Cabecalho icon={Landmark} titulo="Sua conta principal" texto="Onde o salário cai e de onde saem os pagamentos. Use o saldo que o app do banco mostra agora." />
        <div className="space-y-4">
          <Input label="Nome da conta" value={conta.nome} onChange={(e) => setConta({ ...conta, nome: e.target.value })} placeholder="Ex.: Nubank, Itaú" maxLength={60} />
          <MoneyInput size="lg" label="Saldo de hoje" value={conta.saldo} onChange={(v) => setConta({ ...conta, saldo: v })} />
        </div>
        <Rodape onPular={() => ir('cartao')} onSalvar={salvarConta} salvando={salvando} pode={!!conta.nome.trim()} />
      </div>
    ),
    cartao: (
      <div>
        <Cabecalho icon={CreditCard} titulo="Cartão de crédito" texto="Com o fechamento e o vencimento, cada compra cai sozinha na fatura certa." />
        <div className="space-y-4">
          <Input label="Nome do cartão" value={cartao.nome} onChange={(e) => setCartao({ ...cartao, nome: e.target.value })} placeholder="Ex.: Nubank" maxLength={60} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dia do fechamento" type="number" inputMode="numeric" min={1} max={31} value={cartao.fechamento} onChange={(e) => setCartao({ ...cartao, fechamento: e.target.value })} />
            <Input label="Dia do vencimento" type="number" inputMode="numeric" min={1} max={31} value={cartao.vencimento} onChange={(e) => setCartao({ ...cartao, vencimento: e.target.value })} />
          </div>
        </div>
        <Rodape onPular={() => ir('renda')} textoPular="Não uso cartão" onSalvar={salvarCartao} salvando={salvando} pode={!!cartao.nome.trim() && diaOk(cartao.fechamento) && diaOk(cartao.vencimento)} />
      </div>
    ),
    renda: (
      <div>
        <Cabecalho icon={TrendingUp} titulo="Sua renda mensal" texto="Entra sozinha todo mês como “a receber”; você só confirma quando cair." />
        <div className="space-y-4">
          <Input label="Descrição" value={renda.descricao} onChange={(e) => setRenda({ ...renda, descricao: e.target.value })} maxLength={80} />
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <MoneyInput label="Valor" value={renda.valor} onChange={(v) => setRenda({ ...renda, valor: v })} />
            <Input label="Dia" type="number" inputMode="numeric" min={1} max={31} value={renda.dia} onChange={(e) => setRenda({ ...renda, dia: e.target.value })} />
          </div>
        </div>
        <Rodape onPular={() => ir('fixas')} onSalvar={salvarRenda} salvando={salvando} pode={parseMoney(renda.valor) > 0 && diaOk(renda.dia)} />
      </div>
    ),
    fixas: (
      <div>
        <Cabecalho icon={Receipt} titulo="Contas fixas" texto="Marque as que você paga todo mês. Elas entram neste mês e se repetem sozinhas." />
        <div className="grid grid-cols-2 gap-2">
          {FIXAS_COMUNS.map((f) => {
            const sel = fixas[f.nome];
            return (
              <div key={f.nome} className={cn('rounded-xl border transition-colors', sel ? 'border-brand/50 bg-brand/6' : 'border-line')}>
                <button
                  type="button"
                  onClick={() => setFixas((x) => ({ ...x, [f.nome]: sel ? undefined : { valor: '', dia: f.dia } }))}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-fg"
                >
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', sel ? 'border-brand bg-brand text-on-brand' : 'border-line-strong')}>
                    {sel && <Check size={12} strokeWidth={3} />}
                  </span>
                  {f.nome}
                </button>
                <AnimatePresence initial={false}>
                  {sel && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-[1fr_56px] gap-1.5 px-2 pb-2">
                        <input
                          inputMode="decimal"
                          placeholder="R$ 0,00"
                          value={sel.valor}
                          onChange={(e) => setFixas((x) => ({ ...x, [f.nome]: { ...sel, valor: e.target.value.replace(/[^\d,.]/g, '') } }))}
                          className="h-9 min-w-0 rounded-lg border border-line-strong bg-bg px-2 text-base text-fg outline-none focus:border-brand sm:text-sm"
                          aria-label={`Valor de ${f.nome}`}
                        />
                        <input
                          inputMode="numeric"
                          value={sel.dia}
                          onChange={(e) => setFixas((x) => ({ ...x, [f.nome]: { ...sel, dia: e.target.value.replace(/\D/g, '').slice(0, 2) } }))}
                          className="h-9 min-w-0 rounded-lg border border-line-strong bg-bg px-2 text-center text-base text-fg outline-none focus:border-brand sm:text-sm"
                          aria-label={`Dia do vencimento de ${f.nome}`}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-subtle">Valor e dia do vencimento. Outras fixas você cadastra depois em Despesas.</p>
        <Rodape
          onPular={() => ir('fim')}
          onSalvar={salvarFixas}
          salvando={salvando}
          pode={FIXAS_COMUNS.some((f) => fixas[f.nome] && parseMoney(fixas[f.nome]!.valor) > 0)}
        />
      </div>
    ),
    fim: (
      <div className="text-center">
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: [0, 1.2, 1], rotate: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-pos/14 text-pos"
        >
          <PartyPopper size={30} />
        </motion.span>
        <h2 className="text-xl font-semibold text-fg">Tudo pronto</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          Agora é só lançar o dia a dia pelo botão +. Se tiver o extrato do banco, importe em Importar extrato.
        </p>
        <Button size="lg" fullWidth className="mt-7" onClick={concluir}>Ver meu painel</Button>
      </div>
    ),
  };

  return (
    <Sheet open={open && !fechado} onClose={concluir} size="sm" bare>
      <div className="pt-3 sm:pt-5">
        {/* Progresso */}
        {passo !== 'inicio' && passo !== 'fim' && (
          <div className="mb-5 flex gap-1.5">
            {ORDEM.slice(1, -1).map((p, i) => (
              <span key={p} className="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
                <motion.span
                  className="block h-full rounded-full bg-brand"
                  initial={false}
                  animate={{ width: i < idx ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                />
              </span>
            ))}
          </div>
        )}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direcao} initial={false}>
            <motion.div
              key={passo}
              custom={direcao}
              initial={{ opacity: 0, x: direcao * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direcao * -40 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {telas[passo]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Sheet>
  );
}

function Cabecalho({ icon: Icon, titulo, texto }: { icon: typeof Landmark; titulo: string; texto: string }) {
  return (
    <div className="mb-5">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/12 text-brand"><Icon size={21} /></span>
      <h2 className="text-lg font-semibold text-fg">{titulo}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{texto}</p>
    </div>
  );
}

function Rodape({ onPular, onSalvar, salvando, pode, textoPular = 'Pular' }: {
  onPular: () => void;
  onSalvar: () => void;
  salvando: boolean;
  pode: boolean;
  textoPular?: string;
}) {
  return (
    <div className="mt-6 flex gap-2">
      <Button variant="ghost" size="lg" className="flex-1" onClick={onPular} disabled={salvando}>{textoPular}</Button>
      <Button size="lg" className="flex-[2]" onClick={onSalvar} isLoading={salvando} disabled={!pode}>Continuar</Button>
    </div>
  );
}
