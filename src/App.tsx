import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingDown, TrendingUp, Settings, CreditCard, LogOut, Sun, Moon, ShieldCheck, Calendar, User } from 'lucide-react';
import Landing from './pages/Landing';
import Verify from './pages/Verify';
import Dashboard from './pages/Dashboard';
import Receitas from './pages/Receitas';
import Despesas from './pages/Despesas';
import Pagamentos from './pages/Pagamentos';
import Calendario from './pages/Calendario';
import Config from './pages/Config';
import Admin from './pages/Admin';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useState, useRef, useEffect } from 'react';

function FloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const mainLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Receitas', path: '/receitas', icon: TrendingUp },
    { name: 'Despesas', path: '/despesas', icon: TrendingDown },
    { name: 'Pagamentos', path: '/pagamentos', icon: CreditCard },
  ];

  const extraLinks = [
    { name: 'Calendário', path: '/calendario', icon: Calendar },
    { name: 'Configurações', path: '/config', icon: Settings },
  ];

  if (user?.role === 'admin') {
    extraLinks.unshift({ name: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] md:w-auto md:min-w-[500px] max-w-6xl">
      <nav className="glass bg-[#15151A]/80 backdrop-blur-xl px-4 md:px-6 py-2 rounded-full border border-white/5 flex items-center justify-between shadow-2xl relative">
        
        {/* Logo */}
        <div className="pr-3 md:pr-4 flex items-center border-r border-white/5 mr-2 md:mr-4 shrink-0">
          <Link to="/" className="flex items-center cursor-pointer">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow-lg" />
          </Link>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 flex items-center justify-center gap-1 md:gap-2 px-1">
          {mainLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`px-3 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#a3ff12]/10 text-[#a3ff12] shadow-lg'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <link.icon size={16} className={isActive ? 'text-[#a3ff12]' : ''} />
                <span className="hidden lg:inline">{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Profile / Extra Menu */}
        <div className="pl-2 md:pl-4 ml-2 md:ml-4 border-l border-white/5 flex items-center gap-1 shrink-0" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${
              isMenuOpen ? 'bg-[#a3ff12] text-black shadow-[0_0_15px_rgba(163,255,18,0.4)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={18} />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-full mt-3 right-0 w-64 bg-[#15151A] border border-white/10 rounded-3xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-2xl">
              <div className="px-4 py-3 border-b border-white/5 mb-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Conectado como</p>
                <p className="text-sm font-black text-white truncate">{user?.name || user?.email}</p>
              </div>

              <div className="space-y-1">
                {extraLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${
                        isActive ? 'bg-[#a3ff12] text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <link.icon size={16} />
                      {link.name}
                    </Link>
                  );
                })}

                <button
                  onClick={() => { toggleTheme(); setIsMenuOpen(false); }}
                  className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </button>

                <div className="h-px bg-white/5 my-2" />

                <button
                  onClick={logout}
                  className="w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 text-[#FF4D4D]/70 hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 transition-all"
                >
                  <LogOut size={16} />
                  Sair da Conta
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

function PrivateRoute({ children, allowExpired = false }: { children: React.ReactNode, allowExpired?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Aguarda a verificação do localStorage antes de redirecionar
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#a3ff12] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" />;

  if (user && user.role !== 'admin' && !allowExpired) {
    const isExpired = user.expires_at ? new Date(user.expires_at) < new Date() : true;
    if (isExpired) return <Navigate to="/config?expired=true" />;
  }

  return <>{children}</>;
}

function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isLanding = location.pathname === '/';

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#09090B] text-white' : 'bg-gray-50 text-gray-900'} selection:bg-[#a3ff12] selection:text-black font-sans relative overflow-x-hidden transition-colors duration-300`}>

      {!isLanding && theme === 'dark' && (
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
          <Route path="/calendario" element={<PrivateRoute><Calendario /></PrivateRoute>} />
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
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
