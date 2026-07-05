import { useState, useEffect } from 'react';
import { User, CreditCard, AlertTriangle, CheckCircle2, Trash2, Loader2, Save, Sparkles, PartyPopper, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

export default function Config() {
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cupom, setCupom] = useState('');
  const [applyingCupom, setApplyingCupom] = useState(false);
  const [cupomMessage, setCupomMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [notificacoesDiarias, setNotificacoesDiarias] = useState(user?.notificacoes_diarias ?? true);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      const verifySession = async () => {
        try {
          const res = await fetch(API_BASE_URL + '/api/stripe/verify-session', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.subscribed) {
            updateUser({ ...user!, subscribed: true, expires_at: data.expires_at });
            setShowSuccessModal(true);
            setSearchParams({}); // Limpa URL
          }
        } catch (err) { console.error(err); }
      };
      verifySession();
    }
  }, [searchParams, token, user, updateUser, setSearchParams]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const body = cupomMessage?.type === 'success' && cupomMessage.text.includes('checkout') ? { cupom_codigo: cupom } : {};
      
      const res = await fetch(API_BASE_URL + '/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleApplyCupom = async () => {
    if (!cupom) return;
    setApplyingCupom(true);
    setCupomMessage(null);
    try {
      const res = await fetch(API_BASE_URL + '/api/config/aplicar-cupom', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ codigo: cupom })
      });
      const data = await res.json();
      if (res.ok) {
        setCupomMessage({ type: 'success', text: data.message });
        if (data.tipo === '100') {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setCupomMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setCupomMessage({ type: 'error', text: 'Erro ao aplicar cupom' });
    } finally {
      setApplyingCupom(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdating(true);
    try {
      const response = await fetch(API_BASE_URL + '/api/auth/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ name, notificacoes_diarias: notificacoesDiarias })
      });

      if (response.ok) {
        toast.success('Perfil atualizado com sucesso!');
        updateUser({ ...user!, name, notificacoes_diarias: notificacoesDiarias });
      } else {
        toast.error('Erro ao atualizar perfil');
      }
    } catch (err) {
      toast.error('Erro de conexão ao salvar');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch(API_BASE_URL + '/api/auth/me', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) { logout(); navigate('/'); }
    } catch (err) { console.error(err); }
    finally { setDeleting(false); }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    setToggling2FA(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/set-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) throw new Error('Erro ao atualizar 2FA');
      if (user) {
        updateUser({ ...user, two_factor_enabled: enabled });
      }
      toast.success(enabled ? 'Proteção 2FA ativada com sucesso!' : 'Proteção 2FA desativada.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar preferência');
    } finally {
      setToggling2FA(false);
    }
  };

  const now = new Date();
  const expiresAt = user?.expires_at ? new Date(user.expires_at) : null;
  const isExpired = user?.role !== 'admin' && expiresAt ? expiresAt < now : false;
  const daysLeft = expiresAt && !isExpired ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-4xl mx-auto pt-4 md:pt-6 pb-20 space-y-6 md:space-y-8 px-4 sm:px-6">
      
      <header className="mb-8 md:mb-12 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2 text-white">Configurações</h1>
        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.4em]">Gerenciamento de Conta</p>
      </header>

      {(isExpired || searchParams.get('expired')) && (
        <div className="bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 md:gap-8 animate-in slide-in-from-top-4 duration-500 text-center md:text-left">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-[#FF4D4D]/20 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle className="text-[#FF4D4D] w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight">Sua assinatura expirou! 🛡️</h3>
            <p className="text-sm md:text-base text-zinc-500 font-medium">Seu acesso às ferramentas de gestão foi bloqueado. Renove sua assinatura para continuar controlando suas finanças com Lyonk Premium.</p>
          </div>
          <button 
            onClick={handleSubscribe}
            className="w-full md:w-auto px-8 py-4 bg-[#FF4D4D] text-white font-black rounded-2xl hover:scale-105 transition-all shadow-[0_10px_30px_rgba(255,77,77,0.3)]"
          >
            ASSINAR
          </button>
        </div>
      )}

      {/* Perfil do Usuário */}
      <section className="bg-[#15151A] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-[#a3ff12]/5 blur-[100px] rounded-full -mr-32 -mt-32 transition-all group-hover:bg-[#a3ff12]/10" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-8 md:mb-10 relative z-10 text-center md:text-left">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
            <User size={24} className="text-[#a3ff12]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Seu Perfil</h2>
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Informações Pessoais</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome de Exibição</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-[#a3ff12] transition-all" 
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-mail (Login)</label>
            <input type="email" defaultValue={user?.email} disabled className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-zinc-600 font-bold cursor-not-allowed" />
          </div>
        </div>
        
        <div className="mt-8 bg-black/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 text-center md:text-left">
          <div>
            <h3 className="text-xl font-black text-white mb-2">Notificações Diárias</h3>
            <p className="text-sm text-zinc-400">Receba um e-mail diário avisando sobre contas que vencem no dia atual.</p>
          </div>
          <button 
            onClick={() => setNotificacoesDiarias(!notificacoesDiarias)}
            className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl transition-all flex items-center justify-center gap-3 ${notificacoesDiarias ? 'bg-[#a3ff12] text-black hover:scale-105 shadow-[0_10px_30px_rgba(163,255,18,0.2)]' : 'bg-white/5 text-zinc-500 hover:text-white border border-white/10 hover:border-white/20'}`}
          >
            {notificacoesDiarias ? 'ATIVADO' : 'DESATIVADO'}
          </button>
        </div>

        <button 
          onClick={handleUpdateProfile}
          disabled={updating}
          className="mt-8 md:mt-10 px-8 md:px-10 py-4 md:py-5 w-full md:w-auto bg-[#a3ff12] text-black font-black rounded-2xl hover:scale-105 transition-all shadow-2xl flex items-center justify-center md:justify-start gap-3 disabled:opacity-50"
        >
          {updating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          SALVAR ALTERAÇÕES
        </button>
      </section>

      {/* Segurança */}
      <section className="bg-[#15151A] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-8 relative z-10 text-center md:text-left">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20 shrink-0">
            <ShieldCheck size={24} className="text-[#a3ff12]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Segurança</h2>
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Autenticação e Senha</p>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 text-center md:text-left mb-8">
          <div>
            <h3 className="text-xl font-black text-white mb-2">Autenticação em Duas Etapas (2FA)</h3>
            <p className="text-sm text-zinc-400">Receba um código de 6 dígitos no seu e-mail sempre que fizer login para garantir que só você acesse a conta.</p>
          </div>
          <button 
            onClick={() => handleToggle2FA(!user?.two_factor_enabled)}
            disabled={toggling2FA}
            className={`w-full md:w-auto px-8 py-4 font-black rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${user?.two_factor_enabled ? 'bg-white/5 text-[#FF4D4D] hover:bg-[#FF4D4D]/10 border border-[#FF4D4D]/20' : 'bg-[#a3ff12] text-black hover:scale-105 shadow-[0_10px_30px_rgba(163,255,18,0.2)]'}`}
          >
            {toggling2FA ? <Loader2 className="animate-spin" size={20} /> : user?.two_factor_enabled ? 'DESATIVAR 2FA' : 'ATIVAR 2FA'}
          </button>
        </div>

      </section>

      {/* Assinatura */}
      <section className="bg-gradient-to-br from-[#1C1C21] to-[#15151A] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-2xl">
        <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-[#a3ff12]/5 blur-[100px] rounded-full -mr-32 -mt-32" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-8 md:mb-10 relative z-10 text-center md:text-left">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#a3ff12]/10 flex items-center justify-center border border-[#a3ff12]/20 shrink-0">
            <CreditCard size={24} className="text-[#a3ff12]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Lyonk Premium</h2>
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Plano e Pagamento</p>
          </div>
        </div>
        
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 relative z-10 text-center md:text-left">
          {(user?.role === 'admin' || (user?.subscribed && !isExpired)) ? (
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 w-full">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#a3ff12]/20 flex items-center justify-center text-[#a3ff12] border border-[#a3ff12]/30 shadow-[0_0_20px_rgba(163,255,18,0.2)] shrink-0">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-1">Você é PRO!</h3>
                <p className="text-xs md:text-sm text-[#a3ff12] font-black uppercase tracking-widest">Sua assinatura está ativa</p>
                {user?.role === 'admin' ? (
                  <p className="text-[10px] md:text-xs text-zinc-500 mt-2 font-bold uppercase tracking-widest">ACESSO VITALÍCIO (ADMIN)</p>
                ) : user?.expires_at ? (
                  <p className="text-[10px] md:text-xs text-zinc-500 mt-2">Expira em {new Date(user.expires_at).toLocaleDateString('pt-BR')}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1">
                <div className="inline-flex px-3 py-1 bg-[#a3ff12]/10 text-[#a3ff12] rounded-lg text-[10px] font-black uppercase tracking-widest mb-3">CONTA GRATUITA</div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-1">Passaporte Premium</h3>
                <p className="text-xs md:text-sm text-zinc-500 font-medium leading-relaxed">Libere todo o potencial do Lyonk e controle seu futuro financeiro sem limites.</p>
                
                {expiresAt && !isExpired && (
                  <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10 inline-block w-full md:w-auto">
                    <p className="text-sm text-[#a3ff12] font-black">
                      ⏱️ {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'} de teste gratuito
                    </p>
                  </div>
                )}
                
                {/* Cupons */}
                <div className="mt-4">
                  <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">Possui um cupom?</p>
                  <div className="flex items-center gap-2 max-w-sm">
                    <input 
                      value={cupom}
                      onChange={e => setCupom(e.target.value.toUpperCase())}
                      placeholder="CÓDIGO"
                      className="flex-1 bg-black/40 border border-[#a3ff12]/10 rounded-xl py-3 px-4 text-white font-black text-sm uppercase focus:border-[#a3ff12] outline-none transition-all"
                    />
                    <button 
                      onClick={handleApplyCupom}
                      disabled={applyingCupom || !cupom}
                      className="px-4 py-3 bg-[#a3ff12]/10 text-[#a3ff12] font-black rounded-xl hover:bg-[#a3ff12] hover:text-black transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      {applyingCupom ? <Loader2 className="animate-spin" size={18}/> : 'APLICAR'}
                    </button>
                  </div>
                  {cupomMessage && (
                    <p className={`text-xs mt-2 font-bold ${cupomMessage.type === 'error' ? 'text-[#FF4D4D]' : 'text-[#a3ff12]'}`}>
                      {cupomMessage.text}
                    </p>
                  )}
                </div>

              </div>
              <button 
                onClick={handleSubscribe}
                disabled={subscribing}
                className="w-full md:w-auto px-8 md:px-10 py-4 md:py-5 bg-[#635BFF] hover:bg-[#635BFF]/90 text-white font-black rounded-2xl transition-all shadow-[0_10px_30px_rgba(99,91,255,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 shrink-0 mt-4 md:mt-0"
              >
                {subscribing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                ASSINAR
              </button>
            </>
          )}
        </div>
      </section>

      {/* Zona de Perigo */}
      <section className="bg-[#FF4D4D]/5 border border-[#FF4D4D]/20 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 mb-8 md:mb-10 text-center md:text-left">
          <div className="w-12 h-12 md:w-14 h-14 rounded-2xl bg-[#FF4D4D]/10 flex items-center justify-center border border-[#FF4D4D]/20 shrink-0">
            <AlertTriangle size={24} className="text-[#FF4D4D]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Zona de Perigo</h2>
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Ações Irreversíveis</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 bg-black/40 border border-[#FF4D4D]/10 rounded-3xl text-center md:text-left">
          <div className="flex-1">
            <p className="font-black text-white text-lg md:text-xl mb-1">Apagar todos os dados</p>
            <p className="text-xs md:text-sm text-zinc-500 font-medium leading-relaxed">Isso removerá permanentemente seu histórico financeiro.</p>
          </div>
          <button 
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full md:w-auto px-6 md:px-8 py-4 bg-[#FF4D4D]/10 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white border border-[#FF4D4D]/30 rounded-xl font-black transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Trash2 size={20} /> DELETAR CONTA
          </button>
        </div>
      </section>

      {/* Modal Deletar */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="bg-[#15151A] border border-[#FF4D4D]/30 rounded-[3rem] w-full max-w-md p-10 relative z-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-[#FF4D4D]/10 text-[#FF4D4D] rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-3xl font-black text-white text-center mb-3">Tem certeza?</h2>
            <p className="text-zinc-500 text-center mb-10 font-medium">Essa ação não pode ser desfeita. Todos os seus lançamentos serão perdidos para sempre.</p>
            
            <div className="space-y-4">
              <button onClick={handleDeleteAccount} disabled={deleting} className="w-full py-5 bg-[#FF4D4D] text-white font-black rounded-2xl flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="animate-spin" /> : 'SIM, DELETAR TUDO'}
              </button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-5 bg-white/5 text-white font-black rounded-2xl">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Sucesso Premium */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#18181B] border border-[#a3ff12]/30 w-full max-w-md rounded-3xl p-8 text-center shadow-[0_0_50px_-12px_rgba(163,255,18,0.3)] animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-[#a3ff12] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(163,255,18,0.5)]">
              <PartyPopper size={40} className="text-black" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">Bem-vindo ao Pro!</h2>
            <p className="text-[#a1a1aa] mb-8">
              Sua assinatura foi confirmada. Agora você tem acesso ilimitado a todos os recursos premium do Lyonk.
            </p>
            
            <div className="space-y-4">
              <div className="bg-[#27272A] p-4 rounded-2xl flex items-center gap-4 text-left border border-white/5">
                <div className="bg-[#a3ff12]/10 p-2 rounded-xl">
                  <Sparkles size={20} className="text-[#a3ff12]" />
                </div>
                <div>
                  <div className="text-white font-semibold">Recursos Desbloqueados</div>
                  <div className="text-xs text-[#71717a]">Relatórios detalhados, metas e suporte.</div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full mt-8 bg-[#a3ff12] hover:bg-[#befd5c] text-black font-bold py-4 rounded-2xl transition-all shadow-[0_10px_20px_-10px_rgba(163,255,18,0.5)] active:scale-95"
            >
              Vamos começar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
