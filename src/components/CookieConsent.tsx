import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('lyonk-cookie-consent');
    if (!consent) {
      // Pequeno delay para a animação aparecer suavemente após carregar a página
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('lyonk-cookie-consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('lyonk-cookie-consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[200] animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="glass bg-[#15151A]/90 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow de Fundo */}
        <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-[#a3ff12]/10 blur-[50px] rounded-full pointer-events-none" />

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#a3ff12]/10 flex items-center justify-center shrink-0 text-[#a3ff12]">
            <Shield size={20} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Controle de Privacidade</h4>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-semibold">
              Nós utilizamos cookies e tecnologias semelhantes para garantir o funcionamento seguro da plataforma, personalizar conteúdo e analisar o nosso tráfego. Ao clicar em continuar, você concorda com nossos termos.
            </p>
            <div className="mt-2 text-left">
              <Link 
                to="/politica-de-privacidade" 
                onClick={() => setVisible(false)}
                className="text-[10px] font-black text-[#a3ff12] uppercase tracking-widest hover:underline"
              >
                Ler Política de Privacidade & Termos →
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button 
            type="button"
            onClick={handleAccept}
            className="flex-1 py-3 px-4 bg-[#a3ff12] text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#a3ff12]/15"
          >
            Aceitar Todos
          </button>
          <button 
            type="button"
            onClick={handleDecline}
            className="py-3 px-4 bg-white/5 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl active:scale-95 transition-all"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
