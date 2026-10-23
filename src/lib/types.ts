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
}

export interface Receita {
  id: string;
  descricao: string;
  valor: number | string;
  data_recebimento: string;
  categoria?: string | null;
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

export const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
