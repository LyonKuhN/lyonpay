import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarRange, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Field, Input, MoneyInput, Select, Textarea, fieldClass } from '../ui/input';
import { Badge, Segmented, Switch } from '../ui/primitives';
import { CategoriaSheet } from './CategoriaSheet';
import { apiFetch } from '../../services/api';
import { invalidateFinance, useCartoes, useCategorias, useContas } from '../../hooks/queries';
import { useEspaco } from '../../contexts/EspacoContext';
import { somarMeses, vencimentoFatura } from '../../lib/fatura';
import { cn } from '../../lib/cn';
import {
  dateKey, daysInMonth, formatBRL, formatDate, MONTHS, parseDateOnly, parseMoney, todayISO, toMoneyInput,
} from '../../lib/format';
import { normalizeTipo, TIPO_LABEL, type Despesa, type Escopo, type TipoDespesa } from '../../lib/types';

export interface DespesaFormTarget {
  /** Lançamento, parcela avulsa ou modelo fixo a editar. */
  despesa?: Despesa;
  /** Todas as parcelas de um parcelamento a editar de uma vez. */
  group?: Despesa[];
  /** Tipo inicial ao criar. */
  tipo?: TipoDespesa;
  /** Já abre como compra no cartão (primeiro cartão ativo). */
  cartao?: boolean;
}

type Payload = Record<string, unknown>;
type SaveJob =
  | { kind: 'create'; payload: Payload; tipo: TipoDespesa; lancarMes?: { year: number; month: number } }
  | { kind: 'update'; id: string; payload: Payload; tipo: TipoDespesa }
  | { kind: 'group'; items: Array<{ id: string; payload: Payload }>; tipo: TipoDespesa };

const stripParcela = (d: string) => d.replace(/\s*\(\d+\/\d+\)$/, '');
const round2 = (n: number) => Math.round(n * 100) / 100;
const byParcela = (a: Despesa, b: Despesa) => (a.parcela_atual ?? 0) - (b.parcela_atual ?? 0);

const addMonths = somarMeses;

/** O modelo fixo só guarda o dia; escolhe um mês em que esse dia exista (31 não vira dia 1º). */
function modelDateForDay(day: number): string {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  for (let i = 0; i < 12 && daysInMonth(y, m) < day; i++) {
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const TIPO_HINT: Record<TipoDespesa, string> = {
  variavel: 'Gasto pontual, com data definida.',
  fixa: 'Modelo que se repete todo mês. As contas de cada mês saem dele.',
  parcelada: 'Compra dividida em parcelas mensais.',
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  target: DespesaFormTarget | null;
  onSaved?: (info: { tipo: TipoDespesa; created: boolean }) => void;
  /** Mostra o botão de excluir no rodapé (só na edição). */
  onDelete?: () => void;
}

export function DespesaFormSheet({ open, onClose, target, onSaved, onDelete }: SheetProps) {
  const qc = useQueryClient();
  const formId = useId();
  const editing = !!(target?.despesa || target?.group);
  const isModel = !!target?.despesa?.is_modelo;

  const save = useMutation({
    mutationFn: async (job: SaveJob) => {
      if (job.kind === 'create') {
        const criada = await apiFetch('/api/despesas', { method: 'POST', body: JSON.stringify(job.payload) });
        if (job.lancarMes && criada?.id) await apiFetch(`/api/despesas/${criada.id}/lancar-mes`, { method: 'POST', body: JSON.stringify(job.lancarMes) });
        return criada;
      }
      if (job.kind === 'update') return apiFetch(`/api/despesas/${job.id}`, { method: 'PUT', body: JSON.stringify(job.payload) });
      return Promise.all(job.items.map((it) => apiFetch(`/api/despesas/${it.id}`, { method: 'PUT', body: JSON.stringify(it.payload) })));
    },
    onSuccess: (_, job) => {
      invalidateFinance(qc);
      const created = job.kind === 'create';
      if (created && job.tipo === 'fixa') {
        toast.success(
          job.kind === 'create' && job.lancarMes
            ? `Modelo fixo salvo e lançado em ${MONTHS[job.lancarMes.month - 1].toLowerCase()}`
            : 'Modelo fixo salvo. Ele entra nas contas quando o mês for gerado.',
          { duration: 5000 },
        );
      } else {
        toast.success(created ? 'Despesa adicionada' : 'Alterações salvas');
      }
      onSaved?.({ tipo: job.tipo, created });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  const title = target?.group
    ? 'Editar parcelamento'
    : isModel
      ? 'Editar modelo fixo'
      : editing
        ? 'Editar despesa'
        : target?.tipo === 'fixa'
          ? 'Novo modelo fixo'
          : 'Nova despesa';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          {editing && onDelete && (
            <Button variant="danger-soft" size="icon-lg" onClick={onDelete} aria-label="Excluir">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
          <Button type="submit" form={formId} size="lg" isLoading={save.isPending} className="flex-[2] sm:flex-none sm:min-w-40 sm:ml-auto">
            {editing ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      {open && target && <DespesaFormBody formId={formId} target={target} onSubmit={(job) => save.mutate(job)} />}
    </Sheet>
  );
}

function DespesaFormBody({ formId, target, onSubmit }: { formId: string; target: DespesaFormTarget; onSubmit: (job: SaveJob) => void }) {
  const { data: categorias = [] } = useCategorias('despesa');
  const { data: contas = [] } = useContas();
  const { data: cartoes = [] } = useCartoes();
  const { visao, modoEmpresa } = useEspaco();
  const d = target.despesa;
  const group = target.group ? [...target.group].sort(byParcela) : undefined;
  const editing = !!(d || group);
  const first = group?.[0] ?? d;
  const isModelEdit = !!d?.is_modelo;
  const totalParcelas = Number(first?.numero_parcelas) || group?.length || 2;

  const [tipo, setTipo] = useState<TipoDespesa>(group ? 'parcelada' : d ? normalizeTipo(d.tipo) : target.tipo ?? 'variavel');
  const [descricao, setDescricao] = useState(first ? (group ? stripParcela(first.descricao) : first.descricao) : '');
  const [categoria, setCategoria] = useState(first?.categoria || '');
  // Compra no cartão: a data do formulário é a da compra; o vencimento sai da fatura
  const [data, setData] = useState(first ? dateKey(first.cartao_id && first.data_compra ? first.data_compra : first.data_vencimento) : todayISO());
  const [origem, setOrigem] = useState(() => {
    if (first?.cartao_id) return `cartao:${first.cartao_id}`;
    if (first?.conta_id) return `conta:${first.conta_id}`;
    const primeiro = target.cartao ? cartoes.find((c) => c.ativo) : undefined;
    return primeiro ? `cartao:${primeiro.id}` : '';
  });
  const [escopo, setEscopo] = useState<Escopo>(first?.escopo || (visao !== 'tudo' ? visao : 'pessoal'));
  const [lancarMes, setLancarMes] = useState(true);
  const [dia, setDia] = useState(String(parseDateOnly(first?.data_vencimento)?.getDate() ?? new Date().getDate()));
  const [parcelas, setParcelas] = useState(group ? String(totalParcelas) : '2');
  const [valorMode, setValorMode] = useState<'parcela' | 'total'>('parcela');
  const [valor, setValor] = useState(first ? toMoneyInput(first.valor) : '');
  const [obs, setObs] = useState(first?.observacoes || '');
  const [usaMedia, setUsaMedia] = useState(!!d?.usa_media);
  const [useCustom, setUseCustom] = useState(!!group);
  const [customDates, setCustomDates] = useState<string[]>(group ? group.map((p) => dateKey(p.data_vencimento)) : []);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState('');

  const fallbackCat = categorias.find((c) => c.nome === 'Outros')?.nome ?? categorias[0]?.nome ?? 'Outros';
  const effectiveCategoria = categoria || fallbackCat;
  const catOptions = categorias.some((c) => c.nome === effectiveCategoria)
    ? categorias.map((c) => c.nome)
    : [effectiveCategoria, ...categorias.map((c) => c.nome)];

  const showDia = tipo === 'fixa' && (isModelEdit || !editing);
  const isNewParcelada = tipo === 'parcelada' && !editing;
  const count = group ? group.length : Math.max(2, Math.min(120, parseInt(parcelas) || 2));
  const amount = parseMoney(valor);
  const perParcela = valorMode === 'total' ? round2(amount / count) : amount;
  const total = valorMode === 'total' ? amount : round2(amount * count);
  const cartao = origem.startsWith('cartao:') ? cartoes.find((c) => c.id === origem.slice(7)) : undefined;
  const contaId = origem.startsWith('conta:') ? origem.slice(6) : null;
  const vencCartao = cartao && data ? vencimentoFatura(data, cartao.dia_fechamento, cartao.dia_vencimento) : null;
  const autoDates = Array.from({ length: count }, (_, i) => addMonths(vencCartao || data || todayISO(), i));
  const dates = useCustom && !cartao ? customDates : autoDates;
  const contasAtivas = contas.filter((c) => c.ativo || c.id === contaId);
  const cartoesAtivos = cartoes.filter((c) => c.ativo || c.id === cartao?.id);
  const agora = new Date();

  const resizeDates = (n: number, base: string) => {
    setCustomDates((prev) => Array.from({ length: n }, (_, i) => prev[i] || addMonths(base || todayISO(), i)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!descricao.trim()) return setError('Informe uma descrição.');
    if (!(amount > 0)) return setError('Informe um valor maior que zero.');

    const base = {
      descricao: descricao.trim(),
      observacoes: obs.trim(),
      categoria: effectiveCategoria,
      conta_id: contaId,
      cartao_id: cartao?.id ?? null,
      escopo,
    };

    if (group) {
      if (customDates.some((x) => !x)) return setError('Preencha a data de todas as parcelas.');
      onSubmit({
        kind: 'group',
        tipo: 'parcelada',
        items: group.map((p, i) => ({
          id: p.id,
          payload: {
            ...base,
            descricao: `${base.descricao} (${p.parcela_atual ?? i + 1}/${totalParcelas})`,
            valor: perParcela.toFixed(2),
            valor_total: total.toFixed(2),
            numero_parcelas: totalParcelas,
            data_vencimento: customDates[i],
            data_compra: cartao ? dateKey(p.data_compra) || null : null,
            tipo: 'parcelada',
            usa_media: false,
          },
        })),
      });
      return;
    }

    if (showDia) {
      const day = parseInt(dia);
      if (!(day >= 1 && day <= 31)) return setError('O dia de vencimento vai de 1 a 31.');
      const sameDay = isModelEdit && parseDateOnly(d?.data_vencimento)?.getDate() === day;
      const payload = {
        ...base,
        valor: amount.toFixed(2),
        data_vencimento: sameDay ? dateKey(d!.data_vencimento) : modelDateForDay(day),
        tipo: 'fixa',
        numero_parcelas: '',
        valor_total: '',
        usa_media: usaMedia,
      };
      onSubmit(editing
        ? { kind: 'update', id: d!.id, payload, tipo: 'fixa' }
        : { kind: 'create', payload, tipo: 'fixa', lancarMes: lancarMes ? { year: agora.getFullYear(), month: agora.getMonth() + 1 } : undefined });
      return;
    }

    if (isNewParcelada) {
      if (dates.some((x) => !x)) return setError('Preencha a data de todas as parcelas.');
      // As datas vão sempre calculadas daqui: o servidor antigo pulava de 31/01 para 03/03.
      onSubmit({
        kind: 'create',
        tipo: 'parcelada',
        payload: {
          ...base,
          valor: perParcela.toFixed(2),
          valor_total: total.toFixed(2),
          numero_parcelas: count,
          data_vencimento: dates[0],
          data_compra: cartao ? data : null,
          datas_personalizadas: cartao ? undefined : dates,
          tipo: 'parcelada',
          usa_media: false,
        },
      });
      return;
    }

    if (!data) return setError(cartao ? 'Informe a data da compra.' : 'Informe a data de vencimento.');
    const mudouCompra = !!cartao && (dateKey(d?.data_compra) !== data || d?.cartao_id !== cartao.id);
    const payload = {
      ...base,
      valor: amount.toFixed(2),
      data_vencimento: cartao ? (d && !mudouCompra ? dateKey(d.data_vencimento) : vencCartao) : data,
      data_compra: cartao ? data : null,
      recalcular_fatura: mudouCompra,
      tipo: d?.tipo || 'variavel',
      numero_parcelas: d?.numero_parcelas ?? '',
      valor_total: d?.valor_total ?? '',
      usa_media: d?.usa_media ?? false,
    };
    onSubmit(d ? { kind: 'update', id: d.id, payload, tipo } : { kind: 'create', payload, tipo: 'variavel' });
  };

  return (
    <>
    <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
      {!editing && target.tipo !== 'fixa' ? (
        <div>
          <Segmented
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'variavel', label: 'Variável' },
              { value: 'fixa', label: 'Fixa' },
              { value: 'parcelada', label: 'Parcelada' },
            ]}
          />
          <p className="mt-2 text-[13px] text-subtle">{TIPO_HINT[tipo]}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge tone="brand">{TIPO_LABEL[tipo]}</Badge>
          {(isModelEdit || target.tipo === 'fixa') && <span className="text-[13px] text-subtle">Modelo que se repete todo mês</span>}
          {group && <span className="text-[13px] text-subtle">{group.length} parcelas</span>}
        </div>
      )}

      <MoneyInput
        size="lg"
        label={tipo === 'parcelada' ? (valorMode === 'parcela' ? 'Valor de cada parcela' : 'Valor total da compra') : showDia && usaMedia ? 'Valor inicial' : 'Valor'}
        value={valor}
        onChange={setValor}
        autoFocus={!editing}
        action={tipo === 'parcelada' ? (
          <Segmented
            size="sm"
            className="w-44"
            value={valorMode}
            onChange={setValorMode}
            options={[{ value: 'parcela', label: 'Parcela' }, { value: 'total', label: 'Total' }]}
          />
        ) : undefined}
      />

      <Input
        label="Descrição"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Ex.: Aluguel, mercado, Netflix"
        required
        maxLength={120}
      />

      <Select
        label="Categoria"
        value={effectiveCategoria}
        onChange={(e) => setCategoria(e.target.value)}
        action={
          <button type="button" onClick={() => setCatOpen(true)} className="flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
            <Plus size={14} /> Nova
          </button>
        }
      >
        {catOptions.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
      </Select>

      {(contasAtivas.length > 0 || cartoesAtivos.length > 0) && (
        <Select label="Pagar com" value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Não informar</option>
          {contasAtivas.length > 0 && (
            <optgroup label="Contas">
              {contasAtivas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
            </optgroup>
          )}
          {cartoesAtivos.length > 0 && (
            <optgroup label="Cartões de crédito">
              {cartoesAtivos.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
            </optgroup>
          )}
        </Select>
      )}

      {modoEmpresa && (
        <Field label="Escopo">
          <Segmented value={escopo} onChange={setEscopo} options={[{ value: 'pessoal', label: 'Pessoal' }, { value: 'empresa', label: 'Empresa' }]} />
        </Field>
      )}

      {showDia && (
        <Input
          label={cartao ? 'Dia da cobrança no cartão' : 'Dia do vencimento'}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          hint="Nos meses mais curtos, a conta vence no último dia."
          required
        />
      )}

      {!showDia && !group && !isNewParcelada && (
        <Input
          label={cartao ? 'Data da compra' : 'Vencimento'}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          hint={cartao && vencCartao ? `Entra na fatura que vence em ${formatDate(vencCartao)}.` : undefined}
          required
        />
      )}

      {isNewParcelada && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Parcelas"
            type="number"
            inputMode="numeric"
            min={2}
            max={120}
            value={parcelas}
            onChange={(e) => {
              setParcelas(e.target.value);
              if (useCustom) resizeDates(Math.max(2, Math.min(120, parseInt(e.target.value) || 2)), data);
            }}
            required
          />
          <Input
            label={cartao ? 'Data da compra' : '1ª parcela'}
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              if (useCustom) setCustomDates(Array.from({ length: count }, (_, i) => addMonths(e.target.value || todayISO(), i)));
            }}
            required
          />
        </div>
      )}

      {tipo === 'parcelada' && amount > 0 && (
        <div className="rounded-xl border border-brand/25 bg-brand/8 px-4 py-3 text-sm">
          <p className="font-semibold text-fg tabular-nums">{count}× de {formatBRL(perParcela)}</p>
          <p className="mt-0.5 text-[13px] text-muted tabular-nums">
            Total {formatBRL(total)}
            {cartao && dates[0] && <> · 1ª na fatura de {formatDate(dates[0])}</>}
            {dates[count - 1] && <> · última em {formatDate(dates[count - 1])}</>}
          </p>
        </div>
      )}

      {tipo === 'parcelada' && (
        <div className="space-y-3">
          {isNewParcelada && !cartao && (
            <button
              type="button"
              onClick={() => {
                const next = !useCustom;
                setUseCustom(next);
                if (next) setCustomDates(autoDates);
              }}
              className={cn(
                'flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                useCustom ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-muted hover:text-fg',
              )}
            >
              <CalendarRange size={16} />
              {useCustom ? 'Usando datas escolhidas' : 'Escolher a data de cada parcela'}
            </button>
          )}
          {useCustom && !(isNewParcelada && cartao) && (
            <Field label={group ? 'Datas das parcelas' : undefined}>
              <div className="space-y-2 rounded-xl border border-line bg-bg/60 p-3">
                {customDates.map((date, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[13px] font-medium text-muted tabular-nums">
                      Parcela {group?.[i]?.parcela_atual ?? i + 1}
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setCustomDates((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      className={cn(fieldClass, 'h-11 flex-1')}
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}
        </div>
      )}

      {showDia && !editing && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fg">Lançar já em {MONTHS[agora.getMonth()].toLowerCase()}</p>
            <p className="mt-0.5 text-[13px] text-subtle">Cria a conta deste mês agora. Os próximos meses saem do modelo.</p>
          </div>
          <Switch checked={lancarMes} onChange={setLancarMes} label="Lançar já neste mês" />
        </div>
      )}

      {showDia && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fg">Valor pela média</p>
            <p className="mt-0.5 text-[13px] text-subtle">Usa a média dos últimos 6 meses ao gerar as contas. Bom para luz e água.</p>
          </div>
          <Switch checked={usaMedia} onChange={setUsaMedia} label="Valor pela média" />
        </div>
      )}

      <Textarea label="Observações" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" maxLength={500} />

      {error && <p className="rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
    </form>
    <CategoriaSheet open={catOpen} tipo="despesa" onClose={() => setCatOpen(false)} onCreated={setCategoria} />
    </>
  );
}
