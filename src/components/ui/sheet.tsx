import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useIsDesktopSheet } from '../../hooks/useMediaQuery';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Esconde o cabeçalho padrão (para conteúdos que montam o próprio). */
  bare?: boolean;
}

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

// Pilha de painéis abertos: o Esc fecha só o de cima e o scroll volta quando todos fecham.
const stack: string[] = [];

/** Painel que sobe de baixo no celular e vira diálogo central a partir de 640px. */
export function Sheet({ open, onClose, title, description, children, footer, size = 'md', bare }: SheetProps) {
  const desktop = useIsDesktopSheet();
  const drag = useDragControls();
  const titleId = useId();
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    stack.push(titleId);
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === titleId) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stack.splice(stack.indexOf(titleId), 1);
      if (stack.length === 0) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, titleId]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              className={cn(
                'pointer-events-auto flex w-full flex-col border border-line bg-surface shadow-pop',
                'max-h-[92dvh] rounded-t-[28px] sm:max-h-[86vh] sm:rounded-3xl',
                SIZES[size],
              )}
              initial={desktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }}
              animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
              exit={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
              transition={desktop ? { duration: 0.18, ease: 'easeOut' } : { type: 'spring', damping: 34, stiffness: 380 }}
              drag={desktop ? false : 'y'}
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) onClose();
              }}
            >
              <div
                className="shrink-0 touch-none select-none"
                onPointerDown={(e) => {
                  if (!desktop && !(e.target as HTMLElement).closest('button')) drag.start(e);
                }}
              >
                <div className="flex justify-center pt-2.5 sm:hidden">
                  <span className="h-1.5 w-10 rounded-full bg-line-strong" />
                </div>
                {!bare && (
                  <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
                    <div className="min-w-0 flex-1">
                      {title && <h2 id={titleId} className="text-lg font-semibold tracking-tight text-fg">{title}</h2>}
                      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar"
                      className="-mr-1.5 -mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </div>
              <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6', footer ? 'pb-4' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6')}>
                {children}
              </div>
              {footer && (
                <div className="shrink-0 border-t border-line px-5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 sm:px-6 sm:pb-5 sm:pt-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
