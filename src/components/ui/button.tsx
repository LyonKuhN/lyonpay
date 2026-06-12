import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyle = "flex items-center justify-center gap-2 font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[#a3ff12] text-black hover:scale-[1.02] shadow-xl py-3.5 px-6",
      secondary: "bg-white/5 text-white border border-white/10 hover:border-white/20 py-3.5 px-6",
      danger: "bg-[#FF4D4D] text-white hover:bg-[#FF4D4D]/90 py-3.5 px-6 shadow-xl",
      ghost: "bg-transparent text-zinc-500 hover:text-white p-2"
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={`${baseStyle} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
