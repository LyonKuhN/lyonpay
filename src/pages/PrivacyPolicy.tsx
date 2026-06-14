import { ArrowLeft, Shield, FileText, Lock, Eye, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Eye,
      title: 'Coleta de Informações',
      content: 'Coletamos apenas as informações estritamente necessárias para o funcionamento seguro da plataforma. Isso inclui seu nome, e-mail para login, senha criptografada e os registros financeiros (receitas, despesas, parcelas) que você voluntariamente cadastrar na plataforma.'
    },
    {
      icon: Lock,
      title: 'Segurança dos Seus Dados',
      content: 'Toda e qualquer senha cadastrada é convertida em um hash seguro (via bcrypt) antes de ser persistida. Suas requisições trafegam de forma criptografada usando protocolos HTTPS e tokens JWT de curta duração. Seus dados financeiros são privados e pertencem unicamente a você.'
    },
    {
      icon: Shield,
      title: 'Compartilhamento com Terceiros',
      content: 'A Lyonk não vende, aluga ou compartilha suas informações pessoais ou dados de transações financeiras com nenhum tipo de anunciante, corretora ou instituição externa. A privacidade dos seus registros de despesas e receitas é absoluta.'
    },
    {
      icon: FileText,
      title: 'Cookies e Tecnologias Semelhantes',
      content: 'Utilizamos apenas cookies funcionais e de sessão essenciais para manter sua conta conectada com segurança entre as trocas de páginas e lembrar suas preferências de layout (como o tema escuro/claro). Não rastreamos seu comportamento fora da nossa plataforma.'
    },
    {
      icon: CheckCircle,
      title: 'Seus Direitos (LGPD)',
      content: 'De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem total controle sobre seus registros. Você pode acessar, editar ou excluir qualquer dado financeiro inserido diretamente através dos painéis. Para exclusão permanente da sua conta, basta solicitar nas configurações do seu perfil.'
    }
  ];

  return (
    <div className="animate-in fade-in duration-700 max-w-4xl mx-auto pt-4 pb-20 px-4 md:px-6 relative">
      {/* Glow de Fundo */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#a3ff12]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#FFD700]/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Cabeçalho */}
      <div className="mb-8 flex flex-col gap-4">
        <button 
          onClick={() => navigate(-1)} 
          className="self-start flex items-center gap-2 text-xs font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-all bg-white/5 px-4 py-2.5 rounded-full border border-white/5 active:scale-95"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white">
          Privacidade & Termos
        </h1>
        <p className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-wider">
          Política de Privacidade e Termos de Uso da Plataforma Lyonk
        </p>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Aviso Geral */}
        <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] shadow-xl">
          <p className="text-sm text-zinc-300 leading-relaxed font-semibold">
            Na Lyonk, acreditamos que sua vida financeira é assunto pessoal. Esta política descreve detalhadamente como coletamos, guardamos e protegemos seus dados para que você possa focar no seu controle financeiro com total paz de espírito.
          </p>
          <p className="text-[10px] font-black text-[#a3ff12] uppercase tracking-widest mt-4">
            Última atualização: Junho de 2026
          </p>
        </div>

        {/* Seções de Detalhes */}
        <div className="space-y-4">
          {sections.map((sec, idx) => (
            <div key={idx} className="p-6 md:p-8 bg-[#15151A] border border-white/5 rounded-[2rem] shadow-xl hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center text-[#a3ff12] shrink-0">
                  <sec.icon size={20} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">{sec.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        {/* Termos de Uso Básicos */}
        <div className="p-6 md:p-8 bg-[#15151A] border border-[#FFD700]/20 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-[#FFD700]/5 blur-[50px] rounded-full pointer-events-none" />
          <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="text-[#FFD700]">★</span> Termos de Responsabilidade
          </h3>
          <ul className="space-y-3 text-sm text-zinc-400 font-medium">
            <li className="flex items-start gap-2.5">
              <span className="text-[#FFD700] text-lg leading-none">•</span>
              O usuário é o único responsável pela guarda e confidencialidade de suas credenciais de login e senhas.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-[#FFD700] text-lg leading-none">•</span>
              A plataforma Lyonk oferece ferramentas estatísticas de agregação e projeção financeira com base nos dados inseridos, porém toda e qualquer decisão financeira ou de investimentos tomada a partir dessas análises é de inteira responsabilidade do usuário.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-[#FFD700] text-lg leading-none">•</span>
              Reservamo-nos o direito de suspender acessos em caso de uso fraudulento do sistema ou comportamento que comprometa a estabilidade dos servidores.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
