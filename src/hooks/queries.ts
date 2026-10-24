import { useCallback } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { noEscopo, useEspaco } from '../contexts/EspacoContext';
import {
  asArray, type Cartao, type Categoria, type Conta, type Despesa, type Escopo, type Lembrete, type Meta, type Orcamento, type Receita,
  type ReceitaRecorrente, type RegraCategoria, type Transferencia,
} from '../lib/types';

// Todas as chaves começam pelo recurso, para invalidar por prefixo depois de salvar.

/** Lista da API filtrada pela visão Pessoal / Empresa / Tudo. */
function useLista<T extends { escopo?: Escopo | null }>() {
  const { visao } = useEspaco();
  return useCallback((data: unknown) => asArray<T>(data).filter((x) => noEscopo(x, visao)), [visao]);
}

export function useDespesas() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Despesa>();
  return useQuery({
    queryKey: ['despesas', 'todas'],
    queryFn: () => apiFetch('/api/despesas'),
    enabled: isAuthenticated,
    select,
  });
}

export function useDespesasMes(year: number, month: number) {
  const { isAuthenticated } = useAuth();
  const select = useLista<Despesa>();
  return useQuery({
    queryKey: ['despesas', 'mes', year, month],
    queryFn: () => apiFetch(`/api/despesas?month=${month}&year=${year}`),
    enabled: isAuthenticated,
    select,
  });
}

export function useAtrasadas() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Despesa>();
  return useQuery({
    queryKey: ['despesas', 'atrasadas'],
    queryFn: () => apiFetch('/api/despesas/atrasadas'),
    enabled: isAuthenticated,
    select,
  });
}

export function useModelos() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Despesa>();
  return useQuery({
    queryKey: ['despesas', 'modelos'],
    queryFn: () => apiFetch('/api/despesas/modelos'),
    enabled: isAuthenticated,
    select,
  });
}

export function useReceitas() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Receita>();
  return useQuery({
    queryKey: ['receitas'],
    queryFn: () => apiFetch('/api/receitas'),
    enabled: isAuthenticated,
    select,
  });
}

export function useCategorias(tipo: 'despesa' | 'receita') {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => apiFetch('/api/categorias'),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 30,
    // Categorias padrão e as da pessoa podem ter o mesmo nome: mostra cada nome uma vez
    select: (data) => {
      const vistos = new Set<string>();
      return asArray<Categoria>(data).filter((c) => {
        const chave = c.nome.trim().toLowerCase();
        if (c.tipo !== tipo || vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
    },
  });
}

export function useLembretes() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['lembretes'],
    queryFn: () => apiFetch('/api/lembretes'),
    enabled: isAuthenticated,
    select: (data) => asArray<Lembrete>(data),
  });
}

interface SaldoResposta {
  saldoGlobal?: number;
  porEscopo?: Record<Escopo, number>;
  semConta?: number;
  contas?: Conta[];
}

/** Saldo e contas com saldo calculado, já na visão escolhida. */
export function useSaldoDetalhado() {
  const { isAuthenticated } = useAuth();
  const { visao } = useEspaco();
  return useQuery({
    queryKey: ['dashboard', 'saldo'],
    queryFn: () => apiFetch('/api/dashboard/saldo'),
    enabled: isAuthenticated,
    select: useCallback((data: SaldoResposta | null) => {
      const contas = asArray<Conta>(data?.contas).filter((c) => noEscopo(c, visao));
      const total = visao === 'tudo' ? Number(data?.saldoGlobal ?? 0) : Number(data?.porEscopo?.[visao] ?? 0);
      return { total, contas, semConta: Number(data?.semConta ?? 0) };
    }, [visao]),
  });
}

export function useSaldo() {
  const q = useSaldoDetalhado();
  return { ...q, data: q.data?.total };
}

interface EvolucaoRow { mes: string | number; ano: string | number; total: string | number }

export function useEvolucao(year: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['dashboard', 'evolucao', year],
    queryFn: () => apiFetch(`/api/dashboard/evolucao?year=${year}`),
    enabled: isAuthenticated,
    select: (data: { receitas?: EvolucaoRow[]; despesas?: EvolucaoRow[] } | null) => {
      const months = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, receitas: 0, despesas: 0 }));
      for (const r of data?.receitas ?? []) months[Number(r.mes) - 1].receitas += Number(r.total) || 0;
      for (const d of data?.despesas ?? []) months[Number(d.mes) - 1].despesas += Number(d.total) || 0;
      return months;
    },
  });
}

export function useContas() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Conta>();
  return useQuery({ queryKey: ['contas'], queryFn: () => apiFetch('/api/contas'), enabled: isAuthenticated, select });
}

export function useCartoes() {
  const { isAuthenticated } = useAuth();
  const select = useLista<Cartao>();
  return useQuery({ queryKey: ['cartoes'], queryFn: () => apiFetch('/api/cartoes'), enabled: isAuthenticated, select });
}

export function useTransferencias() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['transferencias'],
    queryFn: () => apiFetch('/api/transferencias'),
    enabled: isAuthenticated,
    select: (data) => asArray<Transferencia>(data),
  });
}

export function useRecorrentes() {
  const { isAuthenticated } = useAuth();
  const select = useLista<ReceitaRecorrente>();
  return useQuery({ queryKey: ['recorrentes'], queryFn: () => apiFetch('/api/recorrentes'), enabled: isAuthenticated, select });
}

export function useOrcamentos() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => apiFetch('/api/orcamentos'),
    enabled: isAuthenticated,
    select: (data) => asArray<Orcamento>(data),
  });
}

export function useMetas() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['metas'],
    queryFn: () => apiFetch('/api/metas'),
    enabled: isAuthenticated,
    select: (data) => asArray<Meta>(data),
  });
}

export function useRegras() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['regras'],
    queryFn: () => apiFetch('/api/regras'),
    enabled: isAuthenticated,
    select: (data) => asArray<RegraCategoria>(data),
  });
}

export interface PluggyStatus {
  disponivel: boolean;
  vinculos?: Array<{ pluggy_account_id: string; nome: string | null; tipo: string; saldo: number | string | null; conta_id: string | null; cartao_id: string | null }>;
  estado?: { ultima_sync: string | null; ultimo_resultado: string | null; ultimo_erro: string | null } | null;
}

/**
 * Integração bancária pelo Meu Pluggy (plano gratuito, uso pessoal).
 * Só aparece para o e-mail configurado no servidor; para os demais a API responde "indisponível".
 */
export function useMeuPluggy() {
  const { isAuthenticated } = useAuth();
  return useQuery<PluggyStatus>({ queryKey: ['pluggy'], queryFn: () => apiFetch('/api/pluggy/status'), enabled: isAuthenticated, staleTime: 60_000 });
}

/** Depois de qualquer gravação: recarrega tudo que depende de lançamentos. */
export function invalidateFinance(qc: QueryClient) {
  for (const key of ['despesas', 'receitas', 'dashboard', 'search', 'contas', 'cartoes', 'transferencias', 'recorrentes']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
