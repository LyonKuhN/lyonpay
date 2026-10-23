import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input, MoneyInput, Select } from '../ui/input';
import { CategoriaSheet } from './CategoriaSheet';
import { apiFetch } from '../../services/api';
import { invalidateFinance, useCategorias } from '../../hooks/queries';
import { dateKey, parseMoney, todayISO, toMoneyInput } from '../../lib/format';
import type { Receita } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receita a editar; vazio para criar. */
  receita?: Receita | null;
  onDelete?: () => void;
}

interface Payload { descricao: string; valor: number; data_recebimento: string; categoria: string }

export function ReceitaFormSheet({ open, onClose, receita, onDelete }: Props) {
  const qc = useQueryClient();
  const formId = useId();

  const save = useMutation({
    mutationFn: (payload: Payload) =>
      receita
        ? apiFetch(`/api/receitas/${receita.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : apiFetch('/api/receitas', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      invalidateFinance(qc);
      toast.success(receita ? 'Alterações salvas' : 'Receita adicionada');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={receita ? 'Editar receita' : 'Nova receita'}
      footer={
        <div className="flex gap-2">
          {receita && onDelete && (
            <Button variant="danger-soft" size="lg" className="w-12 px-0" onClick={onDelete} aria-label="Excluir receita">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
          <Button type="submit" form={formId} size="lg" isLoading={save.isPending} className="flex-[2] sm:flex-none sm:min-w-40 sm:ml-auto">
            {receita ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      {open && <ReceitaFormBody key={receita?.id ?? 'nova'} formId={formId} receita={receita} onSubmit={(p) => save.mutate(p)} />}
    </Sheet>
  );
}

function ReceitaFormBody({ formId, receita, onSubmit }: { formId: string; receita?: Receita | null; onSubmit: (p: Payload) => void }) {
  const { data: categorias = [] } = useCategorias('receita');
  const [descricao, setDescricao] = useState(receita?.descricao ?? '');
  const [valor, setValor] = useState(receita ? toMoneyInput(receita.valor) : '');
  const [data, setData] = useState(receita ? dateKey(receita.data_recebimento) : todayISO());
  const [categoria, setCategoria] = useState(receita?.categoria ?? '');
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState('');

  const fallback = categorias.find((c) => c.nome === 'Salário')?.nome ?? categorias[0]?.nome ?? 'Outros';
  const effective = categoria || fallback;
  const options = categorias.some((c) => c.nome === effective) ? categorias.map((c) => c.nome) : [effective, ...categorias.map((c) => c.nome)];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amount = parseMoney(valor);
    if (!descricao.trim()) return setError('Informe uma descrição.');
    if (!(amount > 0)) return setError('Informe um valor maior que zero.');
    if (!data) return setError('Informe a data do recebimento.');
    onSubmit({ descricao: descricao.trim(), valor: amount, data_recebimento: data, categoria: effective });
  };

  return (
    <>
      <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
        <MoneyInput size="lg" label="Valor recebido" value={valor} onChange={setValor} autoFocus={!receita} />
        <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Salário, venda, reembolso" required maxLength={120} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          <Select
            label="Categoria"
            value={effective}
            onChange={(e) => setCategoria(e.target.value)}
            action={
              <button type="button" onClick={() => setCatOpen(true)} className="flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                <Plus size={14} /> Nova
              </button>
            }
          >
            {options.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </Select>
        </div>
        {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
      </form>
      <CategoriaSheet open={catOpen} tipo="receita" onClose={() => setCatOpen(false)} onCreated={setCategoria} />
    </>
  );
}
