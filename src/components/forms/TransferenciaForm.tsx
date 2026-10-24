import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDown } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input, MoneyInput, Select } from '../ui/input';
import { apiFetch } from '../../services/api';
import { invalidateFinance, useContas } from '../../hooks/queries';
import { parseMoney, todayISO } from '../../lib/format';

/** Dinheiro que muda de conta (ex.: da corrente para a poupança). Não é receita nem despesa. */
export function TransferenciaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const formId = useId();
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/api/transferencias', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success('Transferência registrada');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível registrar'),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Transferência entre contas"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId} size="lg" className="flex-[2]" isLoading={salvar.isPending}>Transferir</Button>
        </div>
      }
    >
      {open && <Corpo formId={formId} onSubmit={(b) => salvar.mutate(b)} />}
    </Sheet>
  );
}

function Corpo({ formId, onSubmit }: { formId: string; onSubmit: (body: Record<string, unknown>) => void }) {
  const { data: contas = [], isLoading } = useContas();
  const ativas = contas.filter((c) => c.ativo);
  const [origem, setOrigem] = useState(ativas[0]?.id ?? '');
  const [destino, setDestino] = useState(ativas[1]?.id ?? '');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(todayISO());
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState('');

  if (!isLoading && ativas.length < 2) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Cadastre ao menos duas contas em Carteira para transferir entre elas.</p>;
  }

  // As contas podem chegar depois do primeiro desenho do formulário
  const de = origem || ativas[0]?.id || '';
  const para = destino || ativas[1]?.id || '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const v = parseMoney(valor);
    if (!(v > 0)) return setError('Informe um valor maior que zero.');
    if (!de || !para || de === para) return setError('Escolha contas diferentes.');
    onSubmit({ origem_id: de, destino_id: para, valor: v, data, descricao: descricao.trim() || null });
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-4 pt-1">
      <MoneyInput size="lg" label="Valor" value={valor} onChange={setValor} autoFocus />
      <Select label="Sai de" value={de} onChange={(e) => setOrigem(e.target.value)}>
        {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </Select>
      <div className="flex justify-center text-subtle"><ArrowDown size={18} /></div>
      <Select label="Entra em" value={para} onChange={(e) => setDestino(e.target.value)}>
        {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </Select>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" maxLength={120} />
      </div>
      {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
    </form>
  );
}
