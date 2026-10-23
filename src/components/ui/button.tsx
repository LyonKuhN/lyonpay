import React, { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-soft shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-elevated',
  ghost: 'text-muted hover:text-fg hover:bg-elevated',
  danger: 'bg-neg text-white hover:opacity-90',
  'danger-soft': 'bg-neg/10 text-neg hover:bg-neg/15',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
  icon: 'h-10 w-10',
  'icon-sm': 'h-9 w-9',
  'icon-lg': 'h-12 w-12',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={isLoading || disabled}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center rounded-xl font-semibold whitespace-nowrap',
        'transition-[background-color,color,border-color,opacity,transform] duration-150 active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {isLoading ? <LoaderCircle className="h-[18px] w-[18px] animate-spin" /> : children}
    </button>
  ),
);

Button.displayName = 'Button';
