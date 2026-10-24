import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Field, Input, MoneyInput, Select } from '../ui/input';
import { Segmented, Switch } from '../ui/primitives';
import { CategoriaSheet } from './CategoriaSheet';
import { apiFetch } from '../../services/api';
import { invalidateFinance, useCategorias, useContas } from '../../hooks/queries';
import { useEspaco } from '../../contexts/EspacoContext';
import { dateKey, MONTHS, parseDateOnly, parseMoney, todayISO, toMoneyInput } from '../../lib/format';
import type { Escopo, Receita, ReceitaRecorrente } from '../../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receita a editar; vazio para criar. */
  receita?: Receita | null;
  /** Receita recorrente (salário, aluguel recebido...) a editar. */
  recorrente?: ReceitaRecorrente | null;
  onDelete?: () => void;
}

type Job =
  | { kind: 'receita'; id?: string; payload: Record<string, unknown> }
  | { kind: 'recorrente'; id?: string; payload: Record<string, unknown> };

export function ReceitaFormSheet({ open, onClose, receita, recorrente, onDelete }: Props) {
  const qc = useQueryClient();
  const formId = useId();
  const editando = !!(receita || recorrente);

  const save = useMutation({
    mutationFn: (job: Job) => {
      const base = job.kind === 'receita' ? '/api/receitas' : '/api/recorrentes';
      return job.id
        ? apiFetch(`${base}/${job.id}`, { method: 'PUT', body: JSON.stringify(job.payload) })
        : apiFetch(base, { method: 'POST', body: JSON.stringify(job.payload) });
    },
    onSuccess: (_, job) => {
      invalidateFinance(qc);
      if (job.kind === 'recorrente' && !job.id) toast.success('Receita recorrente criada. Ela entra sozinha todo mês.', { duration: 5000 });
      else toast.success(job.id ? 'Alterações salvas' : 'Receita adicionada');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={recorrente ? 'Editar receita recorrente' : receita ? 'Editar receita' : 'Nova receita'}
      footer={
        <div className="flex gap-2">
          {editando && onDelete && (
            <Button variant="danger-soft" size="icon-lg" onClick={onDelete} aria-label="Excluir receita">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
          <Button type="submit" form={formId} size="lg" isLoading={save.isPending} className="flex-[2] sm:flex-none sm:min-w-40 sm:ml-auto">
            {editando ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      {open && (
        <ReceitaFormBody
          key={receita?.id ?? recorrente?.id ?? 'nova'}
          formId={formId}
          receita={receita}
          recorrente={recorrente}
          onSubmit={(job) => save.mutate(job)}
        />
      )}
    </Sheet>
  );
}

function ReceitaFormBody({ formId, receita, recorrente, onSubmit }: {
  formId: string;
  receita?: Receita | null;
  recorrente?: ReceitaRecorrente | null;
  onSubmit: (job: Job) => void;
}) {
  const { data: categorias = [] } = useCategorias('receita');
  const { data: contas = [] } = useContas();
  const { visao, modoEmpresa } = useEspaco();
  const fonte = receita ?? recorrente;
  const [descricao, setDescricao] = useState(fonte?.descricao ?? '');
  const [valor, setValor] = useState(fonte ? toMoneyInput(fonte.valor) : '');
  const [data, setData] = useState(receita ? dateKey(receita.data_recebimento) : todayISO());
  const [dia, setDia] = useState(String(recorrente?.dia ?? parseDateOnly(todayISO())!.getDate()));
  const [categoria, setCategoria] = useState(fonte?.categoria ?? '');
  const [contaId, setContaId] = useState(fonte?.conta_id ?? (contas.filter((c) => c.ativo).length === 1 ? contas.find((c) => c.ativo)!.id : ''));
  const [escopo, setEscopo] = useState<Escopo>(fonte?.escopo || (visao !== 'tudo' ? visao : 'pessoal'));
  const [repetir, setRepetir] = useState(!!recorrente);
  const [lancarMes, setLancarMes] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState('');

  const hoje = todayISO();
  const futura = !repetir && data > hoje;
  // Data no futuro = receita prevista ("a receber"); na edição respeita o que já estava
  const [pendenteManual, setPendenteManual] = useState<boolean | null>(receita ? !!receita.pendente : null);
  const pendente = pendenteManual ?? futura;

  const fallback = categorias.find((c) => c.nome === 'Salário')?.nome ?? categorias[0]?.nome ?? 'Outros';
  const effective = categoria || fallback;
  const options = categorias.some((c) => c.nome === effective) ? categorias.map((c) => c.nome) : [effective, ...categorias.map((c) => c.nome)];
  const agora = new Date();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amount = parseMoney(valor);
    if (!descricao.trim()) return setError('Informe uma descrição.');
    if (!(amount > 0)) return setError('Informe um valor maior que zero.');
    const comum = { descricao: descricao.trim(), valor: amount, categoria: effective, conta_id: contaId || null, escopo };

    if (repetir) {
      const d = parseInt(dia);
      if (!(d >= 1 && d <= 31)) return setError('O dia vai de 1 a 31.');
      onSubmit({
        kind: 'recorrente',
        id: recorrente?.id,
        payload: { ...comum, dia: d, ...(recorrente ? {} : lancarMes ? { lancar_mes: { year: agora.getFullYear(), month: agora.getMonth() + 1 } } : {}) },
      });
      return;
    }
    if (!data) return setError('Informe a data do recebimento.');
    onSubmit({ kind: 'receita', id: receita?.id, payload: { ...comum, data_recebimento: data, pendente } });
  };

  return (
    <>
      <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
        <MoneyInput size="lg" label={pendente ? 'Valor a receber' : 'Valor recebido'} value={valor} onChange={setValor} autoFocus={!fonte} />
        <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Salário, venda, reembolso" required maxLength={120} />

        {!receita && !recorrente && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Repetir todo mês</p>
              <p className="mt-0.5 text-[13px] text-subtle">Para salário, pró-labore, aluguel recebido.</p>
            </div>
            <Switch checked={repetir} onChange={setRepetir} label="Repetir todo mês" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {repetir ? (
            <Input label="Dia do recebimento" type="number" inputMode="numeric" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} required />
          ) : (
            <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          )}
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

        {contas.length > 0 && (
          <Select label="Entra na conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Não informar</option>
            {contas.filter((c) => c.ativo || c.id === contaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        )}

        {modoEmpresa && (
          <Field label="Escopo">
            <Segmented value={escopo} onChange={setEscopo} options={[{ value: 'pessoal', label: 'Pessoal' }, { value: 'empresa', label: 'Empresa' }]} />
          </Field>
        )}

        {repetir && !recorrente && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Lançar já em {MONTHS[agora.getMonth()].toLowerCase()}</p>
              <p className="mt-0.5 text-[13px] text-subtle">Entra como "a receber" até você confirmar.</p>
            </div>
            <Switch checked={lancarMes} onChange={setLancarMes} label="Lançar já neste mês" />
          </div>
        )}

        {!repetir && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Ainda vou receber</p>
              <p className="mt-0.5 text-[13px] text-subtle">Fica em "a receber" e não conta no saldo até você confirmar.</p>
            </div>
            <Switch checked={pendente} onChange={(v) => setPendenteManual(v)} label="Ainda vou receber" />
          </div>
        )}

        {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
      </form>
      <CategoriaSheet open={catOpen} tipo="receita" onClose={() => setCatOpen(false)} onCreated={setCategoria} />
    </>
  );
}
