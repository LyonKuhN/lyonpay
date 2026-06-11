import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowRight, Zap, Loader2, Mail, LayoutDashboard, CreditCard, Check, Star, Shield, TrendingUp, Clock, BarChart3, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { ContainerScroll } from '../components/ui/container-scroll-animation';
import { GooeyText } from '../components/ui/gooey-text-morphing';
import { EtherealShadow } from '../components/ui/ethereal-shadow';
import { AnimatedBackground } from '../components/ui/animated-background';
import { NeuralVortexBackground } from '../components/ui/neural-vortex';
import { SkewCard } from '../components/ui/skew-card';
import { IPhoneMockup } from '../components/ui/iphone-mockup';

export default function Landing() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<'login' | 'register' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const hasGoogleAuth = import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';

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

  const googleLogin = hasGoogleAuth ? useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: codeResponse.access_token })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao autenticar com Google');
        login(data.token, data.user);
        setIsAuthModalOpen(null);
        navigate('/dashboard');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError('Erro ao autenticar com Google. Tente novamente.');
    },
    flow: 'implicit'
  }) : (() => {});

  const features = [
    { icon: <LayoutDashboard className="w-6 h-6" />, title: 'Dashboard Inteligente', desc: 'Veja seu saldo, saúde financeira e próximos vencimentos num único painel visual e intuitivo.' },
    { icon: <Zap className="w-6 h-6" />, title: 'Automação de Fixas', desc: 'Gere todas as suas contas recorrentes do mês com um único clique. Zero retrabalho.' },
    { icon: <CreditCard className="w-6 h-6" />, title: 'Controle de Parcelados', desc: 'Acompanhe cada parcela em todos os meses futuros. Saiba exatamente seu comprometimento real.' },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Análise por Categoria', desc: 'Descubra onde você gasta mais com gráficos e rankings automáticos de despesas.' },
    { icon: <Clock className="w-6 h-6" />, title: 'Alertas de Vencimento', desc: 'Nunca mais pague juros. O sistema avisa com antecedência e destaca o que está atrasado.' },
    { icon: <Shield className="w-6 h-6" />, title: 'Dados 100% Seguros', desc: 'Criptografia de ponta a ponta. Seus dados financeiros protegidos e nunca compartilhados.' },
  ];

  const testimonials = [
    { name: 'Marina S.', role: 'Empreendedora', text: 'Em 2 semanas já identifiquei R$ 800 em gastos desnecessários que eu nem sabia que tinha.', rating: 5 },
    { name: 'Carlos M.', role: 'Servidor Público', text: 'Nunca mais esqueci uma conta. O alerta de vencimento mudou completamente minha relação com dinheiro.', rating: 5 },
    { name: 'Fernanda L.', role: 'Freelancer', text: 'A automação das fixas economiza meu tempo todo mês. Simplesmente indispensável.', rating: 5 },
  ];

  return (
    <div className="min-h-screen bg-transparent text-[#FCFCFC] relative font-sans">
      <NeuralVortexBackground />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#333333] bg-[#0A0A0A]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between py-4">
          <div className="flex items-center">
            <span className="text-xl font-bold text-[#D7FF67]">LyonPay</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#888888]">
            <a href="#recursos" className="hover:text-[#FCFCFC] transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-[#FCFCFC] transition-colors">Como Funciona</a>
            <a href="#precos" className="hover:text-[#FCFCFC] transition-colors">Preços</a>
            <a href="#depoimentos" className="hover:text-[#FCFCFC] transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm font-bold bg-[#D7FF67] text-[#0A0A0A] px-5 py-2 rounded-full hover:opacity-90 transition-all">Ir para o App</button>
            ) : (
              <>
                <button onClick={() => setIsAuthModalOpen('login')} className="text-sm font-bold text-[#888888] hover:text-[#FCFCFC] transition-colors hidden md:block">Entrar</button>
                <button onClick={() => setIsAuthModalOpen('register')} className="text-sm font-bold bg-[#D7FF67] text-[#0A0A0A] px-5 py-2 rounded-full hover:opacity-90 transition-all">
                  Começar grátis
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative pt-24 md:pt-32 pb-4 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 pl-6 pr-0 md:px-6 mt-4 md:mt-16 flex flex-row items-center justify-between">
          
          {/* Text Content */}
          <div className="w-[60%] md:flex-1 z-20 pb-10 md:pb-0 text-left">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#FCFCFC] mb-6 leading-[1.1] [text-shadow:_0_0_30px_rgba(0,0,0,1),_0_0_60px_rgba(0,0,0,0.9),_0_0_90px_rgba(0,0,0,0.8)] md:[text-shadow:none]">
              Gestão financeira inteligente feita simples.
            </h1>
            <p className="text-lg text-[#FCFCFC] md:text-[#FCFCFCB3] mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed [text-shadow:_0_0_20px_rgba(0,0,0,1),_0_0_40px_rgba(0,0,0,0.9)] md:[text-shadow:none] font-bold md:font-normal">
              Controle suas finanças pessoais com automação, alertas e análises em tempo real. Tenha clareza total sobre seu dinheiro.
            </p>
            <div className="flex flex-col items-start gap-3 mb-12 lg:mb-0">
              <button
                onClick={() => setIsAuthModalOpen('register')}
                className="px-8 py-3 bg-[#D7FF67] text-[#0A0A0A] font-bold rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                Começar grátis <ArrowRight size={18} />
              </button>
              <p className="text-xs text-[#888888] font-medium">
                Teste grátis por 7 dias. Sem cartão de crédito.
              </p>
            </div>
          </div>
          
          {/* Mockup */}
          <div className="w-[50%] md:flex-1 flex justify-end perspective-[2000px] relative -mr-12 md:mr-0 z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] md:w-[400px] h-[350px] md:h-[500px] bg-[#D7FF67]/10 blur-[80px] md:blur-[100px] rounded-full pointer-events-none z-0" />
            
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="hidden sm:flex absolute left-0 lg:left-10 top-1/4 bg-[#161616] border border-[#333333] p-3 md:p-4 rounded-xl shadow-2xl items-center gap-3 md:gap-4 z-20"
            >
               <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#D7FF67]/20 flex items-center justify-center text-[#D7FF67]">
                 <TrendingUp size={16} className="md:w-5 md:h-5" />
               </div>
               <div>
                 <p className="text-[#888888] text-[8px] md:text-[10px] font-bold uppercase tracking-widest">Receita</p>
                 <p className="text-[#FCFCFC] font-bold text-sm md:text-base">+R$ 1.250</p>
               </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
              className="hidden sm:flex absolute right-0 lg:-right-4 bottom-1/4 bg-[#161616] border border-[#333333] p-3 md:p-4 rounded-xl shadow-2xl items-center gap-3 md:gap-4 z-20"
            >
               <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center text-[#FCFCFC] border border-[#333333]">
                 <Clock size={16} className="md:w-5 md:h-5 text-[#FFD700]" />
               </div>
               <div>
                 <p className="text-[#888888] text-[8px] md:text-[10px] font-bold uppercase tracking-widest">Vencimentos</p>
                 <p className="text-[#FCFCFC] font-bold text-sm md:text-base">0 Atrasos</p>
               </div>
            </motion.div>

            <div 
              className="transform transition-all duration-700 hover:scale-105"
              style={{
                transform: 'rotateY(-25deg) rotateX(15deg) rotateZ(-5deg) translateY(1rem) translateX(-1rem)',
                transformStyle: 'preserve-3d'
              }}
            >
              <IPhoneMockup 
                model="15-pro" 
                color="space-black" 
                wallpaper="/cel1.png" 
                wallpaperFit="contain"
                scale={0.85} 
              />
            </div>
          </div>
        </div>
      </main>

      {/* Gooey Text - Principais Funcionalidades */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-16 md:py-20 px-6 relative"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Potência da plataforma</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#FCFCFC] tracking-tight mb-4">
              Recursos que transformam seu controle financeiro
            </h2>
          </div>
          
          <GooeyText
            texts={["Domine seu Dinheiro", "Zere os Atrasos", "Aumente o Lucro", "Ganhe Tempo", "Paz Financeira"]}
            morphTime={1.5}
            cooldownTime={0.3}
            className="relative w-full h-[200px] flex items-center justify-center"
            textClassName="font-bold"
          />
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-12 md:py-16 border-y border-[#333333] bg-[#161616]/30 backdrop-blur-sm relative z-10"
      >
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '2.400+', label: 'Usuários Ativos' },
            { value: 'R$ 18M+', label: 'Gerenciados' },
            { value: '4.9 ★', label: 'Avaliação' },
            { value: '97%', label: 'Satisfação' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-3xl md:text-4xl font-bold text-[#D7FF67] mb-2">{s.value}</p>
              <p className="text-[#888888] text-xs font-bold uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Como Funciona */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        id="como-funciona" 
        className="py-16 md:py-24 px-6"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Começar é fácil</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight mb-4">Apenas 3 passos para tomar controle</h2>
            <p className="text-[#888888] text-lg">Configure sua conta em menos de 2 minutos e comece a economizar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Registre-se com seu e-mail. Sem necessidade de dados de cartão para começar.', icon: <Users className="w-6 h-6" />, gradientFrom: '#D7FF67', gradientTo: '#06b6d4' },
              { step: '02', title: 'Registre seus lançamentos', desc: 'Adicione despesas, receitas ou use a automação para gerar contas fixas em um clique.', icon: <Zap className="w-6 h-6" />, gradientFrom: '#06b6d4', gradientTo: '#f97316' },
              { step: '03', title: 'Acompanhe seus resultados', desc: 'Visualize seu saldo, saúde financeira em tempo real e receba alertas de vencimentos.', icon: <TrendingUp className="w-6 h-6" />, gradientFrom: '#f97316', gradientTo: '#D7FF67' },
            ].map((s, i) => (
              <SkewCard
                key={i}
                step={s.step}
                title={s.title}
                desc={s.desc}
                icon={s.icon}
                gradientFrom={s.gradientFrom}
                gradientTo={s.gradientTo}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Grid */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        id="recursos" 
        className="py-16 md:py-24 px-6 bg-[#161616]/30 backdrop-blur-sm relative z-10"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Funcionalidades poderosas</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight">Tudo que você precisa para prosperar</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-[16px] bg-[#161616] border border-[#333333] hover:border-[#D7FF67]/20 transition-all">
                <div className="w-12 h-12 rounded-[12px] bg-[#D7FF67]/15 flex items-center justify-center text-[#D7FF67] mb-6">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-[#FCFCFC] mb-3">{f.title}</h3>
                <p className="text-[#888888] leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Dashboard Preview - Container Scroll */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-12 px-6 bg-transparent relative z-10"
      >
        <ContainerScroll
          titleComponent={
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight mb-4">
                Visualize seu controle financeiro
              </h2>
              <p className="text-[#888888] text-lg max-w-2xl mx-auto">
                Dashboard elegante e responsivo que centraliza todas suas finanças em um só lugar
              </p>
            </div>
          }
        >
          <div className="relative w-full h-full flex justify-center items-center">
            <div className="absolute inset-0 bg-[#D7FF67]/5 blur-[80px] md:blur-[120px] rounded-full pointer-events-none z-0" />
            <img 
              src="/pc.png" 
              alt="Dashboard Preview" 
              className="w-full h-full object-cover rounded-2xl relative z-10" 
            />
            
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="hidden md:flex absolute -left-8 top-1/4 bg-[#161616] border border-[#333333] p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
            >
               <div className="w-10 h-10 rounded-full bg-[#D7FF67]/20 flex items-center justify-center text-[#D7FF67]">
                 <TrendingUp size={20} />
               </div>
               <div>
                 <p className="text-[#888888] text-[10px] font-bold uppercase tracking-widest">Recebimento via PIX</p>
                 <p className="text-[#FCFCFC] font-bold text-base">+R$ 2.450,00</p>
               </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 15, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
              className="hidden md:flex absolute -right-8 bottom-1/4 bg-[#161616] border border-[#333333] p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
            >
               <div className="w-10 h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center text-[#FCFCFC]">
                 <Shield size={20} />
               </div>
               <div>
                 <p className="text-[#888888] text-[10px] font-bold uppercase tracking-widest">Vencimentos</p>
                 <p className="text-[#FCFCFC] font-bold text-base">0 Atrasos</p>
               </div>
            </motion.div>
          </div>
        </ContainerScroll>
      </motion.section>

      {/* Pricing */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        id="precos" 
        className="py-16 md:py-24 px-6"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Investimento baixo</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight mb-4">Plano simples e acessível.</h2>
            <p className="text-[#888888] text-lg">Uma só versão, totalmente funcional. Experimente grátis por 7 dias.</p>
          </div>
          <div className="max-w-md mx-auto p-10 rounded-[16px] bg-[#161616] border border-[#D7FF67]/20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D7FF67]/15 border border-[#D7FF67]/30 text-[#D7FF67] text-[10px] font-bold uppercase tracking-widest mb-6">
              <Zap size={10} /> Mais popular
            </div>
            <p className="text-[#888888] font-bold text-xs uppercase tracking-widest mb-2">Plano Pro</p>
            <div className="flex items-end gap-2 mb-8">
              <span className="text-5xl font-bold text-[#FCFCFC]">R$ 17</span>
              <span className="text-[#888888] text-sm mb-1">/mês</span>
            </div>
            <div className="space-y-3 mb-8">
              {[
                'Dashboard completo', 'Despesas e receitas ilimitadas', 'Automação de contas fixas',
                'Controle de parcelados', 'Alertas de vencimento', 'Suporte prioritário'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#D7FF67]/15 flex items-center justify-center shrink-0">
                    <Check size={10} className="text-[#D7FF67]" />
                  </div>
                  <span className="text-[#FCFCFC] text-sm">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsAuthModalOpen('register')}
              className="w-full py-3 bg-[#D7FF67] text-[#0A0A0A] font-bold rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              Começar grátis por 7 dias <ArrowRight size={18} />
            </button>
            <p className="text-center text-[#888888] text-xs mt-4">Cancele quando quiser. Sem fidelidade.</p>
          </div>
        </div>
      </motion.section>

      {/* Testimonials */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        id="depoimentos" 
        className="py-16 md:py-24 px-6 bg-[#161616]/30 backdrop-blur-sm relative z-10"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Histórias de sucesso</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight">Veja o impacto real na vida das pessoas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-8 rounded-[16px] bg-[#161616] border border-[#333333] hover:border-[#D7FF67]/20 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-[#D7FF67] text-[#D7FF67]" />)}
                </div>
                <p className="text-[#FCFCFCB3] leading-relaxed text-sm mb-6 italic">"{t.text}"</p>
                <div>
                  <p className="text-[#FCFCFC] font-bold text-sm">{t.name}</p>
                  <p className="text-[#888888] text-xs uppercase tracking-widest">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Ethereal Shadow - Security Section */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-16 md:py-24 px-6 bg-transparent relative z-10"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#D7FF67] text-xs font-bold uppercase tracking-widest mb-3">Confiança total</p>
            <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight mb-4">Segurança em primeiro lugar</h2>
          </div>
          
          <div className="h-[300px] md:h-[400px] rounded-[20px] overflow-hidden bg-[#D7FF67] flex flex-col items-center justify-center gap-4">
            <Shield className="w-16 h-16 text-[#0A0A0A]" />
            <div className="text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-[#0A0A0A] mb-2">Criptografia de Ponta a Ponta</h3>
              <p className="text-[#0A0A0A]/80 text-sm">Seus dados financeiros protegidos com os padrões mais altos de segurança</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="py-16 md:py-24 px-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] bg-[#D7FF67]/5 blur-[100px] rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-[#FCFCFC] tracking-tight mb-6">
            Pronto para assumir o<br />
            <span className="text-[#D7FF67]">controle do seu dinheiro?</span>
          </h2>
          <p className="text-[#888888] text-lg mb-10">Junte-se a milhares de pessoas que já transformaram suas finanças com o LyonPay.</p>
          <button
            onClick={() => setIsAuthModalOpen('register')}
            className="px-8 py-3 bg-[#D7FF67] text-[#0A0A0A] font-bold rounded-full hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            Criar conta grátis <ArrowRight size={20} />
          </button>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#333333] bg-[#0A0A0A]/80 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#D7FF67]">LyonPay</span>
          </div>
          <p className="text-[#888888] text-sm">© 2026 LyonPay. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-[#888888] text-sm">
            <a href="#" className="hover:text-[#FCFCFC] transition-colors">Privacidade</a>
            <a href="#" className="hover:text-[#FCFCFC] transition-colors">Termos</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0A0A0A]/95 backdrop-blur-md" onClick={() => { setIsAuthModalOpen(null); setSuccessMessage(''); setError(''); }} />
          <div className="bg-[#161616] border border-[#333333] rounded-[16px] w-full max-w-md p-10 relative z-10 shadow-2xl">
            {successMessage ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#D7FF67]/15 text-[#D7FF67] rounded-[12px] flex items-center justify-center mx-auto mb-6"><Mail size={32} /></div>
                <h2 className="text-2xl font-bold text-[#FCFCFC] mb-3">Verifique seu e-mail</h2>
                <p className="text-[#888888] text-sm leading-relaxed mb-8">{successMessage}</p>
                <button 
                  onClick={() => {
                    setSuccessMessage('');
                    setIsAuthModalOpen('login');
                  }} 
                  className="w-full py-3 bg-transparent border border-[#D7FF67] text-[#FCFCFC] font-bold rounded-full hover:bg-[#D7FF67]/5 transition-all"
                >
                  Ir para Login
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-[#FCFCFC] mb-1">{isAuthModalOpen === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
                <p className="text-[#888888] mb-8 text-sm">{isAuthModalOpen === 'login' ? 'Continue de onde parou.' : '7 dias grátis, sem cartão.'}</p>
                {error && (
                  <div className="mb-6 p-4 rounded-[12px] bg-[#FF4B4B]/15 border border-[#FF4B4B]/30 text-[#FF6B6B] text-sm flex flex-col gap-3">
                    <p>{error}</p>
                    {error.includes('Confirme seu e-mail') && (
                      <button 
                        type="button"
                        onClick={handleResend}
                        className="text-xs font-bold uppercase tracking-widest bg-[#FF4B4B]/20 py-2 rounded-lg hover:bg-[#FF4B4B]/30 transition-all"
                      >
                        Reenviar E-mail de Confirmação
                      </button>
                    )}
                  </div>
                )}
                <form onSubmit={handleAuth} className="space-y-4">
                  {isAuthModalOpen === 'register' && (
                    <div>
                      <label className="text-[11px] font-bold text-[#888888] uppercase tracking-widest block mb-2 ml-1">Nome Completo</label>
                      <input required type="text" placeholder="Seu nome" className="w-full bg-[#0A0A0A] border border-[#333333] rounded-[12px] px-4 py-3 text-[#FCFCFC] focus:border-[#D7FF67] focus:ring-1 focus:ring-[#D7FF67]/20 outline-none transition-all placeholder:text-[#888888]" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-bold text-[#888888] uppercase tracking-widest block mb-2 ml-1">E-mail</label>
                    <input required type="email" placeholder="seu@email.com" className="w-full bg-[#0A0A0A] border border-[#333333] rounded-[12px] px-4 py-3 text-[#FCFCFC] focus:border-[#D7FF67] focus:ring-1 focus:ring-[#D7FF67]/20 outline-none transition-all placeholder:text-[#888888]" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#888888] uppercase tracking-widest block mb-2 ml-1">Senha</label>
                    <input required type="password" placeholder="••••••••" className="w-full bg-[#0A0A0A] border border-[#333333] rounded-[12px] px-4 py-3 text-[#FCFCFC] focus:border-[#D7FF67] focus:ring-1 focus:ring-[#D7FF67]/20 outline-none transition-all placeholder:text-[#888888]" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3 mt-6 bg-[#D7FF67] text-[#0A0A0A] font-bold rounded-full flex justify-center items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : (isAuthModalOpen === 'login' ? 'Entrar Agora' : 'Criar Conta Grátis')}
                  </button>
                </form>
                {hasGoogleAuth && (
                  <>
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-[#333333]" />
                      <span className="text-[#888888] text-xs font-bold uppercase">Ou continue com</span>
                      <div className="flex-1 h-px bg-[#333333]" />
                    </div>
                    <button
                      type="button"
                      onClick={() => googleLogin()}
                      disabled={loading}
                      className="w-full py-3 bg-[#161616] border border-[#333333] text-[#FCFCFC] font-bold rounded-full hover:bg-[#212121] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google
                    </button>
                  </>
                )}
                <button onClick={() => setIsAuthModalOpen(isAuthModalOpen === 'login' ? 'register' : 'login')} className="w-full mt-6 text-sm text-[#888888] hover:text-[#FCFCFC] transition-colors">
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
