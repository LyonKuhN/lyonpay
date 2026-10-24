import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronRight, ChevronsUpDown, CreditCard, Eye, FileBarChart,
  FileUp, Goal, House, LayoutGrid, LoaderCircle, LogOut, Moon, PiggyBank, Plus, ReceiptText, Search, Settings, ShieldCheck, Sun, Users,
  Wallet, type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { EspacoProvider, useEspaco, type Visao } from '../../contexts/EspacoContext';
import { useCartoes, useContas } from '../../hooks/queries';
import { TransferenciaSheet } from '../forms/TransferenciaForm';
import { Stagger, StaggerItem } from '../ui/motion';
import { EASE_OUT } from '../../lib/motion';
import { InstalarApp } from '../InstalarApp';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge, EmptyState, IconTile, Segmented, Skeleton, Switch } from '../ui/primitives';
import { DespesaFormSheet, type DespesaFormTarget } from '../forms/DespesaForm';
import { ReceitaFormSheet } from '../forms/ReceitaForm';
import { LembreteFormSheet } from '../forms/LembreteForm';
import { apiFetch } from '../../services/api';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import type { TipoDespesa } from '../../lib/types';

// ---------------------------------------------------------------------------
// Ações rápidas: qualquer tela abre os formulários de criação sem trocar de página.

interface QuickActions {
  newDespesa: (tipo?: TipoDespesa, opts?: { cartao?: boolean }) => void;
  newReceita: () => void;
  newLembrete: (date?: string) => void;
  newTransferencia: () => void;
  openSearch: () => void;
}

const QuickActionsContext = createContext<QuickActions>({
  newDespesa: () => {},
  newReceita: () => {},
  newLembrete: () => {},
  newTransferencia: () => {},
  openSearch: () => {},
});

export const useQuickActions = () => useContext(QuickActionsContext);

// ---------------------------------------------------------------------------

interface NavItem { to: string; label: string; short: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Início', short: 'Início', icon: House },
  { to: '/pagamentos', label: 'Contas a pagar', short: 'Contas', icon: ReceiptText },
  { to: '/despesas', label: 'Despesas', short: 'Despesas', icon: ArrowUpRight },
  { to: '/receitas', label: 'Receitas', short: 'Receitas', icon: ArrowDownLeft },
  { to: '/calendario', label: 'Agenda', short: 'Agenda', icon: CalendarDays },
];

const NAV_PLANO: NavItem[] = [
  { to: '/carteira', label: 'Contas e cartões', short: 'Carteira', icon: Wallet },
  { to: '/orcamentos', label: 'Orçamentos', short: 'Orçamentos', icon: PiggyBank },
  { to: '/metas', label: 'Metas', short: 'Metas', icon: Goal },
  { to: '/relatorios', label: 'Relatórios', short: 'Relatórios', icon: FileBarChart },
  { to: '/importar', label: 'Importar extrato', short: 'Importar', icon: FileUp },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Início',
  '/pagamentos': 'Contas a pagar',
  '/despesas': 'Despesas',
  '/receitas': 'Receitas',
  '/calendario': 'Agenda',
  '/carteira': 'Contas e cartões',
  '/orcamentos': 'Orçamentos',
  '/metas': 'Metas',
  '/relatorios': 'Relatórios',
  '/importar': 'Importar extrato',
  '/config': 'Configurações',
  '/convite': 'Convite',
  '/admin': 'Administração',
  '/admin/compras': 'Lista de compras',
  '/admin/lembretes': 'Lembretes do admin',
};

const VISOES: Array<{ value: Visao; label: string }> = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'empresa', label: 'Empresa' },
];

function initials(name?: string, email?: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function usePlanLabel() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'admin') return { text: 'Admin', tone: 'brand' as const };
  const exp = user.expires_at ? new Date(user.expires_at) : null;
  if (exp && exp < new Date()) return { text: 'Expirado', tone: 'neg' as const };
  if (user.subscribed) return { text: user.cancela_no_fim ? 'Pro · até o fim do período' : 'Pro', tone: 'brand' as const };
  if (exp) {
    const days = Math.max(0, Math.ceil((exp.getTime() - new Date().getTime()) / 86_400_000));
    return { text: `Teste · ${days} ${days === 1 ? 'dia' : 'dias'}`, tone: 'info' as const };
  }
  return null;
}

function Avatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { user } = useAuth();
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-[13px]';
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand/12 font-semibold text-brand', s)}>
      {initials(user?.name, user?.email)}
    </span>
  );
}

function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" className="h-7 w-8 object-contain" />
      {withName && <span className="text-[17px] font-semibold tracking-tight text-fg">Lyonk</span>}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full sm:w-72" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AppShell() {
  return (
    <EspacoProvider>
      <Shell />
    </EspacoProvider>
  );
}

function Shell() {
  const location = useLocation();
  const { somenteLeitura } = useEspaco();
  const [despesaTarget, setDespesaTarget] = useState<DespesaFormTarget | null>(null);
  const [receitaOpen, setReceitaOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [lembrete, setLembrete] = useState<{ open: boolean; date?: string }>({ open: false });
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [espacoOpen, setEspacoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const actions = useMemo<QuickActions>(() => ({
    newDespesa: (tipo, opts) => setDespesaTarget({ tipo, cartao: opts?.cartao }),
    newReceita: () => setReceitaOpen(true),
    newLembrete: (date) => setLembrete({ open: true, date }),
    newTransferencia: () => setTransferOpen(true),
    openSearch: () => setSearchOpen(true),
  }), []);

  // Ctrl/⌘ + K abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const title = TITLES[location.pathname] ?? 'Lyonk';
  const novo = somenteLeitura ? undefined : () => setQuickOpen(true);

  return (
    <QuickActionsContext.Provider value={actions}>
      <div className="min-h-dvh bg-bg">
        <Sidebar onNew={novo} onSearch={() => setSearchOpen(true)} onEspacos={() => setEspacoOpen(true)} />
        <TopBar title={title} onSearch={() => setSearchOpen(true)} onAccount={() => setMenuOpen(true)} />

        <main className="lg:pl-64">
          {/* No desktop o conteúdo ocupa toda a largura; o limite só segura monitores muito largos */}
          <div className="mx-auto w-full max-w-[1760px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 2xl:px-10">
            <EspacoBanner />
            {/* Troca de tela: sobe, desfoca e assenta; o filtro sai no fim para não prender elementos fixos */}
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              transition={{ duration: 0.34, ease: EASE_OUT }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </div>
        </main>

        <BottomNav onNew={novo} onMore={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} />
      </div>

      <QuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onEspacos={() => { setMenuOpen(false); setTimeout(() => setEspacoOpen(true), 150); }} />
      <EspacoSheet open={espacoOpen} onClose={() => setEspacoOpen(false)} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <DespesaFormSheet open={!!despesaTarget} target={despesaTarget} onClose={() => setDespesaTarget(null)} />
      <ReceitaFormSheet open={receitaOpen} onClose={() => setReceitaOpen(false)} />
      <TransferenciaSheet open={transferOpen} onClose={() => setTransferOpen(false)} />
      <LembreteFormSheet open={lembrete.open} defaultDate={lembrete.date} onClose={() => setLembrete({ open: false })} />
      <TwoFactorPrompt />
    </QuickActionsContext.Provider>
  );
}

/** Aviso fixo quando a pessoa está nas finanças de outra pessoa. */
function EspacoBanner() {
  const { compartilhado, ativo, somenteLeitura, trocar } = useEspaco();
  const { user } = useAuth();
  if (!compartilhado || !ativo || !user) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info/8 px-4 py-3 lg:mb-6"
    >
      <IconTile icon={somenteLeitura ? Eye : Users} tone="info" size="sm" />
      <p className="min-w-0 flex-1 text-sm text-fg">
        Finanças de <strong className="font-semibold">{ativo.nome}</strong>
        <span className="text-muted">{somenteLeitura ? ' · só leitura' : ' · você pode editar'}</span>
      </p>
      <Button variant="ghost" size="sm" onClick={() => trocar(user.id)}>Voltar às minhas</Button>
    </motion.div>
  );
}

function VisaoSwitch({ className }: { className?: string }) {
  const { visao, setVisao, modoEmpresa } = useEspaco();
  if (!modoEmpresa) return null;
  return <Segmented size="sm" value={visao} onChange={setVisao} options={VISOES} className={className} />;
}

function EspacoButton({ onClick }: { onClick: () => void }) {
  const { espacos, ativo } = useEspaco();
  if (espacos.length < 2 || !ativo) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-bg px-3 text-left transition-colors hover:border-line-strong"
    >
      <Users size={16} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{ativo.proprio ? 'Minhas finanças' : ativo.nome}</span>
      <ChevronsUpDown size={15} className="shrink-0 text-subtle" />
    </button>
  );
}

function Sidebar({ onNew, onSearch, onEspacos }: { onNew?: () => void; onSearch: () => void; onEspacos: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const plan = usePlanLabel();

  const linkClass = ({ isActive }: { isActive: boolean }) => cn(
    'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
    isActive ? 'text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg',
  );

  const item = ({ to, label, icon: Icon }: NavItem) => (
    <NavLink key={to} to={to} end={to === '/dashboard'} className={linkClass}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="sidebar-ativo" className="absolute inset-0 rounded-xl bg-elevated" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
          )}
          <Icon size={18} className={cn('relative', isActive && 'text-brand')} />
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link to="/dashboard"><Logo /></Link>
      </div>

      <div className="space-y-2 px-3">
        <EspacoButton onClick={onEspacos} />
        <VisaoSwitch />
        {onNew && <Button onClick={onNew} fullWidth className="justify-start px-3"><Plus size={18} /> Novo lançamento</Button>}
        <button
          type="button"
          onClick={onSearch}
          className="flex h-10 w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted"
        >
          <Search size={16} />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded-md border border-line px-1.5 text-[11px] font-medium">Ctrl K</kbd>
        </button>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map(item)}
        <p className="px-3 pb-1.5 pt-5 text-xs font-medium text-subtle">Planejamento</p>
        {NAV_PLANO.map(item)}
        <p className="px-3 pb-1.5 pt-5 text-xs font-medium text-subtle">Conta</p>
        {item({ to: '/config', label: 'Configurações', short: 'Ajustes', icon: Settings })}
        {user?.role === 'admin' && item({ to: '/admin', label: 'Administração', short: 'Admin', icon: ShieldCheck })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{user?.name || 'Sua conta'}</p>
            {plan ? <Badge tone={plan.tone} className="mt-0.5">{plan.text}</Badge> : <p className="truncate text-xs text-subtle">{user?.email}</p>}
          </div>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" onClick={logout} aria-label="Sair" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-neg/10 hover:text-neg">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, onSearch, onAccount }: { title: string; onSearch: () => void; onAccount: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const { visao } = useEspaco();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b pt-safe backdrop-blur-xl transition-colors lg:hidden',
        scrolled ? 'border-line bg-bg/85' : 'border-transparent bg-bg/60',
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link to="/dashboard" aria-label="Início" className="shrink-0"><Logo withName={false} /></Link>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-fg">
          {title}
          {visao !== 'tudo' && <Badge tone="brand" className="ml-2 align-middle">{visao === 'empresa' ? 'Empresa' : 'Pessoal'}</Badge>}
        </h1>
        <button type="button" onClick={onSearch} aria-label="Buscar" className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg">
          <Search size={20} />
        </button>
        <button type="button" onClick={onAccount} aria-label="Conta e menu" className="rounded-full">
          <Avatar />
        </button>
      </div>
    </header>
  );
}

function BottomNav({ onNew, onMore, onSearch }: { onNew?: () => void; onMore: () => void; onSearch: () => void }) {
  const location = useLocation();
  const items: Array<NavItem | 'novo' | 'mais'> = [NAV[0], NAV[1], 'novo', NAV[2], 'mais'];
  const noMais = !['/dashboard', '/pagamentos', '/despesas'].includes(location.pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-safe backdrop-blur-xl lg:hidden" aria-label="Navegação principal">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
        {items.map((item) => {
          if (item === 'novo') {
            return (
              <div key="novo" className="flex justify-center">
                <motion.button
                  type="button"
                  onClick={onNew ?? onSearch}
                  whileTap={{ scale: 0.9, rotate: onNew ? 90 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  aria-label={onNew ? 'Novo lançamento' : 'Buscar'}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-on-brand shadow-lg shadow-brand/30"
                >
                  {onNew ? <Plus size={24} strokeWidth={2.4} /> : <Search size={22} />}
                </motion.button>
              </div>
            );
          }
          if (item === 'mais') {
            return (
              <button key="mais" type="button" onClick={onMore} className="relative flex h-full flex-col items-center justify-center gap-1">
                {noMais && <motion.span layoutId="bottom-nav-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <LayoutGrid size={22} strokeWidth={noMais ? 2.2 : 1.8} className={noMais ? 'text-fg' : 'text-subtle'} />
                <span className={cn('text-[11px] leading-none', noMais ? 'font-semibold text-fg' : 'font-medium text-subtle')}>Mais</span>
              </button>
            );
          }
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="relative flex h-full flex-col items-center justify-center gap-1" aria-current={active ? 'page' : undefined}>
              {active && (
                <motion.span layoutId="bottom-nav-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
              <motion.span animate={{ y: active ? -1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-fg' : 'text-subtle'} />
              </motion.span>
              <span className={cn('text-[11px] leading-none', active ? 'font-semibold text-fg' : 'font-medium text-subtle')}>{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { newDespesa, newReceita, newLembrete, newTransferencia } = useQuickActions();
  const { data: cartoes = [] } = useCartoes();
  const { data: contas = [] } = useContas();
  const options: Array<{ icon: LucideIcon; tone: 'neg' | 'pos' | 'warn' | 'info' | 'brand'; title: string; desc: string; run: () => void }> = [
    { icon: ArrowUpRight, tone: 'neg', title: 'Despesa', desc: 'Gasto, conta fixa ou compra parcelada', run: () => newDespesa() },
    ...(cartoes.some((c) => c.ativo) ? [{ icon: CreditCard, tone: 'brand' as const, title: 'Compra no cartão', desc: 'Entra direto na fatura certa', run: () => newDespesa(undefined, { cartao: true }) }] : []),
    { icon: ArrowDownLeft, tone: 'pos', title: 'Receita', desc: 'Salário, venda ou outra entrada', run: newReceita },
    ...(contas.filter((c) => c.ativo).length >= 2 ? [{ icon: ArrowLeftRight, tone: 'info' as const, title: 'Transferência', desc: 'Entre as suas contas', run: newTransferencia }] : []),
    { icon: Bell, tone: 'warn', title: 'Lembrete', desc: 'Aviso com data e hora', run: () => newLembrete() },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Novo lançamento" size="sm">
      <Stagger className="space-y-2">
        {options.map((o) => (
          <StaggerItem key={o.title}>
            <button
              type="button"
              onClick={() => { onClose(); setTimeout(o.run, 120); }}
              className="flex w-full items-center gap-4 rounded-2xl border border-line bg-bg px-4 py-3.5 text-left transition-[border-color,transform] hover:border-line-strong active:scale-[0.99]"
            >
              <IconTile icon={o.icon} tone={o.tone} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-fg">{o.title}</span>
                <span className="block text-[13px] text-muted">{o.desc}</span>
              </span>
              <ChevronRight size={18} className="text-subtle" />
            </button>
          </StaggerItem>
        ))}
      </Stagger>
    </Sheet>
  );
}

/** Menu do celular: todas as telas em blocos, espaço, visão, tema e sair. */
function MenuSheet({ open, onClose, onEspacos }: { open: boolean; onClose: () => void; onEspacos: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const plan = usePlanLabel();

  const go = (to: string) => { onClose(); navigate(to); };

  const tiles: NavItem[] = [
    NAV[3],
    ...NAV_PLANO,
    NAV[4],
    { to: '/config', label: 'Configurações', short: 'Ajustes', icon: Settings },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Administração', short: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Menu" size="sm">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-bg p-4">
        <Avatar size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-fg">{user?.name || 'Sem nome'}</p>
          <p className="truncate text-[13px] text-muted">{user?.email}</p>
        </div>
        {plan && <Badge tone={plan.tone}>{plan.text}</Badge>}
      </div>

      <div className="mb-4 space-y-2">
        <EspacoButton onClick={onEspacos} />
        <VisaoSwitch />
      </div>

      <Stagger className="grid grid-cols-3 gap-2">
        {tiles.map(({ to, short, icon: Icon }) => {
          const ativo = location.pathname === to;
          return (
            <StaggerItem key={to}>
              <button
                type="button"
                onClick={() => go(to)}
                className={cn(
                  'flex aspect-[1.15] w-full flex-col items-center justify-center gap-2 rounded-2xl border text-[13px] font-medium transition-[border-color,transform] active:scale-[0.97]',
                  ativo ? 'border-brand/50 bg-brand/10 text-fg' : 'border-line bg-bg text-fg hover:border-line-strong',
                )}
              >
                <Icon size={22} className={ativo ? 'text-brand' : 'text-muted'} />
                {short}
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg">
        <div className="flex h-14 items-center gap-3 px-4">
          <Moon size={19} className="text-muted" />
          <span className="flex-1 text-[15px] text-fg">Tema escuro</span>
          <Switch checked={theme === 'dark'} onChange={toggleTheme} label="Tema escuro" />
        </div>
      </div>

      <InstalarApp className="mt-4" />

      <Button variant="danger-soft" size="lg" fullWidth className="mt-4" onClick={() => { onClose(); logout(); }}>
        <LogOut size={18} /> Sair da conta
      </Button>
    </Sheet>
  );
}

function EspacoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { espacos, ativo, trocar } = useEspaco();
  const navigate = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="Trocar de finanças" description="Contas que compartilharam com você aparecem aqui." size="sm">
      <div className="space-y-2">
        {espacos.map((e) => {
          const marcado = ativo?.dono_id === e.dono_id;
          return (
            <button
              key={e.dono_id}
              type="button"
              onClick={() => { trocar(e.dono_id); onClose(); navigate('/dashboard'); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                marcado ? 'border-brand/50 bg-brand/8' : 'border-line bg-bg hover:border-line-strong',
              )}
            >
              <IconTile icon={e.proprio ? House : Users} tone={marcado ? 'brand' : 'neutral'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-fg">{e.proprio ? 'Minhas finanças' : e.nome}</span>
                <span className="block text-[13px] text-muted">
                  {e.proprio ? 'Sua conta' : e.permissao === 'ver' ? 'Só leitura' : 'Pode editar'}
                  {!e.proprio && e.plano_ativo === false ? ' · plano do dono expirado' : ''}
                </span>
              </span>
              {marcado && <Check size={18} className="text-brand" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface SearchRow { id: string; descricao: string; valor: number | string; row_type: 'despesa' | 'receita'; data_vencimento?: string; data_recebimento?: string; pago?: boolean }

function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => apiFetch(`/api/search?q=${encodeURIComponent(term)}`),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  });
  const results = (Array.isArray(data) ? data : []) as SearchRow[];

  const close = useCallback(() => { onClose(); setQ(''); }, [onClose]);

  const openRow = (r: SearchRow) => {
    close();
    navigate(`/${r.row_type === 'receita' ? 'receitas' : 'despesas'}?q=${encodeURIComponent(r.descricao.replace(/\s*\(\d+\/\d+\)$/, ''))}`);
  };

  return (
    <Sheet open={open} onClose={close} title="Buscar lançamentos" size="md">
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3 sm:-mx-6 sm:px-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Descrição da despesa ou receita"
          leftIcon={<Search size={18} />}
          autoFocus
          enterKeyHint="search"
        />
      </div>
      {term.length < 2 ? (
        <p className="py-10 text-center text-sm text-subtle">Digite ao menos 2 letras.</p>
      ) : isFetching && results.length === 0 ? (
        <div className="flex justify-center py-10"><LoaderCircle className="animate-spin text-subtle" /></div>
      ) : results.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description={`Nenhum lançamento com "${term}".`} />
      ) : (
        <div className="-mx-2 divide-y divide-line">
          {results.slice(0, 40).map((r) => {
            const receita = r.row_type === 'receita';
            return (
              <button key={`${r.row_type}-${r.id}`} type="button" onClick={() => openRow(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-elevated">
                <IconTile icon={receita ? ArrowDownLeft : ArrowUpRight} tone={receita ? 'pos' : 'neg'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fg">{r.descricao}</span>
                  <span className="block text-[13px] text-muted">
                    {receita ? 'Receita' : r.pago ? 'Despesa paga' : 'Despesa'} · {formatDate(r.data_recebimento || r.data_vencimento)}
                  </span>
                </span>
                <span className={cn('text-[15px] font-semibold tabular-nums', receita ? 'text-pos' : 'text-fg')}>
                  {receita ? '+' : '−'} {formatBRL(r.valor)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

function TwoFactorPrompt() {
  const { user, updateUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState<boolean | null>(null);
  const open = !!user && (user.two_factor_enabled === null || user.two_factor_enabled === undefined) && !dismissed;

  const choose = async (enabled: boolean) => {
    setSaving(enabled);
    try {
      await apiFetch('/api/auth/set-2fa', { method: 'POST', body: JSON.stringify({ enabled }) });
      if (user) updateUser({ ...user, two_factor_enabled: enabled });
      toast.success(enabled ? 'Verificação em duas etapas ativada' : 'Você pode ativar depois em Configurações');
      setDismissed(true);
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível salvar a preferência');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Sheet open={open} onClose={() => setDismissed(true)} size="sm" bare>
      <div className="pt-4 text-center sm:pt-6">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/12 text-brand">
          <ShieldCheck size={28} />
        </span>
        <h2 className="text-lg font-semibold text-fg">Proteja sua conta</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          Com a verificação em duas etapas, cada login pede um código enviado ao seu e-mail.
        </p>
        <div className="mt-6 space-y-2">
          <Button size="lg" fullWidth onClick={() => choose(true)} isLoading={saving === true}>Ativar verificação</Button>
          <Button size="lg" variant="ghost" fullWidth onClick={() => choose(false)} isLoading={saving === false}>Agora não</Button>
        </div>
      </div>
    </Sheet>
  );
}
