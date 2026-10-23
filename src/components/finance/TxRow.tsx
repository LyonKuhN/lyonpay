import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Tone } from '../../lib/format';
import { IconTile, TONE_TEXT } from '../ui/primitives';

interface TxRowProps {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount: React.ReactNode;
  amountTone?: Tone | 'fg';
  /** Abaixo do valor: data, status ou um botão de ação. */
  meta?: React.ReactNode;
  onClick?: () => void;
  dim?: boolean;
  className?: string;
}

/** Linha de lançamento: ícone, descrição e valor alinhados como num extrato. */
export function TxRow({ icon, tone = 'neutral', title, subtitle, amount, amountTone = 'fg', meta, onClick, dim, className }: TxRowProps) {
  const content = (
    <>
      <IconTile icon={icon} tone={tone} />
      <div className={cn('min-w-0 flex-1', dim && 'opacity-60')}>
        <p className="truncate text-[15px] font-medium leading-5 text-fg">{title}</p>
        {subtitle && <div className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-5 text-muted">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('text-[15px] font-semibold leading-5 tabular-nums', amountTone === 'fg' ? 'text-fg' : TONE_TEXT[amountTone], dim && 'opacity-60')}>
          {amount}
        </span>
        {meta}
      </div>
    </>
  );

  const base = 'flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5';

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(base, 'cursor-pointer transition-colors hover:bg-elevated/60 active:bg-elevated', className)}
      >
        {content}
      </div>
    );
  }
  return <div className={cn(base, className)}>{content}</div>;
}

/** Cabeçalho de grupo dentro de listas (ex.: mês). */
export function ListGroupHeader({ title, aside }: { title: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line bg-elevated/40 px-4 py-2 sm:px-5">
      <span className="text-[13px] font-semibold text-fg">{title}</span>
      {aside && <span className="text-[13px] font-medium text-muted tabular-nums">{aside}</span>}
    </div>
  );
}
