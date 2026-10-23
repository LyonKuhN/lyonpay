import { useTheme } from '../../contexts/ThemeContext';
import { formatBRL } from '../../lib/format';

/** Cores dos gráficos em hex: o SVG do Recharts não lê variáveis CSS em atributos. */
export function useChartColors() {
  const { theme } = useTheme();
  return theme === 'light'
    ? { pos: '#177a43', neg: '#c42f2f', brand: '#8e6a1f', info: '#2457c5', grid: '#ebe7df', axis: '#8c877b', surface: '#ffffff' }
    : { pos: '#3ccb7f', neg: '#f26d6d', brand: '#d4af5f', info: '#6ea8f7', grid: '#202329', axis: '#6c7280', surface: '#131519' };
}

interface TooltipEntry {
  name?: unknown;
  value?: unknown;
  color?: string;
  payload?: unknown;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: unknown;
  formatLabel?: (label: string) => string;
}

export function ChartTooltip({ active, payload, label, formatLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const title = label === undefined || label === null || label === '' ? '' : String(label);
  return (
    <div className="min-w-36 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-pop">
      {title && <p className="mb-1.5 text-xs font-medium text-muted">{formatLabel ? formatLabel(title) : title}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color || (p.payload as { fill?: string } | undefined)?.fill }} />
              {String(p.name ?? '')}
            </span>
            <span className="font-semibold text-fg tabular-nums">{formatBRL(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
