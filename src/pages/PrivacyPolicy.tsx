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
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            aria-label="Voltar"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-fg"
          >
            <ArrowLeft size={20} />
          </button>
          <img src="/logo.png" alt="" className="h-6 w-7 object-contain" />
          <span className="text-[15px] font-semibold text-fg">Privacidade e termos</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-2">
          <h1 className="text-[26px] font-semibold tracking-tight text-fg sm:text-[32px]">Política de privacidade e termos de uso</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Na Lyonk, sua vida financeira é assunto pessoal. Esta política descreve como coletamos, guardamos e protegemos seus dados.
          </p>
          <p className="mt-3 text-xs font-medium text-subtle">Última atualização: junho de 2026</p>
        </div>

        {sections.map((sec) => (
          <section key={sec.title} className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
                <sec.icon size={19} />
              </span>
              <h2 className="text-base font-semibold text-fg">{sec.title}</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-muted">{sec.content}</p>
          </section>
        ))}

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
          <h2 className="mb-3 text-base font-semibold text-fg">Termos de responsabilidade</h2>
          <ul className="list-disc space-y-2.5 pl-5 text-[15px] leading-relaxed text-muted marker:text-brand">
            <li>O usuário é o único responsável pela guarda e confidencialidade de suas credenciais de login e senhas.</li>
            <li>A plataforma Lyonk oferece ferramentas estatísticas de agregação e projeção financeira com base nos dados inseridos, porém toda e qualquer decisão financeira ou de investimentos tomada a partir dessas análises é de inteira responsabilidade do usuário.</li>
            <li>Reservamo-nos o direito de suspender acessos em caso de uso fraudulento do sistema ou comportamento que comprometa a estabilidade dos servidores.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
