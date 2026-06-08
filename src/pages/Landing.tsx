import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Loader2, Mail, LayoutDashboard, CreditCard, Check, Star, Shield, TrendingUp, Clock, BarChart3, Users, Smartphone, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function Landing() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<'login' | 'register' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleResend = async () => {
    if (!formData.email) {
      setError('Por favor, informe seu e-mail para o reenvio.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar');
      setSuccessMessage('Novo código enviado! Verifique sua caixa de entrada.');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const features = [
    { icon: <LayoutDashboard className="w-6 h-6" />, title: 'Dashboard Inteligente', desc: 'Veja seu saldo, saúde financeira e próximos vencimentos num único painel visual e intuitivo.', color: '#a3ff12' },
    { icon: <Zap className="w-6 h-6" />, title: 'Automação de Fixas', desc: 'Gere todas as suas contas recorrentes do mês com um único clique. Zero retrabalho.', color: '#FFD700' },
    { icon: <CreditCard className="w-6 h-6" />, title: 'Controle de Parcelados', desc: 'Acompanhe cada parcela em todos os meses futuros. Saiba exatamente seu comprometimento real.', color: '#00D1FF' },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Análise por Categoria', desc: 'Descubra onde você gasta mais com gráficos e rankings automáticos de despesas.', color: '#FF7A00' },
    { icon: <Clock className="w-6 h-6" />, title: 'Alertas de Vencimento', desc: 'Nunca mais pague juros. O sistema avisa com antecedência e destaca o que está atrasado.', color: '#FF4D4D' },
    { icon: <Shield className="w-6 h-6" />, title: 'Dados 100% Seguros', desc: 'Criptografia de ponta a ponta. Seus dados financeiros protegidos e nunca compartilhados.', color: '#a3ff12' },
  ];

  const testimonials = [
    { name: 'Marina S.', role: 'Empreendedora', text: 'Em 2 semanas já identifiquei R$ 800 em gastos desnecessários que eu nem sabia que tinha.', rating: 5 },
    { name: 'Carlos M.', role: 'Servidor Público', text: 'Nunca mais esqueci uma conta. O alerta de vencimento mudou completamente minha relação com dinheiro.', rating: 5 },
    { name: 'Fernanda L.', role: 'Freelancer', text: 'A automação das fixas economiza meu tempo todo mês. Simplesmente indispensável.', rating: 5 },
  ];

  return (
    <div className="min-h-screen bg-[#09090B] font-sans selection:bg-[#a3ff12] selection:text-black">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090B]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center">
            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-lg" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#precos" className="hover:text-white transition-colors">Preços</a>
            <a href="#depoimentos" className="hover:text-white transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm font-bold bg-[#a3ff12] text-black px-5 py-2 rounded-full hover:bg-[#a3ff12]/90 transition-all">Ir para o App</button>
            ) : (
              <>
                <button onClick={() => setIsAuthModalOpen('login')} className="text-sm font-bold text-zinc-400 hover:text-white transition-colors hidden md:block">Entrar</button>
                <button onClick={() => setIsAuthModalOpen('register')} className="text-sm font-bold bg-[#a3ff12] text-black px-5 py-2 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(163,255,18,0.3)]">
                  Começar grátis
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#a3ff12]/8 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-20 left-10 w-[300px] h-[300px] bg-[#FFD700]/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6 leading-[1.08] animate-in fade-in slide-in-from-bottom-6 duration-700">
            Pare de perder dinheiro<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a3ff12] to-[#FFD700]"> sem saber por quê.</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700">
            O Lyonpay organiza suas finanças automaticamente. Controle despesas, receitas, parcelados e vencimentos — tudo em um lugar só.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <button
              onClick={() => setIsAuthModalOpen('register')}
              className="px-10 py-5 bg-[#a3ff12] text-black font-extrabold rounded-full hover:scale-105 transition-all flex items-center justify-center gap-2 text-lg shadow-[0_0_50px_rgba(163,255,18,0.35)]"
            >
              Começar de graça <ArrowRight size={20} />
            </button>
            <button
              onClick={() => setIsAuthModalOpen('login')}
              className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-all text-lg"
            >
              Já tenho conta
            </button>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm text-zinc-500 animate-in fade-in duration-1000">
            <div className="flex items-center gap-1.5"><Check size={14} className="text-[#a3ff12]" /> Gratuito para começar</div>
            <div className="flex items-center gap-1.5"><Check size={14} className="text-[#a3ff12]" /> Sem cartão de crédito</div>
            <div className="flex items-center gap-1.5"><Check size={14} className="text-[#a3ff12]" /> Cancele quando quiser</div>
          </div>
        </div>
      </section>

      {/* Prova Social - Números */}
      <section className="py-16 border-y border-white/5 bg-[#15151A]/30">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '2.400+', label: 'Usuários Ativos', color: 'text-white' },
            { value: 'R$ 18M+', label: 'Gerenciados', color: 'text-[#a3ff12]' },
            { value: '4.9 ★', label: 'Avaliação Média', color: 'text-[#FFD700]' },
            { value: '97%', label: 'Satisfação', color: 'text-white' },
          ].map((s, i) => (
            <div key={i}>
              <p className={`text-3xl md:text-4xl font-extrabold mb-2 ${s.color}`}>{s.value}</p>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#a3ff12] text-xs font-black uppercase tracking-widest mb-3">Simples assim</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-4">3 passos para o controle total</h2>
            <p className="text-zinc-500 text-lg">Sem planilhas, sem complicação. Comece em menos de 2 minutos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastre-se gratuitamente com seu e-mail. Nenhuma informação de cartão necessária.', icon: <Users className="w-6 h-6" /> },
              { step: '02', title: 'Adicione seus lançamentos', desc: 'Registre despesas, receitas e use a automação para gerar contas fixas recorrentes com 1 clique.', icon: <Zap className="w-6 h-6" /> },
              { step: '03', title: 'Acompanhe seu progresso', desc: 'Veja seu saldo, saúde financeira e receba alertas antes de vencimentos chegarem.', icon: <TrendingUp className="w-6 h-6" /> },
            ].map((s, i) => (
              <div key={i} className="relative p-8 rounded-[2.5rem] bg-[#15151A] border border-white/5 hover:border-[#a3ff12]/20 transition-all group">
                <div className="absolute top-6 right-6 text-5xl font-extrabold text-white/[0.04] select-none">{s.step}</div>
                <div className="w-12 h-12 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center text-[#a3ff12] mb-6 group-hover:scale-110 transition-transform">
                  {s.icon}
                </div>
                <h3 className="text-xl font-black text-white mb-3">{s.title}</h3>
                <p className="text-zinc-500 leading-relaxed text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="py-20 px-6 bg-[#15151A]/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#a3ff12] text-xs font-black uppercase tracking-widest mb-3">Tudo que você precisa</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tighter">Recursos que fazem a diferença</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-[2rem] bg-[#09090B]/60 border border-white/5 hover:border-white/15 transition-all group">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-black text-white mb-3">{f.title}</h3>
                <p className="text-zinc-500 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#FFD700] text-xs font-black uppercase tracking-widest mb-3">Quem usa, aprova</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tighter">O que nossos usuários dizem</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-8 rounded-[2rem] bg-[#15151A] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-[#FFD700] text-[#FFD700]" />)}
                </div>
                <p className="text-zinc-300 leading-relaxed text-sm mb-6 italic">"{t.text}"</p>
                <div>
                  <p className="text-white font-black text-sm">{t.name}</p>
                  <p className="text-zinc-500 text-xs uppercase tracking-widest">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-20 px-6 bg-[#15151A]/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#a3ff12] text-xs font-black uppercase tracking-widest mb-3">Preço justo</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-4">Um plano. Tudo incluso.</h2>
            <p className="text-zinc-500 text-lg">Sem surpresas, sem limitações absurdas.</p>
          </div>
          <div className="max-w-md mx-auto p-10 rounded-[3rem] bg-gradient-to-br from-[#1C1C21] to-[#0D0D12] border border-[#a3ff12]/20 shadow-[0_0_60px_rgba(163,255,18,0.1)]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#a3ff12]/10 border border-[#a3ff12]/20 text-[#a3ff12] text-[10px] font-black uppercase tracking-widest mb-6">
              <Zap size={10} /> Mais popular
            </div>
            <p className="text-zinc-500 font-black text-xs uppercase tracking-widest mb-2">Plano Pro</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-extrabold text-white">R$ 17</span>
              <span className="text-zinc-500 text-sm mb-1">/mês</span>
            </div>
            <div className="space-y-3 mb-8">
              {[
                'Dashboard completo', 'Despesas e receitas ilimitadas', 'Automação de contas fixas',
                'Controle de parcelados', 'Alertas de vencimento', 'Suporte prioritário'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#a3ff12]/10 flex items-center justify-center shrink-0">
                    <Check size={10} className="text-[#a3ff12]" />
                  </div>
                  <span className="text-zinc-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsAuthModalOpen('register')}
              className="w-full py-5 bg-[#a3ff12] text-black font-extrabold rounded-2xl hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(163,255,18,0.25)] text-lg flex items-center justify-center gap-2"
            >
              Começar grátis por 7 dias <ArrowRight size={18} />
            </button>
            <p className="text-center text-zinc-600 text-xs mt-4">Cancele quando quiser. Sem fidelidade.</p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] bg-[#a3ff12]/8 blur-[100px] rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tighter mb-6">
            Pronto para assumir o<br /><span className="text-[#a3ff12]">controle do seu dinheiro?</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-10">Junte-se a milhares de pessoas que já transformaram suas finanças com o Lyonpay.</p>
          <button
            onClick={() => setIsAuthModalOpen('register')}
            className="px-14 py-6 bg-[#a3ff12] text-black font-extrabold rounded-full hover:scale-105 transition-all text-xl shadow-[0_0_60px_rgba(163,255,18,0.4)] inline-flex items-center gap-3"
          >
            Criar conta grátis <ArrowRight size={24} />
          </button>
          <div className="flex items-center justify-center gap-6 mt-8 text-zinc-500 text-sm">
            <div className="flex items-center gap-2"><Lock size={14} /><span>Dados seguros</span></div>
            <div className="flex items-center gap-2"><Smartphone size={14} /><span>Funciona no celular</span></div>
            <div className="flex items-center gap-2"><Shield size={14} /><span>Sem compartilhamento</span></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <p className="text-zinc-600 text-sm">© 2026 Lyonpay. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-zinc-600 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Termos</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => { setIsAuthModalOpen(null); setSuccessMessage(''); setError(''); }} />
          <div className="bg-[#15151A] border border-white/10 rounded-[3rem] w-full max-w-md p-10 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            {successMessage ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#a3ff12]/10 text-[#a3ff12] rounded-full flex items-center justify-center mx-auto mb-6"><Mail size={32} /></div>
                <h2 className="text-2xl font-bold text-white mb-3">Verifique seu e-mail</h2>
                <p className="text-zinc-400 text-sm leading-relaxed mb-8">{successMessage}</p>
                <button 
                  onClick={() => {
                    setSuccessMessage('');
                    setIsAuthModalOpen('login');
                  }} 
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  Ir para Login
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-white mb-1">{isAuthModalOpen === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
                <p className="text-zinc-500 mb-8 text-sm">{isAuthModalOpen === 'login' ? 'Continue de onde parou.' : '7 dias grátis, sem cartão.'}</p>
                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 text-[#FF4D4D] text-sm flex flex-col gap-3">
                    <p>{error}</p>
                    {error.includes('Confirme seu e-mail') && (
                      <button 
                        type="button"
                        onClick={handleResend}
                        className="text-xs font-black uppercase tracking-widest bg-[#FF4D4D]/20 py-2 rounded-lg hover:bg-[#FF4D4D]/30 transition-all"
                      >
                        Reenviar E-mail de Confirmação
                      </button>
                    )}
                  </div>
                )}
                <form onSubmit={handleAuth} className="space-y-4">
                  {isAuthModalOpen === 'register' && (
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Nome Completo</label>
                      <input required type="text" placeholder="Seu nome" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">E-mail</label>
                    <input required type="email" placeholder="seu@email.com" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Senha</label>
                    <input required type="password" placeholder="••••••••" className="w-full bg-[#09090B] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#a3ff12] outline-none transition-all" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 mt-4 bg-[#a3ff12] text-black font-extrabold rounded-2xl flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={22} /> : (isAuthModalOpen === 'login' ? 'Entrar Agora' : 'Criar Conta Grátis')}
                  </button>
                </form>
                <button onClick={() => setIsAuthModalOpen(isAuthModalOpen === 'login' ? 'register' : 'login')} className="w-full mt-6 text-sm text-zinc-500 hover:text-white transition-colors">
                  {isAuthModalOpen === 'login' ? 'Não tem conta? Cadastre-se grátis' : 'Já tem conta? Entrar'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
