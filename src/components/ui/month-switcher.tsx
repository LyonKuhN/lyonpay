import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from './sheet';
import { cn } from '../../lib/cn';
import { MONTHS, MONTHS_SHORT } from '../../lib/format';

interface MonthSwitcherProps {
  year: number;
  /** 1 a 12; 0 representa o ano inteiro (quando allowYear). */
  month: number;
  onChange: (year: number, month: number) => void;
  allowYear?: boolean;
  className?: string;
}

export function MonthSwitcher({ year, month, onChange, allowYear, className }: MonthSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const now = new Date();

  const step = (delta: number) => {
    if (month === 0) return onChange(year + delta, 0);
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };

  const label = month === 0 ? `Ano de ${year}` : `${MONTHS[month - 1]} ${year}`;

  return (
    <>
      <div className={cn('flex h-11 items-center rounded-xl border border-line bg-surface shadow-soft', className)}>
        <button type="button" onClick={() => step(-1)} aria-label="Período anterior" className="flex h-full w-11 items-center justify-center rounded-l-xl text-muted transition-colors hover:bg-elevated hover:text-fg">
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => { setPickerYear(year); setOpen(true); }}
          className="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
        >
          <span className="truncate">{label}</span>
          <ChevronDown size={15} className="shrink-0 text-subtle" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Próximo período" className="flex h-full w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:bg-elevated hover:text-fg">
          <ChevronRight size={18} />
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Escolher período" size="sm">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-bg p-1">
          <button type="button" onClick={() => setPickerYear((y) => y - 1)} aria-label="Ano anterior" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold tabular-nums">{pickerYear}</span>
          <button type="button" onClick={() => setPickerYear((y) => y + 1)} aria-label="Próximo ano" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_SHORT.map((m, i) => {
            const selected = month === i + 1 && year === pickerYear;
            const isCurrent = now.getMonth() === i && now.getFullYear() === pickerYear;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { onChange(pickerYear, i + 1); setOpen(false); }}
                className={cn(
                  'h-12 rounded-xl border text-sm font-medium capitalize transition-colors',
                  selected ? 'border-brand bg-brand text-on-brand' : 'border-line bg-bg text-fg hover:border-line-strong',
                  !selected && isCurrent && 'border-brand/50 text-brand',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        {allowYear && (
          <button
            type="button"
            onClick={() => { onChange(pickerYear, 0); setOpen(false); }}
            className={cn(
              'mt-3 h-12 w-full rounded-xl border text-sm font-medium transition-colors',
              month === 0 && year === pickerYear ? 'border-brand bg-brand text-on-brand' : 'border-line bg-bg text-fg hover:border-line-strong',
            )}
          >
            Ano inteiro de {pickerYear}
          </button>
        )}
        <button
          type="button"
          onClick={() => { onChange(now.getFullYear(), now.getMonth() + 1); setOpen(false); }}
          className="mt-3 h-11 w-full rounded-xl text-sm font-medium text-brand hover:bg-brand/10"
        >
          Voltar para o mês atual
        </button>
      </Sheet>
    </>
  );
}
