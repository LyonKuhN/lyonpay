import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { asArray, type Categoria, type Despesa, type Lembrete, type Receita } from '../lib/types';

// Todas as chaves começam pelo recurso, para invalidar por prefixo depois de salvar.

export function useDespesas() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['despesas', 'todas'],
    queryFn: () => apiFetch('/api/despesas'),
    enabled: !!token,
    select: (data) => asArray<Despesa>(data),
  });
}

export function useDespesasMes(year: number, month: number) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['despesas', 'mes', year, month],
    queryFn: () => apiFetch(`/api/despesas?month=${month}&year=${year}`),
    enabled: !!token,
    select: (data) => asArray<Despesa>(data),
  });
}

export function useAtrasadas() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['despesas', 'atrasadas'],
    queryFn: () => apiFetch('/api/despesas/atrasadas'),
    enabled: !!token,
    select: (data) => asArray<Despesa>(data),
  });
}

export function useModelos() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['despesas', 'modelos'],
    queryFn: () => apiFetch('/api/despesas/modelos'),
    enabled: !!token,
    select: (data) => asArray<Despesa>(data),
  });
}

export function useReceitas() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['receitas'],
    queryFn: () => apiFetch('/api/receitas'),
    enabled: !!token,
    select: (data) => asArray<Receita>(data),
  });
}

export function useCategorias(tipo: 'despesa' | 'receita') {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => apiFetch('/api/categorias'),
    enabled: !!token,
    staleTime: 1000 * 60 * 30,
    select: (data) => asArray<Categoria>(data).filter((c) => c.tipo === tipo),
  });
}

export function useLembretes() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['lembretes'],
    queryFn: () => apiFetch('/api/lembretes'),
    enabled: !!token,
    select: (data) => asArray<Lembrete>(data),
  });
}

export function useSaldo() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['dashboard', 'saldo'],
    queryFn: () => apiFetch('/api/dashboard/saldo'),
    enabled: !!token,
    select: (data: { saldoGlobal?: number } | null) => Number(data?.saldoGlobal ?? 0),
  });
}

interface EvolucaoRow { mes: string | number; ano: string | number; total: string | number }

export function useEvolucao(year: number) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['dashboard', 'evolucao', year],
    queryFn: () => apiFetch(`/api/dashboard/evolucao?year=${year}`),
    enabled: !!token,
    select: (data: { receitas?: EvolucaoRow[]; despesas?: EvolucaoRow[] } | null) => {
      const months = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, receitas: 0, despesas: 0 }));
      for (const r of data?.receitas ?? []) months[Number(r.mes) - 1].receitas += Number(r.total) || 0;
      for (const d of data?.despesas ?? []) months[Number(d.mes) - 1].despesas += Number(d.total) || 0;
      return months;
    },
  });
}

/** Depois de qualquer gravação: recarrega tudo que depende de lançamentos. */
export function invalidateFinance(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['despesas'] });
  qc.invalidateQueries({ queryKey: ['receitas'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['search'] });
}
