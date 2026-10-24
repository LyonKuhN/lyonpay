export type Escopo = 'pessoal' | 'empresa';

export interface Despesa {
  id: string;
  descricao: string;
  valor: number | string;
  data_vencimento: string;
  tipo: string;
  pago: boolean;
  categoria?: string | null;
  observacoes?: string | null;
  numero_parcelas?: number | null;
  parcela_atual?: number | null;
  valor_total?: number | string | null;
  group_id?: string | null;
  is_modelo?: boolean;
  usa_media?: boolean;
  data_pagamento?: string | null;
  /** Valor efetivamente pago, quando diferente do valor (juros, multa, pagamento parcial). */
  valor_pago?: number | string | null;
  conta_id?: string | null;
  cartao_id?: string | null;
  data_compra?: string | null;
  import_id?: string | null;
  escopo?: Escopo | null;
}

export interface Receita {
  id: string;
  descricao: string;
  valor: number | string;
  data_recebimento: string;
  categoria?: string | null;
  conta_id?: string | null;
  /** Prevista, ainda não entrou na conta. */
  pendente?: boolean;
  recorrente_id?: string | null;
  import_id?: string | null;
  escopo?: Escopo | null;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  cor?: string | null;
  icone?: string | null;
}

export interface Lembrete {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_lembrete: string;
  concluido: boolean;
}

export type TipoConta = 'corrente' | 'poupanca' | 'carteira' | 'investimento';

export interface Conta {
  id: string;
  nome: string;
  tipo: TipoConta;
  escopo: Escopo;
  saldo_inicial: number | string;
  cor?: string | null;
  ativo: boolean;
  /** Vem calculado em /api/dashboard/saldo. */
  saldo?: number;
}

export interface Cartao {
  id: string;
  nome: string;
  bandeira?: string | null;
  limite?: number | string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  conta_pagamento_id?: string | null;
  escopo: Escopo;
  cor?: string | null;
  ativo: boolean;
}

export interface Transferencia {
  id: string;
  origem_id: string;
  destino_id: string;
  valor: number | string;
  data: string;
  descricao?: string | null;
}

export interface ReceitaRecorrente {
  id: string;
  descricao: string;
  valor: number | string;
  dia: number;
  categoria?: string | null;
  conta_id?: string | null;
  escopo: Escopo;
  ativo: boolean;
}

export interface Orcamento {
  id: string;
  categoria: string;
  valor: number | string;
}

export interface Meta {
  id: string;
  nome: string;
  valor_alvo: number | string;
  prazo?: string | null;
  cor?: string | null;
  concluida: boolean;
  guardado: number | string;
  aportes: number;
}

export interface MetaAporte {
  id: string;
  valor: number | string;
  data: string;
}

export interface RegraCategoria {
  id: string;
  termo: string;
  categoria: string;
  tipo?: 'despesa' | 'receita' | null;
}

export interface Anexo {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
  created_at: string;
}

export interface Espaco {
  dono_id: string;
  nome: string;
  permissao: 'editar' | 'ver';
  proprio: boolean;
  plano_ativo?: boolean;
}

export interface Compartilhamento {
  id: string;
  email: string;
  nome?: string | null;
  permissao: 'editar' | 'ver';
  status: 'pendente' | 'aceito';
}

export type TipoDespesa = 'variavel' | 'fixa' | 'parcelada';

/** O banco tem registros antigos com "fixo", "parcelado" e "variável". */
export function normalizeTipo(tipo?: string | null): TipoDespesa {
  const t = (tipo || '').toLowerCase();
  if (t === 'fixa' || t === 'fixo') return 'fixa';
  if (t === 'parcelada' || t === 'parcelado') return 'parcelada';
  return 'variavel';
}

export const TIPO_LABEL: Record<TipoDespesa, string> = {
  variavel: 'Variável',
  fixa: 'Fixa',
  parcelada: 'Parcelada',
};

export const TIPO_CONTA_LABEL: Record<TipoConta, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Dinheiro',
  investimento: 'Investimento',
};

/** Quanto a despesa pesa no caixa: o valor pago (com juros ou parcial) quando já foi paga. */
export function valorEfetivo(d: Pick<Despesa, 'valor' | 'valor_pago' | 'pago'>): number {
  if (d.pago && d.valor_pago !== null && d.valor_pago !== undefined && d.valor_pago !== '') return Number(d.valor_pago) || 0;
  return Number(d.valor) || 0;
}

export const somaEfetiva = (lista: Despesa[]) => lista.reduce((acc, d) => acc + valorEfetivo(d), 0);

export const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
