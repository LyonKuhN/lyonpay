import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Tone } from '../../lib/format';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface shadow-soft', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-muted',
  pos: 'text-pos',
  neg: 'text-neg',
  warn: 'text-warn',
  brand: 'text-brand',
  info: 'text-info',
};

export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-elevated text-muted',
  pos: 'bg-pos/12 text-pos',
  neg: 'bg-neg/12 text-neg',
  warn: 'bg-warn/14 text-warn',
  brand: 'bg-brand/14 text-brand',
  info: 'bg-info/12 text-info',
};

const TONE_BAR: Record<Tone, string> = {
  neutral: 'bg-muted',
  pos: 'bg-pos',
  neg: 'bg-neg',
  warn: 'bg-warn',
  brand: 'bg-brand',
  info: 'bg-info',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap', TONE_SOFT[tone], className)}>
      {children}
    </span>
  );
}

export function IconTile({ icon: Icon, tone = 'neutral', size = 'md', className }: {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const icon = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  return (
    <span className={cn('flex shrink-0 items-center justify-center', box, TONE_SOFT[tone], className)}>
      <Icon size={icon} strokeWidth={2} />
    </span>
  );
}

export function ProgressBar({ value, tone = 'brand', className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}>
      <motion.div
        className={cn('h-full rounded-full', TONE_BAR[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-elevated', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-elevated text-subtle">
        <Icon size={22} />
      </span>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand' : 'bg-line-strong',
      )}
    >
      <motion.span
        className="absolute left-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      />
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn('flex rounded-xl border border-line bg-elevated/60 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg border border-line bg-surface shadow-soft"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && (
              <span className={cn('relative rounded-md px-1.5 text-[11px] font-semibold tabular-nums', active ? 'bg-elevated text-fg' : 'text-subtle')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, description, actions, desktopOnly }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** No celular o título já está na barra do topo; sem ações para mostrar, o bloco some. */
  desktopOnly?: boolean;
}) {
  return (
    <div className={cn('mb-5 flex-wrap items-end justify-between gap-3 lg:mb-7', desktopOnly || !actions ? 'hidden lg:flex' : 'flex')}>
      <div className="hidden min-w-0 lg:block">
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">{actions}</div>}
    </div>
  );
}

/** Rótulo pequeno e valor grande, usado nos resumos. */
export function Stat({ label, value, sub, tone, className }: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-[13px] text-muted">{label}</p>
      <p className={cn('mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl', tone ? TONE_TEXT[tone] : 'text-fg')}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-subtle">{sub}</p>}
    </div>
  );
}
