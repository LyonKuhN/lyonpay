import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { cn } from '../lib/cn';

const PUBLIC_ROUTES = ['/', '/verify', '/reset-password', '/politica-de-privacidade'];

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();
  // Nas telas do app, o aviso sobe para não cobrir a barra inferior do celular
  const inApp = !PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    let consent: string | null;
    try {
      consent = localStorage.getItem('lyonk-cookie-consent');
    } catch {
      return;
    }
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const decide = (value: 'accepted' | 'declined') => {
    try {
      localStorage.setItem('lyonk-cookie-consent', value);
    } catch {
      // sem armazenamento, o aviso volta na próxima visita
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={cn(
            'fixed inset-x-3 z-[90] sm:left-auto sm:right-5 sm:max-w-sm',
            inApp ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-5' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-5',
          )}
        >
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-pop">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><Cookie size={18} /></span>
              <p className="text-[13px] leading-relaxed text-muted">
                Usamos cookies essenciais para manter sua sessão segura e lembrar suas preferências.{' '}
                <Link to="/politica-de-privacidade" className="font-medium text-brand hover:underline">Saiba mais</Link>
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => decide('declined')} className="h-10 flex-1 rounded-xl border border-line-strong text-sm font-semibold text-fg hover:bg-elevated">
                Recusar
              </button>
              <button type="button" onClick={() => decide('accepted')} className="h-10 flex-[1.4] rounded-xl bg-brand text-sm font-semibold text-on-brand hover:bg-brand-soft">
                Aceitar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
