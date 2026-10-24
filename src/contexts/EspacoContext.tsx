import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, definirEspacoAtivo } from '../services/api';
import { useAuth } from './AuthContext';
import { asArray, type Escopo, type Espaco } from '../lib/types';

export type Visao = 'tudo' | Escopo;

interface EspacoContextType {
  espacos: Espaco[];
  /** Espaço aberto agora: o próprio ou um compartilhado com a pessoa. */
  ativo: Espaco | null;
  trocar: (donoId: string) => void;
  compartilhado: boolean;
  somenteLeitura: boolean;
  /** Filtro Pessoal / Empresa / Tudo (só com o modo PJ ligado). */
  visao: Visao;
  setVisao: (v: Visao) => void;
  modoEmpresa: boolean;
}

const EspacoContext = createContext<EspacoContextType>({
  espacos: [],
  ativo: null,
  trocar: () => {},
  compartilhado: false,
  somenteLeitura: false,
  visao: 'tudo',
  setVisao: () => {},
  modoEmpresa: false,
});

const CHAVE_ESPACO = 'lyonk_espaco';
const CHAVE_VISAO = 'lyonk_visao';

const ler = (chave: string) => {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
};
const gravar = (chave: string, valor: string | null) => {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
  } catch {
    // sem armazenamento: vale só nesta aba
  }
};

export function EspacoProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // O cabeçalho do espaço precisa estar definido antes da primeira consulta
  const [donoAtivo, setDonoAtivo] = useState<string | null>(() => {
    const salvo = ler(CHAVE_ESPACO);
    definirEspacoAtivo(salvo && salvo !== user?.id ? salvo : null);
    return salvo;
  });
  const [visaoSalva, setVisaoSalva] = useState<Visao>(() => (ler(CHAVE_VISAO) as Visao) || 'tudo');

  const trocar = useCallback((donoId: string) => {
    const proprio = !user || donoId === user.id;
    definirEspacoAtivo(proprio ? null : donoId);
    gravar(CHAVE_ESPACO, proprio ? null : donoId);
    setDonoAtivo(proprio ? null : donoId);
    // Tudo que está em cache é do espaço anterior: as telas abertas recarregam, o resto é descartado
    const doEspaco = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== 'espacos';
    qc.removeQueries({ type: 'inactive', predicate: doEspaco });
    qc.resetQueries({ predicate: doEspaco });
  }, [qc, user]);

  const { data: espacos = [] } = useQuery({
    queryKey: ['espacos'],
    queryFn: async () => {
      const lista = asArray<Espaco>(await apiFetch('/api/espacos'));
      // Acesso removido pelo dono: volta para as próprias finanças
      const salvo = ler(CHAVE_ESPACO);
      if (salvo && user && !lista.some((e) => e.dono_id === salvo)) trocar(user.id);
      return lista;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Ao sair da conta, o próximo login começa nas próprias finanças
  useEffect(() => () => definirEspacoAtivo(null), []);

  const ativo = useMemo(() => {
    if (!user) return null;
    const alvo = donoAtivo || user.id;
    return espacos.find((e) => e.dono_id === alvo) ?? { dono_id: user.id, nome: 'Minhas finanças', permissao: 'editar' as const, proprio: true };
  }, [espacos, donoAtivo, user]);

  const modoEmpresa = !!user?.modo_empresa;
  const visao: Visao = modoEmpresa ? visaoSalva : 'tudo';
  const setVisao = useCallback((v: Visao) => {
    gravar(CHAVE_VISAO, v);
    setVisaoSalva(v);
  }, []);

  const value = useMemo<EspacoContextType>(() => ({
    espacos,
    ativo,
    trocar,
    compartilhado: !!ativo && !ativo.proprio,
    somenteLeitura: ativo?.permissao === 'ver',
    visao,
    setVisao,
    modoEmpresa,
  }), [espacos, ativo, trocar, visao, setVisao, modoEmpresa]);

  return <EspacoContext.Provider value={value}>{children}</EspacoContext.Provider>;
}

export const useEspaco = () => useContext(EspacoContext);

/** Itens antigos não têm escopo: contam como pessoais. */
export function noEscopo(item: { escopo?: Escopo | null }, visao: Visao) {
  return visao === 'tudo' || (item.escopo || 'pessoal') === visao;
}
