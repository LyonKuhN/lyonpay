import { useState } from 'react';
import { CircleCheck, CreditCard } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge, ProgressBar } from '../ui/primitives';
import { TxRow } from './TxRow';
import { PagamentoSheet } from './PagamentoSheet';
import { useEspaco } from '../../contexts/EspacoContext';
import { categoryIcon } from '../../lib/categories';
import { dueStatus, formatBRL, formatDate, formatDayMonth, percent } from '../../lib/format';
import type { Fatura } from '../../lib/fatura';
import type { Despesa } from '../../lib/types';

/** Fatura do cartão: compras que caíram nela e o pagamento de tudo de uma vez. */
export function FaturaSheet({ fatura, onClose, onOpenDespesa }: {
  fatura: Fatura | null;
  onClose: () => void;
  onOpenDespesa?: (d: Despesa) => void;
}) {
  const { somenteLeitura } = useEspaco();
  const [pagando, setPagando] = useState<Despesa[] | null>(null);
  const st = fatura ? dueStatus(fatura.vencimento) : null;
  const pendentes = fatura?.itens.filter((d) => !d.pago) ?? [];

  return (
    <>
      <Sheet
        open={!!fatura}
        onClose={onClose}
        title={fatura ? `Fatura ${fatura.cartao.nome}` : ''}
        description={fatura ? `Vence em ${formatDate(fatura.vencimento)}` : ''}
        footer={fatura && !fatura.paga && !somenteLeitura ? (
          <Button size="lg" fullWidth onClick={() => setPagando(pendentes)}>
            <CircleCheck size={18} /> Pagar fatura · {formatBRL(fatura.pendente)}
          </Button>
        ) : undefined}
      >
        {fatura && st && (
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">Total da fatura</p>
                <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums text-fg">{formatBRL(fatura.total)}</p>
              </div>
              {fatura.paga ? <Badge tone="pos"><CircleCheck size={12} /> Paga</Badge> : <Badge tone={st.tone}>{st.text}</Badge>}
            </div>
            {fatura.cartao.limite ? (
              <div>
                <div className="mb-1.5 flex justify-between text-[13px] text-muted">
                  <span>Limite usado nesta fatura</span>
                  <span className="tabular-nums">{percent(fatura.total, Number(fatura.cartao.limite))}% de {formatBRL(fatura.cartao.limite)}</span>
                </div>
                <ProgressBar value={percent(fatura.total, Number(fatura.cartao.limite))} tone={percent(fatura.total, Number(fatura.cartao.limite)) > 80 ? 'warn' : 'brand'} />
              </div>
            ) : null}
            <div className="-mx-5 divide-y divide-line border-y border-line sm:-mx-6">
              {fatura.itens.map((d) => (
                <TxRow
                  key={d.id}
                  icon={d.pago ? CircleCheck : categoryIcon(d.categoria)}
                  tone={d.pago ? 'pos' : 'neutral'}
                  title={d.descricao}
                  subtitle={<span>{d.data_compra ? `Compra em ${formatDayMonth(d.data_compra)}` : d.categoria || 'Outros'}{d.pago ? ' · paga' : ''}</span>}
                  amount={formatBRL(d.valor)}
                  onClick={onOpenDespesa ? () => onOpenDespesa(d) : undefined}
                />
              ))}
            </div>
            <p className="flex items-center gap-2 text-[13px] text-subtle">
              <CreditCard size={15} /> Fecha todo dia {fatura.cartao.dia_fechamento} e vence todo dia {fatura.cartao.dia_vencimento}.
            </p>
          </div>
        )}
      </Sheet>
      <PagamentoSheet
        despesas={pagando}
        title={fatura ? `Pagar fatura ${fatura.cartao.nome}` : undefined}
        onClose={() => setPagando(null)}
        onPaid={onClose}
      />
    </>
  );
}
