import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LogOut, Mail, Send, Trash2, Users } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useEspaco } from '../../contexts/EspacoContext';
import { useConfirm } from '../ui/confirm';
import { Button } from '../ui/button';
import { Input, Select } from '../ui/input';
import { Badge, IconTile } from '../ui/primitives';
import { asArray, type Compartilhamento as Item } from '../../lib/types';

/** Pessoas com acesso às minhas finanças e espaços que compartilharam comigo. */
export function Compartilhamento() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { espacos, trocar, ativo } = useEspaco();
  const [email, setEmail] = useState('');
  const [permissao, setPermissao] = useState<'editar' | 'ver'>('editar');

  const listaQ = useQuery({
    queryKey: ['compartilhamentos'],
    queryFn: () => apiFetch('/api/compartilhamentos'),
    select: (d) => asArray<Item>(d),
  });

  const convidar = useMutation({
    mutationFn: () => apiFetch('/api/compartilhamentos', { method: 'POST', body: JSON.stringify({ email: email.trim(), permissao }) }),
    onSuccess: (c: Item) => {
      qc.invalidateQueries({ queryKey: ['compartilhamentos'] });
      toast.success(c.status === 'aceito' ? 'Permissão atualizada' : `Convite enviado para ${c.email}`);
      setEmail('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mudar = useMutation({
    mutationFn: ({ id, p }: { id: string; p: 'editar' | 'ver' }) => apiFetch(`/api/compartilhamentos/${id}`, { method: 'PATCH', body: JSON.stringify({ permissao: p }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compartilhamentos'] }),
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/compartilhamentos/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compartilhamentos'] }); toast.success('Acesso removido'); },
  });

  const sair = useMutation({
    mutationFn: (donoId: string) => apiFetch(`/api/espacos/${donoId}`, { method: 'DELETE' }),
    onSuccess: (_, donoId) => {
      if (ativo?.dono_id === donoId && espacos[0]) trocar(espacos[0].dono_id);
      qc.invalidateQueries({ queryKey: ['espacos'] });
      toast.success('Você saiu das finanças compartilhadas');
    },
  });

  const comigo = espacos.filter((e) => !e.proprio);
  const pessoas = listaQ.data ?? [];

  return (
    <div className="divide-y divide-line">
      <form
        className="space-y-3 p-4 sm:p-5"
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) convidar.mutate(); }}
      >
        <p className="text-[13px] text-muted">Convide quem divide as contas com você. A pessoa entra com o próprio login e vê as suas finanças; as dela continuam separadas.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
          <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" leftIcon={<Mail size={17} />} aria-label="E-mail da pessoa" />
          <Select value={permissao} onChange={(e) => setPermissao(e.target.value as 'editar' | 'ver')} aria-label="Permissão">
            <option value="editar">Pode editar</option>
            <option value="ver">Só ver</option>
          </Select>
          <Button type="submit" size="lg" isLoading={convidar.isPending} disabled={!email.trim()}><Send size={16} /> Convidar</Button>
        </div>
      </form>

      {pessoas.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <IconTile icon={Users} tone={p.status === 'aceito' ? 'brand' : 'neutral'} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{p.nome || p.email}</p>
            <p className="truncate text-[13px] text-muted">{p.nome ? p.email : ''}{p.status === 'pendente' ? <Badge tone="warn" className="ml-0">Convite pendente</Badge> : null}</p>
          </div>
          <select
            value={p.permissao}
            onChange={(e) => mudar.mutate({ id: p.id, p: e.target.value as 'editar' | 'ver' })}
            className="h-9 rounded-lg border border-line-strong bg-bg px-2 text-[13px] text-fg outline-none focus:border-brand"
            aria-label={`Permissão de ${p.email}`}
          >
            <option value="editar">Pode editar</option>
            <option value="ver">Só ver</option>
          </select>
          <button
            type="button"
            aria-label={`Remover ${p.email}`}
            onClick={async () => {
              if (await confirm({ title: 'Remover acesso?', description: `${p.email} deixa de ver as suas finanças.`, confirmText: 'Remover', danger: true })) remover.mutate(p.id);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-neg/10 hover:text-neg"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {comigo.length > 0 && (
        <div className="px-4 py-3 sm:px-5">
          <p className="mb-2 text-[13px] font-medium text-muted">Compartilhadas com você</p>
          <ul className="space-y-2">
            {comigo.map((e) => (
              <li key={e.dono_id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{e.nome} <span className="text-muted">· {e.permissao === 'ver' ? 'só leitura' : 'pode editar'}</span></span>
                <Button variant="ghost" size="sm" onClick={() => trocar(e.dono_id)}>Abrir</Button>
                <button
                  type="button"
                  aria-label={`Sair das finanças de ${e.nome}`}
                  onClick={async () => {
                    if (await confirm({ title: `Sair das finanças de ${e.nome}?`, description: 'Para voltar, a pessoa precisa convidar você de novo.', confirmText: 'Sair', danger: true })) sair.mutate(e.dono_id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-neg/10 hover:text-neg"
                >
                  <LogOut size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
