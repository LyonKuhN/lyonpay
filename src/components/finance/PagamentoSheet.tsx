import { useId, useState } from 'react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input, MoneyInput, Select } from '../ui/input';
import { Switch } from '../ui/primitives';
import { useCartoes, useContas } from '../../hooks/queries';
import { useDespesaActions } from '../../hooks/useDespesaActions';
import { formatBRL, parseMoney, todayISO, toMoneyInput } from '../../lib/format';
import type { Despesa } from '../../lib/types';

interface Props {
  /** Uma conta (pagamento detalhado) ou várias (lote, fatura). */
  despesas: Despesa[] | null;
  title?: string;
  onClose: () => void;
  onPaid?: () => void;
}

/** Registrar pagamento: data real, conta de onde saiu e, para uma conta só, o valor efetivamente pago. */
export function PagamentoSheet({ despesas, title, onClose, onPaid }: Props) {
  const formId = useId();
  const open = !!despesas && despesas.length > 0;
  const actions = useDespesaActions();
  const unica = despesas?.length === 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? (unica ? 'Registrar pagamento' : `Pagar ${despesas?.length ?? 0} contas`)}
      description={unica ? despesas?.[0].descricao : undefined}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" form={formId} size="lg" className="flex-[2]" isLoading={actions.pagandoCom || actions.pagandoLote}>Confirmar pagamento</Button>
        </div>
      }
    >
      {open && <Corpo key={despesas!.map((d) => d.id).join()} formId={formId} despesas={despesas!} onDone={() => { onPaid?.(); onClose(); }} />}
    </Sheet>
  );
}

function Corpo({ formId, despesas, onDone }: { formId: string; despesas: Despesa[]; onDone: () => void }) {
  const actions = useDespesaActions();
  const { data: contas = [] } = useContas();
  const { data: cartoes = [] } = useCartoes();
  const unica = despesas.length === 1 ? despesas[0] : null;
  const total = despesas.reduce((a, d) => a + (Number(d.valor) || 0), 0);
  const ativas = contas.filter((c) => c.ativo);

  // Conta sugerida: a do lançamento, a de pagamento do cartão ou a única que existir
  const cartao = cartoes.find((c) => c.id === despesas[0]?.cartao_id);
  const sugerida = unica?.conta_id || cartao?.conta_pagamento_id || (ativas.length === 1 ? ativas[0].id : '');

  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState(toMoneyInput(total));
  const [conta, setConta] = useState(sugerida);
  const [restante, setRestante] = useState(true);
  const [error, setError] = useState('');

  const pago = parseMoney(valor);
  const diferenca = unica && pago > 0 ? Math.round((pago - total) * 100) / 100 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!data) return setError('Informe a data do pagamento.');
    try {
      if (unica) {
        if (!(pago > 0)) return setError('Informe o valor pago.');
        await actions.pagarCom({ id: unica.id, data_pagamento: data, valor_pago: pago, conta_id: conta || null, gerar_restante: diferenca < 0 && restante });
      } else {
        await actions.pagarLote({ ids: despesas.map((d) => d.id), data_pagamento: data, conta_id: conta || null });
      }
      onDone();
    } catch {
      // o aviso de erro já saiu pela mutação
    }
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
      {unica ? (
        <MoneyInput size="lg" label="Valor pago" value={valor} onChange={setValor} hint={`Valor da conta: ${formatBRL(total)}`} />
      ) : (
        <div className="rounded-2xl border border-line bg-bg px-4 py-3">
          <p className="text-[13px] text-muted">Total</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-fg">{formatBRL(total)}</p>
        </div>
      )}

      {diferenca > 0 && (
        <p className="rounded-xl bg-warn/12 px-4 py-3 text-sm text-fg">
          <strong className="font-semibold">{formatBRL(diferenca)}</strong> de juros ou multa. O valor pago entra nos relatórios e no saldo.
        </p>
      )}
      {diferenca < 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fg">Deixar {formatBRL(-diferenca)} pendente</p>
            <p className="mt-0.5 text-[13px] text-subtle">Cria uma conta com o que faltou pagar, no mesmo vencimento.</p>
          </div>
          <Switch checked={restante} onChange={setRestante} label="Deixar o restante pendente" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        <Select label="Saiu da conta" value={conta} onChange={(e) => setConta(e.target.value)}>
          <option value="">Não informar</option>
          {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
      </div>

      {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
    </form>
  );
}
