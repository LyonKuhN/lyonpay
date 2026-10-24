import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { apiFetch } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  subscribed: boolean;
  expires_at?: string;
  cancela_no_fim?: boolean;
  two_factor_enabled?: boolean | null;
  notificacoes_diarias?: boolean;
  gerar_fixas_auto?: boolean;
  onboarding_concluido?: boolean;
  modo_empresa?: boolean;
}

interface AuthContextType {
  user: User | null;
  /** Depois de entrar: a sessão já está no cookie; aqui só guardamos os dados para a interface. */
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (newUser: User) => void;
  /** Busca no servidor o plano e as preferências atuais. */
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CHAVE_USUARIO = 'lyonk_user';

function lerUsuario(): User | null {
  try {
    // O token antigo ficava no navegador; agora a sessão é só o cookie httpOnly
    localStorage.removeItem('lyonk_token');
    const raw = localStorage.getItem(CHAVE_USUARIO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function salvarUsuario(user: User | null) {
  try {
    if (user) localStorage.setItem(CHAVE_USUARIO, JSON.stringify(user));
    else localStorage.removeItem(CHAVE_USUARIO);
  } catch {
    // sem armazenamento: segue só em memória
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(lerUsuario);
  // Sem dados guardados, confere uma vez se há sessão (cookie) antes de decidir o que mostrar
  const [isLoading, setIsLoading] = useState(() => !lerUsuario());
  const [sessionExpired, setSessionExpired] = useState(false);

  const limpar = useCallback(() => {
    setUser(null);
    salvarUsuario(null);
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      if (!localStorage.getItem(CHAVE_USUARIO)) return;
      setSessionExpired(true);
      limpar();
    };
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, [limpar]);

  const login = useCallback((novo: User) => {
    setUser(novo);
    salvarUsuario(novo);
    setSessionExpired(false);
  }, []);

  const updateUser = useCallback((novo: User) => {
    setUser(novo);
    salvarUsuario(novo);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' });
      if (res.status === 401) {
        limpar();
        return;
      }
      if (!res.ok) return;
      const fresh = await res.json();
      if (fresh?.id) {
        setUser(fresh);
        salvarUsuario(fresh);
      }
    } catch {
      // sem rede: segue com os dados guardados
    } finally {
      setIsLoading(false);
    }
  }, [limpar]);

  // Ao abrir o app, confirma a sessão e o plano no servidor (o estado só muda depois da resposta)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // mesmo sem resposta, limpa a interface
    }
    limpar();
  }, [limpar]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, refreshUser, isAuthenticated: !!user, isLoading }}>
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
              onClick={() => { setSessionExpired(false); window.location.href = '/?entrar=1'; }}
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
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
