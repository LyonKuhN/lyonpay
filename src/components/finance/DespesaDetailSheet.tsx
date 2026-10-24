import { useState } from 'react';
import { CircleCheck, Pencil, ReceiptText, RotateCcw, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { MoneyInput } from '../ui/input';
import { Badge, TONE_TEXT } from '../ui/primitives';
import { PagamentoSheet } from './PagamentoSheet';
import { Anexos } from './Anexos';
import { useDespesaActions } from '../../hooks/useDespesaActions';
import { useCartoes, useContas } from '../../hooks/queries';
import { useEspaco } from '../../contexts/EspacoContext';
import { cn } from '../../lib/cn';
import { dueStatus, formatBRL, formatDate, parseMoney, toMoneyInput } from '../../lib/format';
import { normalizeTipo, TIPO_LABEL, valorEfetivo, type Despesa } from '../../lib/types';

interface Props {
  despesa: Despesa | null;
  onClose: () => void;
  onEdit: (d: Despesa) => void;
}

/** Detalhes de uma conta com as ações mais usadas no celular: pagar, ajustar valor, comprovantes, editar e excluir. */
export function DespesaDetailSheet({ despesa, onClose, onEdit }: Props) {
  const [pagando, setPagando] = useState<Despesa[] | null>(null);
  return (
    <>
      <Sheet open={!!despesa} onClose={onClose} title={despesa?.descricao} description={despesa?.categoria || 'Sem categoria'} size="sm">
        {despesa && <DetailBody key={despesa.id} d={despesa} onClose={onClose} onEdit={onEdit} onPagar={() => setPagando([despesa])} />}
      </Sheet>
      <PagamentoSheet despesas={pagando} onClose={() => setPagando(null)} onPaid={onClose} />
    </>
  );
}

function DetailBody({ d, onClose, onEdit, onPagar }: { d: Despesa; onClose: () => void; onEdit: (d: Despesa) => void; onPagar: () => void }) {
  const actions = useDespesaActions();
  const { somenteLeitura } = useEspaco();
  const { data: contas = [] } = useContas();
  const { data: cartoes = [] } = useCartoes();
  const [valor, setValor] = useState(toMoneyInput(d.valor));
  const st = dueStatus(d.data_vencimento);
  const tipo = normalizeTipo(d.tipo);
  const changed = parseMoney(valor) > 0 && Math.abs(parseMoney(valor) - Number(d.valor)) > 0.004;
  const conta = contas.find((c) => c.id === d.conta_id);
  const cartao = cartoes.find((c) => c.id === d.cartao_id);
  const efetivo = valorEfetivo(d);
  const diferenca = d.pago ? Math.round((efetivo - Number(d.valor)) * 100) / 100 : 0;

  const rows: Array<[string, React.ReactNode]> = [
    [cartao ? 'Vencimento da fatura' : 'Vencimento', <>{formatDate(d.data_vencimento)}{!d.pago && <span className={cn('ml-2', TONE_TEXT[st.tone])}>{st.text}</span>}</>],
    ['Tipo', <>{TIPO_LABEL[tipo]}{d.parcela_atual && Number(d.numero_parcelas) > 1 ? ` · parcela ${d.parcela_atual} de ${d.numero_parcelas}` : ''}</>],
  ];
  if (cartao) rows.push(['Cartão', <>{cartao.nome}{d.data_compra ? ` · compra em ${formatDate(d.data_compra)}` : ''}</>]);
  if (d.pago && d.data_pagamento) rows.push(['Paga em', formatDate(d.data_pagamento)]);
  if (d.pago && diferenca !== 0) {
    rows.push(['Valor pago', <>{formatBRL(efetivo)} <span className={diferenca > 0 ? 'text-warn' : 'text-muted'}>({diferenca > 0 ? `+${formatBRL(diferenca)} de juros/multa` : 'parcial'})</span></>]);
  }
  if (conta) rows.push([d.pago ? 'Saiu de' : 'Conta', conta.nome]);
  if (d.escopo === 'empresa') rows.push(['Escopo', 'Empresa']);
  if (d.observacoes) rows.push(['Observações', d.observacoes]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-fg">{formatBRL(d.pago ? efetivo : d.valor)}</p>
        {d.pago ? <Badge tone="pos"><CircleCheck size={12} /> Paga</Badge> : <Badge tone={st.tone}>{st.text}</Badge>}
      </div>

      <dl className="divide-y divide-line rounded-2xl border border-line bg-bg">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-right font-medium text-fg">{v}</dd>
          </div>
        ))}
      </dl>

      {!d.pago && !somenteLeitura && (
        <div className="flex items-end gap-2">
          <MoneyInput label="Ajustar valor desta conta" value={valor} onChange={setValor} />
          <Button
            variant="secondary"
            size="lg"
            disabled={!changed}
            isLoading={actions.savingValor}
            onClick={async () => {
              await actions.updateValor({ id: d.id, valor: parseMoney(valor) });
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      )}

      <Anexos despesaId={d.id} />

      {!somenteLeitura && (
        <div className="space-y-2">
          {d.pago ? (
            <Button variant="secondary" size="lg" fullWidth onClick={() => { actions.desfazer(d); onClose(); }}>
              <RotateCcw size={18} /> Marcar como pendente
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => { actions.pagar(d); onClose(); }}>
                <CircleCheck size={18} /> Paga hoje
              </Button>
              <Button variant="secondary" size="lg" onClick={onPagar}>
                <ReceiptText size={18} /> Detalhar
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={() => { onClose(); onEdit(d); }}>
              <Pencil size={17} /> Editar
            </Button>
            <Button variant="danger-soft" size="lg" onClick={async () => { if (await actions.remove(d)) onClose(); }}>
              <Trash2 size={17} /> Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
