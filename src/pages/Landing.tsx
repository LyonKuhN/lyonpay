import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, PieChart, Shield, Zap, CheckCircle2, Loader2, Mail, LayoutDashboard, CreditCard, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function Landing() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<'login' | 'register' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const endpoint = isAuthModalOpen === 'login' ? 'login' : 'register';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro na autenticação');

      if (isAuthModalOpen === 'register') {
        setSuccessMessage('Cadastro realizado! Enviamos um link de confirmação para o seu e-mail.');
        setFormData({ name: '', email: '', password: '' });
      } else {
        login(data.token, data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] font-sans selection:bg-[#a3ff12] selection:text-black">
      
      {/* Navbar Premium */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#FF8C00] flex items-center justify-center font-bold text-black text-xl shadow-[0_0_15px_rgba(255,215,0,0.4)]">L</div>
            <span className="font-bold text-xl tracking-tight text-white">Lyonpay</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#solucao" className="hover:text-white transition-colors">Solução</a>
            <a href="#precos" className="hover:text-white transition-colors">Preços</a>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm font-bold bg-[#a3ff12] text-black px-6 py-2.5 rounded-full hover:bg-[#a3ff12]/90 transition-colors">Ir para o App</button>
            ) : (
              <>
                <button onClick={() => setIsAuthModalOpen('login')} className="text-sm font-bold text-white hover:text-[#a3ff12] transition-colors">Entrar</button>
                <button onClick={() => setIsAuthModalOpen('register')} className="text-sm font-bold bg-white text-black px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-colors">Criar Conta</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#a3ff12]/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#a3ff12]/10 border border-[#a3ff12]/20 text-[#a3ff12] text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Zap size={14} /> Inteligência Financeira de Próxima Geração
          </div>
          
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter text-white mb-8 leading-[1.05] animate-in fade-in slide-in-from-bottom-8 duration-700">
            Controle seu dinheiro <br className="hidden md:block" />
            com a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#a3ff12]">precisão da Lyonpay.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-700">
            A plataforma definitiva para quem busca organização real, automação de despesas fixas e projeção financeira inteligente.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700">
            <button onClick={() => setIsAuthModalOpen('register')} className="px-10 py-5 bg-[#a3ff12] text-black font-extrabold rounded-full hover:scale-105 transition-transform flex items-center justify-center gap-2 text-lg shadow-[0_0_40px_rgba(163,255,18,0.4)]">
              Começar Teste Grátis <ArrowRight size={22}/>
            </button>
            <button className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all text-lg">
              Ver Demonstração
            </button>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-6xl mx-auto mt-24 relative z-10 group animate-in fade-in zoom-in-95 duration-1000 delay-300">
          <div className="absolute inset-0 bg-gradient-to-b from-[#a3ff12]/20 to-transparent blur-3xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <div className="relative p-3 bg-[#15151A] rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <img src="/hero_mockup.png" alt="Lyonpay Dashboard" className="w-full rounded-[1.8rem] shadow-2xl grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="py-32 px-6 bg-[#09090B] relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 rounded-[3rem] bg-[#15151A]/50 border border-white/5 hover:border-[#a3ff12]/30 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <LayoutDashboard size={32} className="text-[#a3ff12]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Dashboard de Precisão</h3>
              <p className="text-zinc-500 leading-relaxed">Visualize seu fluxo de caixa mensal, saldos e projeções com gráficos intuitivos e modernos.</p>
            </div>
            
            <div className="p-10 rounded-[3rem] bg-[#15151A]/50 border border-white/5 hover:border-[#FFD700]/30 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Zap size={32} className="text-[#FFD700]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Automação de Fixas</h3>
              <p className="text-zinc-500 leading-relaxed">Gere todas as suas contas recorrentes do mês com um único clique. Inteligência que economiza seu tempo.</p>
            </div>

            <div className="p-10 rounded-[3rem] bg-[#15151A]/50 border border-white/5 hover:border-white/20 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <CreditCard size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Gestão de Parcelados</h3>
              <p className="text-zinc-500 leading-relaxed">Acompanhe compras parceladas em todos os meses futuros. Saiba exatamente quanto seu limite está comprometido.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-24 border-y border-white/5 bg-[#15151A]/20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          <div>
            <p className="text-4xl font-extrabold text-white mb-2">10k+</p>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">Usuários Ativos</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-[#a3ff12] mb-2">R$ 5M+</p>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">Gerenciados</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-white mb-2">99.9%</p>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">Segurança</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-[#FFD700] mb-2">24/7</p>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">Suporte Premium</p>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setIsAuthModalOpen(null); setSuccessMessage(''); setError(''); }} />
          <div className="bg-[#15151A] border border-white/10 rounded-[3rem] w-full max-w-md p-12 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            {successMessage ? (
              <div className="text-center py-6 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-[#a3ff12]/10 text-[#a3ff12] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail size={40} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Check seu E-mail</h2>
                <p className="text-zinc-400 leading-relaxed mb-8">{successMessage}</p>
                <button onClick={() => setIsAuthModalOpen('login')} className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">Ir para Login</button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-white mb-2">{isAuthModalOpen === 'login' ? 'Bem-vindo' : 'Crie sua conta'}</h2>
                <p className="text-zinc-500 mb-8">{isAuthModalOpen === 'login' ? 'Gerencie suas finanças com inteligência.' : 'Comece seu teste grátis de 7 dias hoje.'}</p>
                
                {error && <div className="mb-6 p-4 rounded-xl bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 text-[#FF4D4D] text-sm font-medium">{error}</div>}

                <form onSubmit={handleAuth} className="space-y-4">
                  {isAuthModalOpen === 'register' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">Nome Completo</label>
                      <input required type="text" placeholder="Seu nome" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">E-mail</label>
                    <input required type="email" placeholder="nome@email.com" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-2">Senha</label>
                    <input required type="password" placeholder="••••••••" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 mt-6 bg-[#a3ff12] text-black font-extrabold rounded-2xl transition-all shadow-[0_0_30px_rgba(163,255,18,0.2)] flex justify-center items-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95">
                    {loading ? <Loader2 className="animate-spin" size={24} /> : (isAuthModalOpen === 'login' ? 'Entrar Agora' : 'Criar Conta Grátis')}
                  </button>
                </form>
                <button onClick={() => setIsAuthModalOpen(isAuthModalOpen === 'login' ? 'register' : 'login')} className="w-full mt-8 text-sm text-zinc-500 hover:text-white transition-colors">
                  {isAuthModalOpen === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre aqui'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD700] to-[#FF8C00] flex items-center justify-center font-bold text-black text-sm">L</div>
            <span className="font-bold text-xl text-white">Lyonpay</span>
          </div>
          <p className="text-zinc-500 text-sm">© 2026 Lyonpay. Todos os direitos reservados. Feito para quem domina o futuro.</p>
        </div>
      </footer>
    </div>
  );
}
