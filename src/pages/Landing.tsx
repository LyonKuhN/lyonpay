import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowRight, Zap, Mail, LayoutDashboard, CreditCard, Check, Star, Shield, TrendingUp, Clock, BarChart3, Users, HelpCircle, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { GooeyText } from '../components/ui/gooey-text-morphing';
import { NeuralVortexBackground } from '../components/ui/neural-vortex';
import { SkewCard } from '../components/ui/skew-card';
import { IPhoneMockup } from '../components/ui/iphone-mockup';
import SEO from '../components/SEO';
import { Sheet } from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Field, Input, fieldClass } from '../components/ui/input';
import { cn } from '../lib/cn';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  // /?entrar=1 (ex.: depois de redefinir a senha) e o retorno de uma tela protegida já abrem o login
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<'login' | 'register' | 'forgot-password' | null>(
    () => (new URLSearchParams(window.location.search).get('entrar') || (location.state as { from?: string } | null)?.from ? 'login' : null),
  );
  const closeAuth = () => { setIsAuthModalOpen(null); setSuccessMessage(''); setError(''); };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  
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
        if (data.requires_2fa) {
          setRequires2FA(true);
          setCooldown(60);
          setResendCount(0);
          setSuccessMessage(`Código enviado para ${data.email}`);
          return;
        }
        login(data.token, data.user);
        const from = location.state?.from || '/dashboard';
        navigate(from);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: twoFactorCode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Código inválido');
      login(data.token, data.user);
      const from = location.state?.from || '/dashboard';
      navigate(from);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    if (resendCount >= 5) {
      setError('Limite máximo de reenvios atingido. Tente novamente mais tarde.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar código');
      
      const nextCount = resendCount + 1;
      setResendCount(nextCount);
      setCooldown((nextCount + 1) * 60);
      setSuccessMessage('Novo código enviado para ' + formData.email);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao solicitar recuperação de senha');
      setSuccessMessage(data.message || 'Se o e-mail existir, um link de recuperação foi enviado.');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0 && requires2FA) {
      timer = setInterval(() => {
        setCooldown(c => c - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown, requires2FA]);

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
        if (data.requires_2fa) {
          setFormData({ ...formData, email: data.email });
          setRequires2FA(true);
          setCooldown(60);
          setResendCount(0);
          setSuccessMessage(`Código enviado para ${data.email}`);
          return;
        }
        login(data.token, data.user);
        setIsAuthModalOpen(null);
        const from = location.state?.from || '/dashboard';
        navigate(from);
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

  const faqs = [
    {
      question: 'O que é o Lyonk e como ele funciona?',
      answer: 'O Lyonk é uma plataforma inteligente de controle financeiro pessoal projetada para automatizar sua gestão de receitas, despesas, parcelamentos e contas recorrentes sem complicações.'
    },
    {
      question: 'Preciso cadastrar cartão de crédito para testar grátis?',
      answer: 'Não! Você pode criar sua conta e experimentar o Lyonk gratuitamente por 7 dias sem precisar informar qualquer dado de cartão de crédito.'
    },
    {
      question: 'Como funciona a automação de despesas fixas?',
      answer: 'Ao cadastrar suas contas recorrentes (como aluguel, internet, contas de consumo), o Lyonk projeta automaticamente todos os lançamentos do novo mês com um único clique.'
    },
    {
      question: 'Meus dados financeiros estão seguros no Lyonk?',
      answer: 'Sim, a segurança é nossa prioridade máxima. Toda a plataforma opera sob protocolo seguro HTTPS, com dados criptografados de ponta a ponta e senhas em hashes de alta segurança. Seus dados nunca são comercializados.'
    },
    {
      question: 'Posso cancelar minha assinatura a qualquer momento?',
      answer: 'Com certeza. Não exigimos fidelidade nem contrato de permanência. Você pode cancelar sua assinatura diretamente pelas configurações da sua conta a qualquer momento.'
    }
  ];

  return (
    <div className="min-h-screen bg-transparent text-fg relative font-sans">
      <SEO 
        title="Lyonk | Controle Financeiro Pessoal e Gestão de Despesas"
        description="A melhor plataforma de controle financeiro pessoal. Automatize contas fixas, acompanhe parcelas, gráficos dinâmicos e alertas de vencimento sem complicação."
        canonicalUrl="https://lyonk.com.br/"
      />
      <NeuralVortexBackground />

      {/* Navbar Semântica */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-line-strong bg-bg/60 backdrop-blur-xl">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 py-4" aria-label="Navegação principal">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="Logo Lyonk - Plataforma de Controle Financeiro Pessoal" className="h-7 w-8 md:h-8 md:w-9 object-contain" />
            <span className="text-lg md:text-xl font-semibold tracking-tight text-fg">Lyonk</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            <a href="#recursos" className="hover:text-fg transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-fg transition-colors">Como Funciona</a>
            <a href="#precos" className="hover:text-fg transition-colors">Preços</a>
            <a href="#depoimentos" className="hover:text-fg transition-colors">Depoimentos</a>
            <a href="#faq" className="hover:text-fg transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm font-bold bg-brand text-on-brand px-5 py-2 rounded-full hover:opacity-90 transition-all">Ir para o App</button>
            ) : (
              <>
                <button onClick={() => setIsAuthModalOpen('login')} className="text-sm font-bold text-muted hover:text-fg transition-colors">Entrar</button>
                <button onClick={() => setIsAuthModalOpen('register')} className="text-sm font-semibold bg-brand text-on-brand px-4 sm:px-5 py-2 rounded-full hover:opacity-90 transition-all whitespace-nowrap">
                  Começar grátis
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="relative pt-24 md:pt-32 pb-4 overflow-hidden">
        {/* Hero */}
        <section className="max-w-7xl mx-auto relative z-10 px-6 mt-4 md:mt-16 flex flex-col md:flex-row items-start md:items-center justify-between md:gap-0">
          
          {/* Text Content */}
          <div className="w-full md:flex-1 z-20 pb-0 text-center md:text-left flex flex-col items-center md:items-start">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-fg mb-6 leading-[1.1] relative z-10 [text-shadow:_0_0_30px_rgba(0,0,0,1)] md:[text-shadow:none] max-w-2xl mx-auto md:mx-0">
              Simplifique, Organize e Cresça o Seu Dinheiro.
            </h1>
            <p className="text-sm md:text-lg text-fg/70 mb-10 max-w-2xl mx-auto md:mx-0 leading-relaxed [text-shadow:_0_0_20px_rgba(0,0,0,1)] md:[text-shadow:none] font-normal">
              Controle suas finanças pessoais com automação de contas fixas, alertas de vencimento e análises em tempo real. Tenha clareza total sobre suas receitas e despesas.
            </p>
            <div className="flex flex-col items-center md:items-start gap-3 mb-12 lg:mb-0 w-full md:w-auto">
              <button
                onClick={() => setIsAuthModalOpen('register')}
                className="px-8 py-4 md:py-3 bg-brand text-on-brand font-bold rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 w-full md:w-auto text-lg md:text-base shadow-[0_0_30px_rgba(212,175,95,0.3)] md:shadow-none"
              >
                Começar grátis <ArrowRight size={18} />
              </button>
              <p className="text-xs text-muted font-medium text-center md:text-left mt-2">
                Teste grátis por 7 dias. Sem cartão de crédito.
              </p>
            </div>
          </div>
          
          {/* Mockup */}
          <div className="hidden md:flex relative w-full flex-1 justify-end perspective-[2000px] z-0 opacity-100 pointer-events-auto overflow-visible">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[500px] bg-brand/10 blur-[100px] rounded-full pointer-events-none z-0" />
            
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="flex absolute left-10 top-1/4 bg-surface border border-line-strong p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
            >
               <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand">
                 <TrendingUp size={20} />
               </div>
               <div>
                 <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Receita</p>
                 <p className="text-fg font-bold text-base">+R$ 1.250</p>
               </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
              className="flex absolute -right-4 bottom-1/4 bg-surface border border-line-strong p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
            >
               <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center text-fg border border-line-strong">
                 <Clock size={20} className="text-brand" />
               </div>
               <div>
                 <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Vencimentos</p>
                 <p className="text-fg font-bold text-base">0 Atrasos</p>
               </div>
            </motion.div>

            <div 
              className="transform transition-all duration-700 hover:scale-105"
              style={{
                transform: 'rotateY(-25deg) rotateX(15deg) rotateZ(-5deg) translateY(1rem) translateX(-1rem)',
                transformStyle: 'preserve-3d'
              }}
            >
              <div className="scale-100 origin-center transition-transform">
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
        </section>

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
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Potência da plataforma</p>
              <h2 className="text-3xl md:text-4xl font-bold text-fg tracking-tight mb-4">
                Recursos que transformam seu controle financeiro
              </h2>
            </div>
            
            <div className="relative">
              {/* Mobile Mockup behind text transition */}
              <div className="absolute inset-y-0 right-[-20px] left-0 flex md:hidden items-center justify-end perspective-[2000px] z-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[350px] bg-brand/10 blur-[80px] rounded-full z-0" />
                <div 
                  className="transform transition-all duration-700"
                  style={{
                    transform: 'rotateY(-20deg) rotateX(15deg) rotateZ(-5deg)',
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="scale-[0.7] sm:scale-[0.8] origin-center">
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

              <GooeyText
                texts={["Domine seu Dinheiro", "Zere os Atrasos", "Aumente o Lucro", "Ganhe Tempo", "Paz Financeira"]}
                morphTime={1.5}
                cooldownTime={0.3}
                className="relative w-full h-[300px] flex items-center justify-center z-10"
                textClassName="font-bold"
              />
            </div>
          </div>
        </motion.section>

        {/* Stats Section */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="py-12 md:py-16 border-y border-line-strong bg-surface/30 backdrop-blur-sm relative z-10"
        >
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '2.400+', label: 'Usuários Ativos' },
              { value: 'R$ 18M+', label: 'Gerenciados' },
              { value: '4.9 ★', label: 'Avaliação' },
              { value: '97%', label: 'Satisfação' },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-3xl md:text-4xl font-bold text-brand mb-2">{s.value}</p>
                <p className="text-muted text-xs font-bold uppercase tracking-widest">{s.label}</p>
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
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Começar é fácil</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-4">Apenas 3 passos para tomar controle total</h2>
              <p className="text-muted text-lg">Configure sua conta em menos de 2 minutos e comece a economizar dinheiro.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Crie sua conta', desc: 'Registre-se com seu e-mail. Sem necessidade de dados de cartão para começar.', icon: <Users className="w-6 h-6" />, gradientFrom: '#e6cb8c', gradientTo: '#b8933f' },
                { step: '02', title: 'Registre seus lançamentos', desc: 'Adicione despesas, receitas ou use a automação para gerar contas fixas em um clique.', icon: <Zap className="w-6 h-6" />, gradientFrom: '#b8933f', gradientTo: '#7a5a1c' },
                { step: '03', title: 'Acompanhe seus resultados', desc: 'Visualize seu saldo, saúde financeira em tempo real e receba alertas de vencimentos.', icon: <TrendingUp className="w-6 h-6" />, gradientFrom: '#7a5a1c', gradientTo: '#e6cb8c' },
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
          className="py-16 md:py-24 px-6 bg-surface/30 backdrop-blur-sm relative z-10"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Funcionalidades poderosas</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight">Tudo que você precisa para a sua gestão financeira</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <article key={i} className="p-8 rounded-[16px] bg-surface border border-line-strong hover:border-brand/20 transition-all">
                  <div className="w-12 h-12 rounded-[12px] bg-brand/15 flex items-center justify-center text-brand mb-6">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-fg mb-3">{f.title}</h3>
                  <p className="text-muted leading-relaxed text-sm">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Dashboard Preview */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="py-16 md:py-24 px-6 bg-transparent relative z-10"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Visão Completa</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-4">
                Visualize seu controle financeiro de forma clara
              </h2>
              <p className="text-muted text-lg max-w-2xl mx-auto">
                Dashboard elegante e responsivo que centraliza todas suas finanças pessoais em um só lugar
              </p>
            </div>
            
            <div className="relative w-full rounded-[24px] border border-line-strong bg-surface/50 p-2 md:p-4 shadow-2xl">
              <div className="absolute inset-0 bg-brand/5 blur-[80px] md:blur-[120px] rounded-full pointer-events-none z-0" />
              <img 
                src="/pc.png" 
                alt="Interface do Dashboard de Controle Financeiro Lyonk em Computador" 
                className="w-full h-auto object-cover rounded-xl border border-line-strong relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]" 
              />
              
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="hidden md:flex absolute -left-8 md:-left-12 top-1/4 bg-surface border border-line-strong p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
              >
                 <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand">
                   <TrendingUp size={20} />
                 </div>
                 <div>
                   <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Recebimento via PIX</p>
                   <p className="text-fg font-bold text-base">+R$ 2.450,00</p>
                 </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 15, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                className="hidden md:flex absolute -right-8 md:-right-12 bottom-1/4 bg-surface border border-line-strong p-4 rounded-xl shadow-2xl items-center gap-4 z-20"
              >
                 <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center text-fg">
                   <Shield size={20} />
                 </div>
                 <div>
                   <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Vencimentos</p>
                   <p className="text-fg font-bold text-base">0 Atrasos</p>
                 </div>
              </motion.div>
            </div>
          </div>
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
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Investimento baixo</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-4">Plano simples e acessível</h2>
              <p className="text-muted text-lg">Uma só versão, totalmente funcional. Experimente grátis por 7 dias.</p>
            </div>
            <div className="max-w-md mx-auto p-10 rounded-[16px] bg-surface border border-brand/20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-bold uppercase tracking-widest mb-6">
                <Zap size={10} /> Mais popular
              </div>
              <h3 className="text-muted font-bold text-xs uppercase tracking-widest mb-2">Plano Pro</h3>
              <div className="flex items-end gap-2 mb-8">
                <span className="text-5xl font-bold text-fg">R$ 17</span>
                <span className="text-muted text-sm mb-1">/mês</span>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  'Dashboard completo', 'Despesas e receitas ilimitadas', 'Automação de contas fixas',
                  'Controle de parcelados', 'Alertas de vencimento', 'Suporte prioritário'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-brand" />
                    </div>
                    <span className="text-fg text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setIsAuthModalOpen('register')}
                className="w-full py-3 bg-brand text-on-brand font-bold rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Começar grátis por 7 dias <ArrowRight size={18} />
              </button>
              <p className="text-center text-muted text-xs mt-4">Cancele quando quiser. Sem fidelidade.</p>
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
          className="py-16 md:py-24 px-6 bg-surface/30 backdrop-blur-sm relative z-10"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Histórias de sucesso</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight">Veja o impacto real na vida das pessoas</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <article key={i} className="p-8 rounded-[16px] bg-surface border border-line-strong hover:border-brand/20 transition-all">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-brand text-brand" />)}
                  </div>
                  <p className="text-fg/70 leading-relaxed text-sm mb-6 italic">"{t.text}"</p>
                  <div>
                    <h3 className="text-fg font-bold text-sm">{t.name}</h3>
                    <p className="text-muted text-xs uppercase tracking-widest">{t.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Security Section */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="py-16 md:py-24 px-6 bg-transparent relative z-10"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">Confiança total</p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-4">Segurança financeira em primeiro lugar</h2>
            </div>
            
            <div className="h-[300px] md:h-[400px] rounded-[20px] overflow-hidden bg-brand flex flex-col items-center justify-center gap-4 p-6">
              <Shield className="w-16 h-16 text-on-brand" />
              <div className="text-center">
                <h3 className="text-2xl md:text-3xl font-bold text-on-brand mb-2">Criptografia de Ponta a Ponta</h3>
                <p className="text-on-brand/80 text-sm max-w-lg">Seus dados financeiros protegidos com os padrões mais altos de segurança e privacidade.</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section FAQ (Perguntas Frequentes) para SEO e Rich Snippets */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          id="faq"
          className="py-16 md:py-24 px-6 bg-surface/30 backdrop-blur-sm relative z-10"
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <HelpCircle size={14} /> Tira-dúvidas
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-4">
                Perguntas Frequentes (FAQ)
              </h2>
              <p className="text-muted text-lg">
                Tudo o que você precisa saber sobre o controle financeiro com o Lyonk.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div 
                    key={idx} 
                    className="border border-line-strong bg-surface rounded-2xl overflow-hidden transition-all duration-300"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base md:text-lg text-fg hover:text-brand transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown 
                        className={`w-5 h-5 text-brand transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-fg/70 leading-relaxed border-t border-line-strong/50 pt-4 animate-in fade-in duration-300">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="w-[600px] h-[400px] bg-brand/5 blur-[100px] rounded-full" />
          </div>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-fg tracking-tight mb-6">
              Pronto para assumir o<br />
              <span className="text-brand">controle do seu dinheiro?</span>
            </h2>
            <p className="text-muted text-lg mb-10">Junte-se a milhares de pessoas que já transformaram suas finanças com o Lyonk.</p>
            <button
              onClick={() => setIsAuthModalOpen('register')}
              className="px-8 py-3 bg-brand text-on-brand font-bold rounded-full hover:opacity-90 transition-all inline-flex items-center gap-2"
            >
              Criar conta grátis <ArrowRight size={20} />
            </button>
          </div>
        </motion.section>
      </main>

      {/* Footer Semântico */}
      <footer className="py-12 border-t border-line-strong bg-bg/80 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo Lyonk" className="h-6 w-7 object-contain" />
            <span className="font-semibold text-fg">Lyonk</span>
          </div>
          <p className="text-muted text-sm">© 2026 Lyonk. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-muted text-sm">
            <Link to="/politica-de-privacidade" className="hover:text-fg transition-colors">Privacidade & Termos</Link>
          </div>
        </div>
      </footer>

      {/* Login e cadastro: painel que sobe de baixo no celular */}
      <Sheet open={!!isAuthModalOpen} onClose={closeAuth} size="sm" bare>
        <div className="pt-2 sm:pt-5">
          <div className="mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-7 w-8 object-contain" />
              <span className="text-base font-semibold text-fg">Lyonk</span>
            </span>
            <button type="button" onClick={closeAuth} aria-label="Fechar" className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-fg">
              <X size={20} />
            </button>
          </div>

          {requires2FA ? (
            <form onSubmit={handleVerify2FA}>
              <h2 className="text-xl font-semibold text-fg">Digite o código</h2>
              <p className="mt-1 text-[15px] text-muted">Enviamos 6 dígitos para <strong className="font-medium text-fg">{formData.email}</strong>.</p>
              {error && <p className="mt-4 rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
              {successMessage && !error && <p className="mt-4 rounded-xl bg-pos/10 px-4 py-3 text-sm font-medium text-pos">{successMessage}</p>}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                autoFocus
                aria-label="Código de verificação"
                className={cn(fieldClass, 'mt-6 h-14 text-center font-mono text-2xl tracking-[0.5em]')}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                required
              />
              <Button type="submit" size="lg" fullWidth className="mt-4" isLoading={loading} disabled={twoFactorCode.length < 6}>Verificar</Button>
              <Button variant="ghost" size="lg" fullWidth className="mt-2" onClick={handleResend2FA} disabled={loading || cooldown > 0 || resendCount >= 5}>
                {cooldown > 0 ? `Reenviar código em ${cooldown}s` : resendCount >= 5 ? 'Limite de reenvios atingido' : 'Reenviar código'}
              </Button>
              <Button variant="ghost" size="lg" fullWidth onClick={() => { setRequires2FA(false); setTwoFactorCode(''); setCooldown(0); setResendCount(0); setSuccessMessage(''); setError(''); }}>
                Voltar ao login
              </Button>
            </form>
          ) : successMessage ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/12 text-brand"><Mail size={26} /></span>
              <h2 className="text-xl font-semibold text-fg">Verifique seu e-mail</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{successMessage}</p>
              <Button size="lg" variant="secondary" fullWidth className="mt-6" onClick={() => { setSuccessMessage(''); setIsAuthModalOpen('login'); }}>
                Ir para o login
              </Button>
            </div>
          ) : isAuthModalOpen === 'forgot-password' ? (
            <form onSubmit={handleForgotPassword}>
              <h2 className="text-xl font-semibold text-fg">Recuperar senha</h2>
              <p className="mt-1 text-[15px] text-muted">Enviaremos um link para você criar uma nova senha.</p>
              {error && <p className="mt-4 rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">{error}</p>}
              <div className="mt-6">
                <Input label="E-mail" type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <Button type="submit" size="lg" fullWidth className="mt-5" isLoading={loading}>Enviar link</Button>
              <Button variant="ghost" size="lg" fullWidth className="mt-2" onClick={() => { setIsAuthModalOpen('login'); setError(''); setSuccessMessage(''); }}>
                Voltar ao login
              </Button>
            </form>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-fg">{isAuthModalOpen === 'login' ? 'Entrar na sua conta' : 'Criar conta grátis'}</h2>
              <p className="mt-1 text-[15px] text-muted">{isAuthModalOpen === 'login' ? 'Que bom ver você de novo.' : '7 dias grátis, sem cartão de crédito.'}</p>
              {error && (
                <div className="mt-4 rounded-xl bg-neg/10 px-4 py-3 text-sm font-medium text-neg">
                  <p>{error}</p>
                  {error.includes('Confirme seu e-mail') && (
                    <button type="button" onClick={handleResend} className="mt-2 font-semibold underline underline-offset-2">
                      Reenviar e-mail de confirmação
                    </button>
                  )}
                </div>
              )}
              <form onSubmit={handleAuth} className="mt-6 space-y-4">
                {isAuthModalOpen === 'register' && (
                  <Input label="Nome" autoComplete="name" placeholder="Seu nome" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                )}
                <Input label="E-mail" type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                <Field
                  label="Senha"
                  htmlFor="auth-password"
                  action={isAuthModalOpen === 'login' && (
                    <button type="button" onClick={() => { setIsAuthModalOpen('forgot-password'); setError(''); setSuccessMessage(''); }} className="text-[13px] font-medium text-brand hover:underline">
                      Esqueci a senha
                    </button>
                  )}
                >
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isAuthModalOpen === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    required
                    className={cn(fieldClass, 'h-12')}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </Field>
                <Button type="submit" size="lg" fullWidth isLoading={loading}>
                  {isAuthModalOpen === 'login' ? 'Entrar' : 'Criar conta grátis'}
                </Button>
              </form>
              {hasGoogleAuth && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-line" />
                    <span className="text-xs text-subtle">ou</span>
                    <div className="h-px flex-1 bg-line" />
                  </div>
                  <Button variant="secondary" size="lg" fullWidth onClick={() => googleLogin()} disabled={loading}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar com Google
                  </Button>
                </>
              )}
              <p className="mt-6 text-center text-sm text-muted">
                {isAuthModalOpen === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
                <button type="button" onClick={() => { setIsAuthModalOpen(isAuthModalOpen === 'login' ? 'register' : 'login'); setError(''); setSuccessMessage(''); }} className="font-semibold text-brand hover:underline">
                  {isAuthModalOpen === 'login' ? 'Cadastre-se grátis' : 'Entrar'}
                </button>
              </p>
              {isAuthModalOpen === 'register' && (
                <p className="mt-3 text-center text-xs leading-relaxed text-subtle">
                  Ao criar a conta, você concorda com a{' '}
                  <Link to="/politica-de-privacidade" onClick={closeAuth} className="text-brand hover:underline">política de privacidade e os termos de uso</Link>.
                </p>
              )}
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
