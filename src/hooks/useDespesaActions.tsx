import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiFetch } from '../services/api';
import { invalidateFinance } from './queries';
import { useConfirm } from '../components/ui/confirm';
import { formatBRL } from '../lib/format';
import type { Despesa } from '../lib/types';

export interface PagamentoInfo {
  data_pagamento?: string;
  valor_pago?: number | null;
  conta_id?: string | null;
  gerar_restante?: boolean;
}

function UndoToast({ id, text, onUndo }: { id: string; text: string; onUndo: () => void }) {
  return (
    <span className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <button
        type="button"
        onClick={() => { toast.dismiss(id); onUndo(); }}
        className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-brand/10"
      >
        Desfazer
      </button>
    </span>
  );
}

/** Pagar, desfazer, ajustar valor e excluir despesas, com atualização imediata das listas. */
export function useDespesaActions() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const setPago = useMutation({
    mutationFn: ({ id, pago }: { id: string; pago: boolean }) =>
      apiFetch(`/api/despesas/${id}/${pago ? 'pagar' : 'pendente'}`, { method: 'PATCH', body: JSON.stringify({}) }),
    onMutate: async ({ id, pago }) => {
      await qc.cancelQueries({ queryKey: ['despesas'] });
      const snapshot = qc.getQueriesData({ queryKey: ['despesas'] });
      qc.setQueriesData({ queryKey: ['despesas'] }, (old: unknown) =>
        Array.isArray(old) ? old.map((x: Despesa) => (x.id === id ? { ...x, pago } : x)) : old,
      );
      return { snapshot };
    },
    onError: (err: Error, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err.message || 'Não foi possível atualizar a conta');
    },
    onSettled: () => invalidateFinance(qc),
  });

  // O aviso sai na hora (a lista já mudou de forma otimista); se a API falhar, onError desfaz e avisa.
  // Callbacks por chamada do mutate não disparam se o painel que chamou já fechou.
  const pagar = (d: Despesa) => {
    setPago.mutate({ id: d.id, pago: true });
    toast.success((t) => <UndoToast id={t.id} text={`${d.descricao} paga`} onUndo={() => setPago.mutate({ id: d.id, pago: false })} />, { duration: 5000 });
  };

  const desfazer = (d: Despesa) => {
    setPago.mutate({ id: d.id, pago: false });
    toast.success(`${d.descricao} voltou para pendente`);
  };

  /** Pagamento com data, valor e conta reais (juros, multa ou pagamento parcial). */
  const pagamento = useMutation({
    mutationFn: ({ id, ...body }: PagamentoInfo & { id: string }) =>
      apiFetch(`/api/despesas/${id}/pagar`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (res: { restante?: Despesa | null } | null) => {
      invalidateFinance(qc);
      toast.success(res?.restante ? `Pagamento registrado. O restante de ${formatBRL(res.restante.valor)} ficou pendente.` : 'Pagamento registrado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível registrar o pagamento'),
  });

  /** Várias contas de uma vez (seleção na lista ou a fatura inteira do cartão). */
  const lote = useMutation({
    mutationFn: (body: { ids: string[]; data_pagamento?: string; conta_id?: string | null }) =>
      apiFetch('/api/despesas/pagar-lote', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (res: { pagas?: number } | null) => {
      invalidateFinance(qc);
      const n = res?.pagas ?? 0;
      toast.success(`${n} ${n === 1 ? 'conta paga' : 'contas pagas'}`);
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível pagar as contas'),
  });

  const valor = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      apiFetch(`/api/despesas/${id}/valor`, { method: 'PATCH', body: JSON.stringify({ valor }) }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Valor atualizado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível atualizar o valor'),
  });

  const del = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => apiFetch(`/api/despesas/${id}`, { method: 'DELETE' }))),
    onSuccess: (_, ids) => {
      invalidateFinance(qc);
      toast.success(ids.length > 1 ? `${ids.length} parcelas excluídas` : 'Despesa excluída');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível excluir'),
  });

  const remove = async (d: Despesa) => {
    const ok = await confirm({
      title: d.is_modelo ? 'Excluir modelo fixo?' : 'Excluir despesa?',
      description: d.is_modelo
        ? <><strong className="text-fg">{d.descricao}</strong> deixa de ser gerada nos próximos meses. As contas já geradas continuam.</>
        : <><strong className="text-fg">{d.descricao}</strong> ({formatBRL(d.valor)}) será apagada. Essa ação não pode ser desfeita.</>,
      confirmText: 'Excluir',
      danger: true,
    });
    if (ok) await del.mutateAsync([d.id]);
    return ok;
  };

  const removeGroup = async (items: Despesa[], nome: string) => {
    const ok = await confirm({
      title: 'Excluir parcelamento?',
      description: <>As {items.length} parcelas de <strong className="text-fg">{nome}</strong> serão apagadas, inclusive as já pagas.</>,
      confirmText: 'Excluir tudo',
      danger: true,
    });
    if (ok) await del.mutateAsync(items.map((x) => x.id));
    return ok;
  };

  return {
    pagar,
    pagarCom: pagamento.mutateAsync,
    pagandoCom: pagamento.isPending,
    pagarLote: lote.mutateAsync,
    pagandoLote: lote.isPending,
    desfazer,
    remove,
    removeGroup,
    updateValor: valor.mutateAsync,
    savingValor: valor.isPending,
    busyId: setPago.isPending ? setPago.variables?.id : undefined,
  };
}
