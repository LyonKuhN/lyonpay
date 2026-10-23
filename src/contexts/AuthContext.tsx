import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

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
  /** Busca no servidor o plano e a validade atuais (sem novo login). */
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStored(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem('lyonk_token');
    const raw = localStorage.getItem('lyonk_user');
    return token && raw ? { token, user: JSON.parse(raw) } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ token, user }, setSession] = useState(readStored);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clear = () => {
    setSession({ token: null, user: null });
    localStorage.removeItem('lyonk_token');
    localStorage.removeItem('lyonk_user');
  };

  // apiFetch dispara este evento quando a API responde 401/403
  useEffect(() => {
    const handleExpired = () => {
      if (!localStorage.getItem('lyonk_token')) return;
      setSessionExpired(true);
      clear();
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setSession({ token: newToken, user: newUser });
    setSessionExpired(false);
    localStorage.setItem('lyonk_token', newToken);
    localStorage.setItem('lyonk_user', JSON.stringify(newUser));
  };

  const updateUser = useCallback((newUser: User) => {
    setSession((s) => ({ ...s, user: newUser }));
    localStorage.setItem('lyonk_user', JSON.stringify(newUser));
  }, []);

  const refreshUser = useCallback(async () => {
    const current = localStorage.getItem('lyonk_token');
    if (!current) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${current}` } });
      if (res.status === 401 || res.status === 403) {
        window.dispatchEvent(new CustomEvent('session-expired'));
        return;
      }
      if (!res.ok) return;
      const fresh = await res.json();
      if (fresh?.id) updateUser(fresh);
    } catch {
      // sem rede: segue com os dados guardados
    }
  }, [updateUser]);

  // Ao abrir o app, confirma plano e validade no servidor (o estado só muda depois da resposta)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  const logout = () => clear();

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser, isAuthenticated: !!token, isLoading: false }}>
      {children}

      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center shadow-pop">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warn/14 text-warn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-fg">Sua sessão expirou</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">Por segurança, entre de novo para continuar.</p>
            <button
              type="button"
              onClick={() => { setSessionExpired(false); window.location.href = '/'; }}
              className="mt-6 h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-on-brand transition-colors hover:bg-brand-soft"
            >
              Entrar novamente
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
