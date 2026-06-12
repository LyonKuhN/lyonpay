import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação inválido ou ausente.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Erro ao redefinir senha');
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 font-sans text-white relative">
      {/* Glow Effects */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#a3ff12]/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#a3ff12]/5 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md bg-[#15151A] border border-white/5 rounded-3xl p-8 relative z-10 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20">
            <Lock size={32} className="text-[#a3ff12]" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2">Nova Senha</h1>
        <p className="text-zinc-400 text-center text-sm mb-8">Crie uma nova senha para acessar sua conta Lyonk.</p>

        {success ? (
          <div className="text-center">
            <div className="p-4 rounded-2xl bg-[#a3ff12]/10 border border-[#a3ff12]/20 text-[#a3ff12] mb-6">
              Senha redefinida com sucesso!
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-4 bg-[#a3ff12] text-black font-bold rounded-2xl hover:scale-105 transition-all shadow-[0_10px_30px_rgba(163,255,18,0.2)] flex items-center justify-center gap-2"
            >
              Fazer Login <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            {!token && !error && (
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm text-center">
                O link de recuperação está incompleto.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Nova Senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#a3ff12] transition-colors"
                  required
                  disabled={!token}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Confirmar Senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#a3ff12] transition-colors"
                  required
                  disabled={!token}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-4 bg-[#a3ff12] text-black font-bold rounded-2xl hover:scale-105 transition-all shadow-[0_10px_30px_rgba(163,255,18,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Nova Senha'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3 bg-transparent text-zinc-500 hover:text-white transition-colors text-sm font-bold"
            >
              Voltar ao Início
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
