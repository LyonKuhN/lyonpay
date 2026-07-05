import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  subscribed: boolean;
  expires_at?: string;
  two_factor_enabled?: boolean | null;
  notificacoes_diarias?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (newUser: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('lyonk_token');
    const savedUser = localStorage.getItem('lyonk_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  // Listen for session expiry events dispatched by apiFetch
  useEffect(() => {
    const handleExpired = () => {
      setSessionExpired(true);
      setToken(null);
      setUser(null);
      localStorage.removeItem('lyonk_token');
      localStorage.removeItem('lyonk_user');
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
    localStorage.setItem('lyonk_token', newToken);
    localStorage.setItem('lyonk_user', JSON.stringify(newUser));
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('lyonk_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('lyonk_token');
    localStorage.removeItem('lyonk_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token, isLoading }}>
      {children}

      {/* Session Expired Overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="bg-[#15151A] border border-white/10 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 mx-auto rounded-[1.2rem] bg-[#FF4D4D]/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF4D4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">Sessão Expirada</h2>
              <p className="text-zinc-500 text-sm font-bold mt-2 leading-relaxed">
                Por segurança, a sua sessão foi encerrada após um período de inatividade.<br/>Faça login novamente para continuar.
              </p>
            </div>
            <button
              onClick={() => { setSessionExpired(false); window.location.href = '/'; }}
              className="w-full py-4 bg-[#a3ff12] text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg text-sm uppercase tracking-widest"
            >
              Fazer Login Novamente
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
