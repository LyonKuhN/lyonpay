import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

// Fonte de 16px no celular: abaixo disso o iOS dá zoom ao focar o campo.
export const fieldClass =
  'block w-full rounded-xl border border-line-strong bg-bg px-3.5 text-base sm:text-[15px] text-fg placeholder:text-subtle ' +
  'outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-4 focus:ring-brand/15 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  action?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, action, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      {(label || action) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label && <label htmlFor={htmlFor} className="text-[13px] font-medium text-muted">{label}</label>}
          {action}
        </div>
      )}
      {children}
      {error ? <p className="mt-1.5 text-[13px] text-neg">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-subtle">{hint}</p> : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const input = (
      <div className="relative w-full">
        {leftIcon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">{leftIcon}</span>}
        <input ref={ref} id={inputId} className={cn(fieldClass, 'h-12', !!leftIcon && 'pl-10', className)} {...props} />
      </div>
    );
    if (!label && !hint && !error) return input;
    return <Field label={label} hint={hint} error={error} htmlFor={inputId}>{input}</Field>;
  },
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  action?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, label, action, id, children, ...props }, ref) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const select = (
    <div className="relative">
      <select ref={ref} id={selectId} className={cn(fieldClass, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-subtle" />
    </div>
  );
  if (!label && !action) return select;
  return <Field label={label} action={action} htmlFor={selectId}>{select}</Field>;
});
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, id, ...props }, ref) => {
  const autoId = useId();
  const areaId = id ?? autoId;
  const area = <textarea ref={ref} id={areaId} className={cn(fieldClass, 'min-h-[88px] resize-none py-3', className)} {...props} />;
  if (!label) return area;
  return <Field label={label} htmlFor={areaId}>{area}</Field>;
});
Textarea.displayName = 'Textarea';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'md' | 'lg';
}

/** Campo de valor com teclado numérico e vírgula decimal. */
export function MoneyInput({ value, onChange, label, hint, action, size = 'md', className, id, ...props }: MoneyInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} action={action} htmlFor={inputId}>
      <div className="relative">
        <span className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-medium text-subtle', size === 'lg' ? 'text-lg' : 'text-[15px]')}>R$</span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))}
          className={cn(fieldClass, 'pl-11 font-semibold tabular-nums', size === 'lg' ? 'h-14 text-2xl sm:text-2xl' : 'h-12', className)}
          {...props}
        />
      </div>
    </Field>
  );
}
