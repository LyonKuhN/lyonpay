import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, Wallet, Settings, CreditCard, LogOut } from 'lucide-react';
import Landing from './pages/Landing';
import Verify from './pages/Verify';
import Dashboard from './pages/Dashboard';
import Receitas from './pages/Receitas';
import Despesas from './pages/Despesas';
import Pagamentos from './pages/Pagamentos';
import Config from './pages/Config';
import Admin from './pages/Admin';
import { useAuth } from './contexts/AuthContext';
import { ShieldCheck } from 'lucide-react';

function FloatingNav() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const links = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Receitas', path: '/receitas', icon: Wallet },
    { name: 'Despesas', path: '/despesas', icon: Receipt },
    { name: 'Pagamentos', path: '/pagamentos', icon: CreditCard },
  ];

  if (user?.role === 'admin') {
    links.push({ name: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-auto max-w-6xl">
      <nav className="glass bg-[#15151A]/80 backdrop-blur-xl px-1.5 md:px-2 py-1.5 md:py-2 rounded-full border border-white/5 flex items-center justify-between md:justify-start shadow-2xl overflow-x-auto no-scrollbar">
        <div className="px-4 pr-6 flex items-center gap-2 border-r border-white/5 mr-2 hidden md:flex shrink-0">
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#FF8C00] flex items-center justify-center font-bold text-black shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              L
            </div>
            <span className="font-bold tracking-tight text-white hover:text-zinc-200 transition-colors">Lyonpay</span>
          </Link>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {links.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <link.icon size={16} className={isActive ? 'text-[#a3ff12]' : ''} />
                <span className="hidden md:inline">{link.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="pl-2 md:pl-4 ml-1 md:ml-2 border-l border-white/5 flex items-center gap-1 md:gap-2 shrink-0">
          <Link to="/config" className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
            <Settings size={18} />
          </Link>
          <button 
            onClick={logout}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-[#FF4D4D]/70 hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>
    </div>
  );
}

function PrivateRoute({ children, allowExpired = false }: { children: React.ReactNode, allowExpired?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/" />;

  // Se não for admin e a assinatura expirou, bloqueia (exceto se explicitamente permitido, como na tela de Config)
  if (user && user.role !== 'admin' && !allowExpired) {
    const isExpired = user.expires_at ? new Date(user.expires_at) < new Date() : true;
    if (isExpired) {
      return <Navigate to="/config?expired=true" />;
    }
  }

  return <>{children}</>;
}

function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isLanding = location.pathname === '/';

  return (
    <div className={`min-h-screen bg-[#09090B] text-white selection:bg-[#a3ff12] selection:text-black font-sans relative overflow-x-hidden`}>
      
      {!isLanding && (
        <>
          <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#a3ff12]/5 blur-[150px] rounded-full pointer-events-none" />
          <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FFD700]/5 blur-[150px] rounded-full pointer-events-none" />
        </>
      )}

      {!isLanding && <FloatingNav />}
      
      <main className={`${isLanding ? '' : 'pt-24 md:pt-32 pb-20 px-4 max-w-6xl mx-auto'} relative z-10 min-h-screen`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/receitas" element={<PrivateRoute><Receitas /></PrivateRoute>} />
          <Route path="/despesas" element={<PrivateRoute><Despesas /></PrivateRoute>} />
          <Route path="/pagamentos" element={<PrivateRoute><Pagamentos /></PrivateRoute>} />
          <Route path="/config" element={<PrivateRoute allowExpired={true}><Config /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute>{user?.role === 'admin' ? <Admin /> : <Navigate to="/dashboard" />}</PrivateRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
