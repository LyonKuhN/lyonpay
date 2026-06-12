import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`block w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-bold outline-none focus:border-[#a3ff12] transition-colors placeholder:text-zinc-600 ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-[#FF4D4D]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
