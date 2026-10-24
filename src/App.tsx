import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { useEspaco } from './contexts/EspacoContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ConfirmProvider } from './components/ui/confirm';
import AppShell from './components/layout/AppShell';
import CookieConsent from './components/CookieConsent';

// A landing vem no pacote principal para aparecer rápido (LCP); as demais telas carregam sob demanda.
import Landing from './pages/Landing';
const Verify = lazy(() => import('./pages/Verify'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pagamentos = lazy(() => import('./pages/Pagamentos'));
const Despesas = lazy(() => import('./pages/Despesas'));
const Receitas = lazy(() => import('./pages/Receitas'));
const Calendario = lazy(() => import('./pages/Calendario'));
const Config = lazy(() => import('./pages/Config'));
const Carteira = lazy(() => import('./pages/Carteira'));
const Orcamentos = lazy(() => import('./pages/Orcamentos'));
const Metas = lazy(() => import('./pages/Metas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Importar = lazy(() => import('./pages/Importar'));
const Convite = lazy(() => import('./pages/Convite'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminCompras = lazy(() => import('./pages/AdminCompras'));
const AdminLembretes = lazy(() => import('./pages/AdminLembretes'));

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <img src="/logo.png" alt="Carregando" className="h-10 w-12 animate-pulse object-contain" />
    </div>
  );
}

/** Exige login; guarda a tela pedida para voltar a ela depois de entrar. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/" state={{ from: location.pathname + location.search }} replace />;
  return <>{children}</>;
}

/** Exige assinatura ou teste vigente; quem expirou vai para Configurações. */
function RequireActive({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { compartilhado, ativo } = useEspaco();
  // Nas finanças de outra pessoa vale o plano de quem compartilhou
  if (compartilhado) {
    if (ativo?.plano_ativo === false) return <Navigate to="/config?expired=true" replace />;
    return <>{children}</>;
  }
  if (user && user.role !== 'admin') {
    const expired = user.expires_at ? new Date(user.expires_at) < new Date() : true;
    if (expired) return <Navigate to="/config?expired=true" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** A landing é sempre escura; o app segue a escolha do usuário. */
function ThemeSync() {
  const { pathname } = useLocation();
  const { theme } = useTheme();

  useEffect(() => {
    const dark = pathname === '/' || theme === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0f' : '#f6f5f1');
  }, [pathname, theme]);

  return null;
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard" element={<RequireActive><Dashboard /></RequireActive>} />
          <Route path="/pagamentos" element={<RequireActive><Pagamentos /></RequireActive>} />
          <Route path="/despesas" element={<RequireActive><Despesas /></RequireActive>} />
          <Route path="/receitas" element={<RequireActive><Receitas /></RequireActive>} />
          <Route path="/calendario" element={<RequireActive><Calendario /></RequireActive>} />
          <Route path="/carteira" element={<RequireActive><Carteira /></RequireActive>} />
          <Route path="/orcamentos" element={<RequireActive><Orcamentos /></RequireActive>} />
          <Route path="/metas" element={<RequireActive><Metas /></RequireActive>} />
          <Route path="/relatorios" element={<RequireActive><Relatorios /></RequireActive>} />
          <Route path="/importar" element={<RequireActive><Importar /></RequireActive>} />
          <Route path="/convite" element={<Convite />} />
          <Route path="/config" element={<Config />} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/admin/compras" element={<RequireAdmin><AdminCompras /></RequireAdmin>} />
          <Route path="/admin/lembretes" element={<RequireAdmin><AdminLembretes /></RequireAdmin>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ThemeSync />
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
        <Toaster
          position="top-center"
          containerStyle={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          toastOptions={{
            duration: 3500,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-fg)',
              border: '1px solid var(--color-line)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-pop)',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 14px',
              maxWidth: '420px',
            },
            success: { iconTheme: { primary: 'var(--color-pos)', secondary: 'var(--color-surface)' } },
            error: { iconTheme: { primary: 'var(--color-neg)', secondary: 'var(--color-surface)' } },
          }}
        />
        <CookieConsent />
      </BrowserRouter>
    </ThemeProvider>
  );
}
