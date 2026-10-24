// O navegador oferece a instalação uma vez, cedo; o evento fica guardado até a pessoa tocar em "Instalar".

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evento: BeforeInstallPromptEvent | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as BeforeInstallPromptEvent;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    avisar();
  });
}

export const podeInstalar = () => !!evento;

export function ouvirInstalacao(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export async function instalar() {
  if (!evento) return false;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  evento = null;
  avisar();
  return outcome === 'accepted';
}

/** Já está aberto como app instalado. */
export const rodandoComoApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad no Safari: lá a instalação é manual, pelo botão Compartilhar. */
export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
