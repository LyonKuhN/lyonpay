import { useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/cn';
import { ehIOS, instalar, ouvirInstalacao, podeInstalar, rodandoComoApp } from '../lib/pwa';

/** Convite para instalar o Lyonk na tela inicial (Android/desktop com botão; iPhone com instruções). */
export function InstalarApp({ className }: { className?: string }) {
  const disponivel = useSyncExternalStore(ouvirInstalacao, podeInstalar, () => false);
  if (rodandoComoApp()) return null;

  if (disponivel) {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/8 p-4', className)}>
        <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 rounded-xl bg-bg object-contain p-1.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Instale o Lyonk</p>
          <p className="text-[13px] text-muted">Abre em tela cheia e recebe avisos de vencimento.</p>
        </div>
        <Button size="sm" onClick={() => instalar()}><Download size={15} /> Instalar</Button>
      </div>
    );
  }

  if (ehIOS()) {
    return (
      <div className={cn('rounded-2xl border border-line bg-bg p-4', className)}>
        <p className="text-sm font-semibold text-fg">Instale na tela de início</p>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[13px] text-muted">
          No Safari, toque em <Share size={14} className="text-info" /> Compartilhar e depois em <SquarePlus size={14} className="text-fg" /> Adicionar à Tela de Início.
        </p>
      </div>
    );
  }

  return null;
}
