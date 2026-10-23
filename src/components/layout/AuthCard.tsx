import React from 'react';
import { Link } from 'react-router-dom';

/** Moldura das telas avulsas de conta (confirmar e-mail, nova senha). */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
      <Link to="/" className="relative mb-8 flex items-center gap-2.5">
        <img src="/logo.png" alt="" className="h-8 w-9 object-contain" />
        <span className="text-lg font-semibold tracking-tight text-fg">Lyonk</span>
      </Link>
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-pop sm:p-8">
        {children}
      </div>
    </div>
  );
}
