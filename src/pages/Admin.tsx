import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Crown, Search, ShieldCheck, Ticket, Trash2, TrendingUp, Users } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input, MoneyInput } from '../components/ui/input';
import { Badge, Card, CardHeader, EmptyState, IconTile, PageHeader, Skeleton } from '../components/ui/primitives';
import { formatBRL, parseMoney, toMoneyInput } from '../lib/format';

interface Stats { totalUsers?: number | string; proUsers?: number | string; globalVolume?: number | string; monthlyFee?: number | string }
interface AdminUser { id: string; email: string; display_name?: string; role: string; created_at: string; is_pro?: boolean }
interface Cupom { id: string; codigo: string; desconto_percentual: number | string; max_usos?: number | null; usos_atuais?: number }

export default function Admin() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [userQuery, setUserQuery] = useState('');
  const [fee, setFee] = useState<string | null>(null);
  const [novo, setNovo] = useState({ codigo: '', desconto: '', max: '' });

  const statsQ = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => apiFetch('/api/admin/stats') as Promise<Stats>, enabled: !!token });
  const usersQ = useQuery({ queryKey: ['admin', 'users'], queryFn: () => apiFetch('/api/admin/users') as Promise<AdminUser[]>, enabled: !!token });
  const cuponsQ = useQuery({ queryKey: ['admin', 'cupons'], queryFn: () => apiFetch('/api/admin/cupons') as Promise<Cupom[]>, enabled: !!token });

  const stats = statsQ.data;
  const users = useMemo(() => (Array.isArray(usersQ.data) ? usersQ.data : []), [usersQ.data]);
  const cupons = Array.isArray(cuponsQ.data) ? cuponsQ.data : [];
  const feeValue = fee ?? toMoneyInput(stats?.monthlyFee);

  const filteredUsers = useMemo(() => {
    const t = userQuery.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => u.email.toLowerCase().includes(t) || (u.display_name || '').toLowerCase().includes(t));
  }, [users, userQuery]);

  const saveFee = useMutation({
    mutationFn: (value: number) => apiFetch('/api/admin/config', { method: 'POST', body: JSON.stringify({ key: 'monthly_fee', value: value.toFixed(2) }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setFee(null);
      toast.success('Mensalidade atualizada');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível salvar'),
  });

  const createCupom = useMutation({
    mutationFn: () => apiFetch('/api/admin/cupons', {
      method: 'POST',
      body: JSON.stringify({ codigo: novo.codigo, desconto_percentual: novo.desconto, max_usos: novo.max || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cupons'] });
      setNovo({ codigo: '', desconto: '', max: '' });
      toast.success('Cupom criado');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível criar o cupom'),
  });

  const deleteCupom = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/cupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cupons'] });
      toast.success('Cupom removido');
    },
  });

  const feeNumber = parseMoney(feeValue);
  const feeChanged = fee !== null && feeNumber > 0 && Math.abs(feeNumber - Number(stats?.monthlyFee)) > 0.004;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader title="Administração" description="Usuários, assinaturas e cupons da plataforma." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          { label: 'Usuários', value: stats?.totalUsers ?? '—', icon: Users, tone: 'neutral' as const },
          { label: 'Assinantes Pro', value: stats?.proUsers ?? '—', icon: Crown, tone: 'brand' as const },
          { label: 'Volume movimentado', value: stats ? formatBRL(stats.globalVolume, { cents: false }) : '—', icon: TrendingUp, tone: 'info' as const },
        ].map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <IconTile icon={s.icon} tone={s.tone} size="sm" />
            <p className="mt-3 text-[13px] text-muted">{s.label}</p>
            {statsQ.isLoading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className="mt-0.5 truncate text-xl font-semibold tabular-nums text-fg">{s.value}</p>}
          </Card>
        ))}
        <Card className="col-span-2 p-4 sm:p-5 lg:col-span-1">
          <div className="flex items-end gap-2">
            <MoneyInput label="Mensalidade" value={feeValue} onChange={setFee} />
            <Button size="lg" disabled={!feeChanged} isLoading={saveFee.isPending} onClick={() => saveFee.mutate(feeNumber)}>Salvar</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader title="Usuários" description={`${users.length} cadastrados`} />
          <div className="px-4 pt-3 sm:px-5">
            <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" leftIcon={<Search size={17} />} className="h-11" />
          </div>
          <div className="mt-3 max-h-[560px] divide-y divide-line overflow-y-auto border-t border-line">
            {usersQ.isLoading ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState icon={Users} title="Nenhum usuário encontrado" />
            ) : filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <IconTile icon={u.role === 'admin' ? ShieldCheck : Users} tone={u.role === 'admin' ? 'brand' : 'neutral'} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[15px] font-medium text-fg">
                    <span className="truncate">{u.display_name || 'Sem nome'}</span>
                    {u.is_pro && <Badge tone="brand">Pro</Badge>}
                    {u.role === 'admin' && <Badge tone="info">Admin</Badge>}
                  </p>
                  <p className="truncate text-[13px] text-muted">{u.email}</p>
                </div>
                <p className="hidden shrink-0 text-xs text-subtle sm:block">desde {new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Cupons" description={`${cupons.length} cadastrados`} />
          <form
            className="grid grid-cols-2 gap-3 p-4 sm:p-5"
            onSubmit={(e) => { e.preventDefault(); if (novo.codigo && novo.desconto) createCupom.mutate(); }}
          >
            <div className="col-span-2">
              <Input label="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value.replace(/\s/g, '').toUpperCase() })} placeholder="EX.: LYONK20" required />
            </div>
            <Input label="Desconto (%)" type="number" inputMode="numeric" min={1} max={100} value={novo.desconto} onChange={(e) => setNovo({ ...novo, desconto: e.target.value })} required />
            <Input label="Limite de usos" type="number" inputMode="numeric" min={1} value={novo.max} onChange={(e) => setNovo({ ...novo, max: e.target.value })} placeholder="Ilimitado" />
            <Button type="submit" className="col-span-2" isLoading={createCupom.isPending}><Ticket size={17} /> Criar cupom</Button>
          </form>
          <div className="divide-y divide-line border-t border-line">
            {cupons.length === 0 ? (
              <EmptyState icon={Ticket} title="Nenhum cupom" className="py-8" />
            ) : cupons.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <IconTile icon={Ticket} tone="brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[15px] font-semibold text-fg">{c.codigo}</p>
                  <p className="text-[13px] text-muted">{Number(c.desconto_percentual)}% de desconto · {c.usos_atuais ?? 0}/{c.max_usos ?? '∞'} usos</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover cupom ${c.codigo}`}
                  onClick={async () => {
                    if (await confirm({ title: 'Remover cupom?', description: c.codigo, confirmText: 'Remover', danger: true })) deleteCupom.mutate(c.id);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
