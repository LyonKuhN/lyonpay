import { ArrowLeft, Shield, FileText, Lock, Eye, CheckCircle, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { abrirPreferenciasCookies } from '../lib/analytics';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Eye,
      title: 'Coleta de Informações & PII',
      content: 'Coletamos apenas as informações estritamente necessárias para o funcionamento seguro da plataforma (como nome e e-mail para autenticação). Jamais enviamos Informações Pessoais Identificáveis (PII), senhas ou dados financeiros brutos para ferramentas de terceiros ou serviços de métricas.'
    },
    {
      icon: Lock,
      title: 'Segurança dos Seus Dados',
      content: 'Toda senha cadastrada é convertida em um hash bcrypt antes de ser guardada. A comunicação usa HTTPS e a sessão fica em um cookie httpOnly (inacessível a scripts da página), com expiração automática. Você pode ativar a verificação em duas etapas por e-mail. Comprovantes anexados ficam no nosso banco de dados e só são exibidos para quem tem acesso à conta.'
    },
    {
      icon: Shield,
      title: 'Compartilhamento com Terceiros',
      content: 'A Lyonk não vende, aluga ou compartilha suas informações pessoais ou dados de transações financeiras com anunciantes, corretoras ou outras instituições. Se você convidar alguém para a sua conta, essa pessoa passa a ver (ou editar, se você permitir) os seus lançamentos, e você pode remover o acesso quando quiser.'
    },
    {
      icon: FileText,
      title: 'Cookies e métricas (Google Analytics e Clarity)',
      content: 'O cookie de sessão é essencial e serve só para manter você conectado. Google Analytics 4 e Microsoft Clarity só são carregados se você aceitar no aviso de cookies; o IP é anonimizado e não enviamos nome, e-mail nem valores. Você pode mudar sua escolha a qualquer momento no botão abaixo ou no rodapé do site.'
    },
    {
      icon: Server,
      title: 'Serviços que usamos',
      content: 'Pagamentos são processados pela Stripe: o Lyonk não recebe nem guarda os dados do seu cartão. E-mails (confirmação, códigos e lembretes) são enviados pela Resend. Notificações no celular passam pelo serviço de push do seu navegador e só são enviadas se você ativar.'
    },
    {
      icon: CheckCircle,
      title: 'Seus Direitos (LGPD)',
      content: 'De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem total controle sobre seus registros. Você pode acessar, editar ou excluir qualquer dado financeiro inserido diretamente através dos painéis. Você também pode exportar seus lançamentos e excluir a conta, com todos os dados, em Ajustes.'
    }
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <SEO
        title="Política de Privacidade e Termos de Uso | Lyonk"
        description="Conheça a política de privacidade e termos de uso do Lyonk. Seus dados financeiros protegidos com transparência e de acordo com a LGPD."
        canonicalUrl="https://lyonk.com.br/politica-de-privacidade"
      />
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
          <p className="mt-3 text-xs font-medium text-subtle">Última atualização: outubro de 2026</p>
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

        <div className="flex justify-center pt-2">
          <button type="button" onClick={abrirPreferenciasCookies} className="h-11 rounded-xl border border-line-strong px-5 text-sm font-semibold text-fg hover:bg-elevated">
            Preferências de cookies
          </button>
        </div>
      </main>
    </div>
  );
}
