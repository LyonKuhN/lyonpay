// Google Analytics e Microsoft Clarity só carregam depois que a pessoa aceita os cookies (LGPD).
const GA_ID = 'G-2HW08XP0XW';
const CLARITY_ID = 'y3wzdjv9g6';
const CHAVE = 'lyonk-cookie-consent';

type Consentimento = 'accepted' | 'declined' | null;

export function lerConsentimento(): Consentimento {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

let carregado = false;

export function carregarAnalytics() {
  if (carregado || typeof window === 'undefined' || import.meta.env.DEV) return;
  carregado = true;

  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void; clarity: ((...args: unknown[]) => void) & { q?: unknown[] } };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', GA_ID, { anonymize_ip: true });
  const ga = document.createElement('script');
  ga.async = true;
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(ga);

  w.clarity = w.clarity || Object.assign((...args: unknown[]) => { (w.clarity.q = w.clarity.q || []).push(args); }, {});
  const cl = document.createElement('script');
  cl.async = true;
  cl.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(cl);
}

export function salvarConsentimento(valor: 'accepted' | 'declined') {
  const anterior = lerConsentimento();
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    // sem armazenamento, o aviso volta na próxima visita
  }
  if (valor === 'accepted') carregarAnalytics();
  // Quem aceitou e depois recusou: recarrega a página para os scripts saírem de vez
  if (valor === 'declined' && anterior === 'accepted' && carregado) window.location.reload();
}

/** Reabre o aviso de cookies para a pessoa mudar a escolha. */
export const abrirPreferenciasCookies = () => window.dispatchEvent(new CustomEvent('abrir-preferencias-cookies'));
