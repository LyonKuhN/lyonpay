import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BellRing, CircleCheck, Crown, KeyRound, LogOut, Moon, Sparkles, Ticket, Trash2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiFetch } from '../services/api';
import { useConfirm } from '../components/ui/confirm';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge, Card, PageHeader, Switch } from '../components/ui/primitives';
import { Sheet } from '../components/ui/sheet';
import { cn } from '../lib/cn';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 lg:grid-cols-[240px_1fr] lg:gap-8">
      <div className="px-1 lg:pt-1">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

function Row({ icon: Icon, title, description, control, className }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-4 sm:px-5', className)}>
      <Icon size={20} className="shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-fg">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {control}
    </div>
  );
}

export default function Config() {
  const { user, logout, updateUser, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [saving2FA, setSaving2FA] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cupom, setCupom] = useState('');
  const [cupomCheckout, setCupomCheckout] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [cupomMsg, setCupomMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [welcome, setWelcome] = useState(false);
  const verified = useRef(false);

  // Volta do checkout da Stripe
  useEffect(() => {
    if (searchParams.get('success') !== 'true' || verified.current) return;
    verified.current = true;
    (async () => {
      try {
        const data = await apiFetch('/api/stripe/verify-session');
        if (data?.subscribed) {
          await refreshUser();
          setWelcome(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, refreshUser]);

  const now = new Date();
  const expiresAt = user?.expires_at ? new Date(user.expires_at) : null;
  const isAdmin = user?.role === 'admin';
  const isExpired = !isAdmin && (!expiresAt || expiresAt < now);
  const isPro = isAdmin || (!!user?.subscribed && !isExpired);
  const daysLeft = expiresAt && !isExpired ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000) : 0;
  const lifetime = expiresAt && expiresAt.getFullYear() - now.getFullYear() > 50;

  const saveName = async () => {
    if (!user || !name.trim()) return;
    setSavingName(true);
    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
      updateUser({ ...user, name: name.trim() });
      toast.success('Nome atualizado');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível salvar');
    } finally {
      setSavingName(false);
    }
  };

  const toggleNotif = async (value: boolean) => {
    if (!user) return;
    setSavingNotif(true);
    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ notificacoes_diarias: value }) });
      updateUser({ ...user, notificacoes_diarias: value });
      toast.success(value ? 'Você receberá o aviso diário' : 'Aviso diário desligado');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível salvar');
    } finally {
      setSavingNotif(false);
    }
  };

  const toggle2FA = async (enabled: boolean) => {
    if (!user) return;
    setSaving2FA(true);
    try {
      await apiFetch('/api/auth/set-2fa', { method: 'POST', body: JSON.stringify({ enabled }) });
      updateUser({ ...user, two_factor_enabled: enabled });
      toast.success(enabled ? 'Verificação em duas etapas ativada' : 'Verificação em duas etapas desativada');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível alterar');
    } finally {
      setSaving2FA(false);
    }
  };

  const subscribe = async () => {
    setSubscribing(true);
    try {
      const data = await apiFetch('/api/stripe/create-checkout', {
        method: 'POST',
        body: JSON.stringify(cupomCheckout ? { cupom_codigo: cupomCheckout } : {}),
      });
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível abrir o pagamento');
      setSubscribing(false);
    }
  };

  const applyCupom = async () => {
    const code = cupom.trim().toUpperCase();
    if (!code) return;
    setApplying(true);
    setCupomMsg(null);
    try {
      const data = await apiFetch('/api/config/aplicar-cupom', { method: 'POST', body: JSON.stringify({ codigo: code }) });
      setCupomMsg({ ok: true, text: data.message });
      if (data.tipo === '100') {
        await refreshUser();
        setWelcome(true);
      } else {
        setCupomCheckout(code);
      }
    } catch (err) {
      setCupomMsg({ ok: false, text: (err as Error).message || 'Cupom inválido' });
    } finally {
      setApplying(false);
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: 'Excluir sua conta?',
      description: 'Todos os seus lançamentos, categorias e lembretes serão apagados para sempre. Essa ação não pode ser desfeita.',
      confirmText: 'Excluir conta',
      danger: true,
      requireText: 'EXCLUIR',
    });
    if (!ok) return;
    try {
      await apiFetch('/api/auth/me', { method: 'DELETE' });
      logout();
      navigate('/');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível excluir a conta');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="Configurações" description="Conta, segurança e assinatura." />

      {isExpired && (
        <div className="flex flex-col gap-4 rounded-2xl border border-neg/25 bg-neg/8 p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neg/15 text-neg"><TriangleAlert size={21} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">Seu acesso expirou</p>
            <p className="mt-0.5 text-sm text-muted">Assine o Lyonk Pro para voltar a usar o painel. Seus dados continuam guardados.</p>
          </div>
          <Button onClick={subscribe} isLoading={subscribing} className="w-full sm:w-auto"><Sparkles size={17} /> Assinar agora</Button>
        </div>
      )}

      <Section title="Perfil" description="Como você aparece no app.">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            <Input label="E-mail de acesso" value={user?.email ?? ''} disabled readOnly />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} isLoading={savingName} disabled={!name.trim() || name.trim() === user?.name}>Salvar nome</Button>
          </div>
        </div>
      </Section>

      <Section title="Preferências">
        <div className="divide-y divide-line">
          <Row
            icon={BellRing}
            title="Aviso diário por e-mail"
            description="Às 8h, quando houver contas vencendo no dia."
            control={<Switch checked={user?.notificacoes_diarias ?? true} onChange={toggleNotif} disabled={savingNotif} label="Aviso diário por e-mail" />}
          />
          <Row
            icon={Moon}
            title="Tema escuro"
            control={<Switch checked={theme === 'dark'} onChange={toggleTheme} label="Tema escuro" />}
          />
        </div>
      </Section>

      <Section title="Segurança">
        <Row
          icon={KeyRound}
          title="Verificação em duas etapas"
          description="Pede um código enviado ao seu e-mail a cada login."
          control={<Switch checked={!!user?.two_factor_enabled} onChange={toggle2FA} disabled={saving2FA} label="Verificação em duas etapas" />}
        />
      </Section>

      <Section title="Assinatura" description="Plano e pagamento.">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', isPro ? 'bg-brand/14 text-brand' : 'bg-elevated text-muted')}>
              <Crown size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-fg">Lyonk Pro</p>
                {isAdmin ? <Badge tone="brand">Administrador</Badge>
                  : isPro ? <Badge tone="pos">Ativa</Badge>
                  : isExpired ? <Badge tone="neg">Expirada</Badge>
                  : <Badge tone="info">Teste grátis</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {isAdmin ? 'Acesso completo de administrador.'
                  : isPro ? (lifetime ? 'Acesso liberado por cupom.' : `Válida até ${expiresAt?.toLocaleDateString('pt-BR')}.`)
                  : isExpired ? 'Assine para voltar a usar todos os recursos.'
                  : `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'} de teste.`}
              </p>
            </div>
          </div>

          {!isPro && (
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <div className="flex items-end gap-2">
                <Input
                  label="Cupom de desconto"
                  value={cupom}
                  onChange={(e) => setCupom(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  leftIcon={<Ticket size={17} />}
                  autoCapitalize="characters"
                  className="uppercase"
                />
                <Button variant="secondary" size="lg" onClick={applyCupom} isLoading={applying} disabled={!cupom.trim()}>Aplicar</Button>
              </div>
              {cupomMsg && <p className={cn('text-sm font-medium', cupomMsg.ok ? 'text-pos' : 'text-neg')}>{cupomMsg.text}</p>}
              <Button size="lg" fullWidth onClick={subscribe} isLoading={subscribing}>
                <Sparkles size={18} /> Assinar o Lyonk Pro
              </Button>
              <p className="text-center text-xs text-subtle">Pagamento seguro pela Stripe. Cancele quando quiser.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Conta">
        <div className="divide-y divide-line">
          <Row
            icon={LogOut}
            title="Sair da conta"
            description="Encerra a sessão neste aparelho."
            control={<Button variant="secondary" size="sm" onClick={() => { logout(); navigate('/'); }}>Sair</Button>}
          />
          <Row
            icon={Trash2}
            title={<span className="text-neg">Excluir conta</span>}
            description="Apaga todos os seus dados de forma permanente."
            control={<Button variant="danger-soft" size="sm" onClick={deleteAccount}>Excluir</Button>}
          />
        </div>
      </Section>

      <Sheet open={welcome} onClose={() => setWelcome(false)} size="sm" bare>
        <div className="pt-4 text-center sm:pt-6">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pos/12 text-pos"><CircleCheck size={28} /></span>
          <h2 className="text-lg font-semibold text-fg">Assinatura confirmada</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">Seu acesso ao Lyonk Pro está liberado. Bom controle!</p>
          <Button size="lg" fullWidth className="mt-6" onClick={() => { setWelcome(false); navigate('/dashboard'); }}>Ir para o início</Button>
        </div>
      </Sheet>
    </div>
  );
}
