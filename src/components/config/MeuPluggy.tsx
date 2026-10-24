import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CreditCard, Landmark, Link2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { invalidateFinance, useCartoes, useContas, useMeuPluggy } from '../../hooks/queries';
import { Button } from '../ui/button';
import { Badge } from '../ui/primitives';
import { formatBRL, formatDateTime } from '../../lib/format';

export function MeuPluggy() {
  const qc = useQueryClient();
  const statusQ = useMeuPluggy();
  const { data: contas = [] } = useContas();
  const { data: cartoes = [] } = useCartoes();

  const buscar = useMutation({
    mutationFn: () => apiFetch('/api/pluggy/contas', { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pluggy'] }); toast.success('Contas do Meu Pluggy atualizadas'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const vincular = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: string }) => {
      const [tipo, alvo] = valor.split(':');
      return apiFetch(`/api/pluggy/vinculos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ conta_id: tipo === 'conta' ? alvo : null, cartao_id: tipo === 'cartao' ? alvo : null }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pluggy'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const sincronizar = useMutation({
    mutationFn: () => apiFetch('/api/pluggy/sincronizar', { method: 'POST', body: JSON.stringify({ atualizar: true }) }),
    onSuccess: (r: { inseridos: number; ignorados: number }) => {
      invalidateFinance(qc);
      qc.invalidateQueries({ queryKey: ['pluggy'] });
      toast.success(`${r.inseridos} ${r.inseridos === 1 ? 'lançamento novo' : 'lançamentos novos'} · ${r.ignorados} já existiam`, { duration: 5000 });
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ['pluggy'] });
      toast.error(err.message);
    },
  });

  const s = statusQ.data;
  if (!s?.disponivel) return null;
  const vinculos = s.vinculos ?? [];
  const algumVinculado = vinculos.some((v) => v.conta_id || v.cartao_id);

  return (
    <div className="divide-y divide-line">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            {s.estado?.ultima_sync
              ? <>Última sincronização: {formatDateTime(s.estado.ultima_sync)} · {s.estado.ultimo_resultado}</>
              : 'Ainda não sincronizado. Busque as contas, ligue cada uma a uma conta ou cartão do Lyonk e sincronize.'}
          </p>
          {s.estado?.ultimo_erro && <p className="mt-1 text-[13px] text-neg">Último erro: {s.estado.ultimo_erro}</p>}
          <p className="mt-1 text-xs text-subtle">Sincroniza sozinho todo dia às 6h30. Só entram transações confirmadas pelo banco.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => buscar.mutate()} isLoading={buscar.isPending}><Link2 size={15} /> Buscar contas</Button>
          <Button size="sm" onClick={() => sincronizar.mutate()} isLoading={sincronizar.isPending} disabled={!algumVinculado}><RefreshCw size={15} /> Sincronizar</Button>
        </div>
      </div>
      {vinculos.map((v) => {
        const credito = v.tipo === 'CREDIT';
        const valor = v.cartao_id ? `cartao:${v.cartao_id}` : v.conta_id ? `conta:${v.conta_id}` : '';
        return (
          <div key={v.pluggy_account_id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            {credito ? <CreditCard size={18} className="shrink-0 text-muted" /> : <Landmark size={18} className="shrink-0 text-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{v.nome || 'Conta'}</p>
              <p className="text-[13px] text-muted">{credito ? 'Cartão de crédito' : 'Conta'}{v.saldo !== null ? ` · ${formatBRL(v.saldo)}` : ''}</p>
            </div>
            <select
              value={valor}
              onChange={(e) => vincular.mutate({ id: v.pluggy_account_id, valor: e.target.value })}
              className="h-9 w-full rounded-lg border border-line-strong bg-bg px-2 text-[13px] text-fg outline-none focus:border-brand sm:w-48"
              aria-label={`Ligar ${v.nome} a`}
            >
              <option value="">Não sincronizar</option>
              {credito
                ? cartoes.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)
                : contas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
            </select>
            {valor && <Badge tone="pos">Ligada</Badge>}
          </div>
        );
      })}
    </div>
  );
}
