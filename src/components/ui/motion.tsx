import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';
import { CircleCheck } from 'lucide-react';
import { cn } from '../../lib/cn';
import { EASE_OUT } from '../../lib/motion';


/** Número que conta do valor anterior até o novo (saldos e totais). */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const anterior = useRef(value);

  useEffect(() => {
    if (reduce || anterior.current === value) {
      anterior.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(anterior.current, value, {
      duration: 0.7,
      ease: EASE_OUT,
      onUpdate: setDisplay,
    });
    anterior.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={cn('tabular-nums', className)}>{format(display)}</span>;
}

const lista: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

/** Entrada em cascata: os filhos StaggerItem aparecem um depois do outro. */
export function Stagger({ children, className, as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'ul' | 'section' }) {
  const Comp = motion[as];
  return (
    <Comp variants={lista} initial="hidden" animate="show" className={className}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Comp = motion[as];
  return <Comp variants={item} className={className}>{children}</Comp>;
}

/** Linha de lista que encolhe e desliza ao sair (ex.: conta paga sai da lista de pendentes). */
export function SaidaSuave({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, x: 48 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      className={cn('overflow-hidden', className)}
    >
      {children}
    </motion.div>
  );
}

const LIMITE_SWIPE = 96;

/**
 * Deslizar para a direita para pagar (celular). O fundo verde aparece conforme o dedo anda;
 * passou do limite, vibra e confirma. Toque normal continua abrindo o detalhe.
 */
export function SwipeParaPagar({ children, onPagar, disabled, label = 'Pagar' }: {
  children: React.ReactNode;
  onPagar: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const x = useMotionValue(0);
  const fundo = useTransform(x, [0, LIMITE_SWIPE], [0, 1]);
  const escalaIcone = useTransform(x, [0, LIMITE_SWIPE * 0.6, LIMITE_SWIPE], [0.6, 0.9, 1.15]);
  const passou = useRef(false);
  const arrastou = useRef(false);

  if (disabled) return <>{children}</>;

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: fundo }} className="absolute inset-0 flex items-center bg-pos pl-5 text-white" aria-hidden>
        <motion.span style={{ scale: escalaIcone }} className="flex items-center gap-2 text-sm font-semibold">
          <CircleCheck size={20} /> {label}
        </motion.span>
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.9 }}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={() => { arrastou.current = true; }}
        // Soltar depois de arrastar não pode contar como toque na linha
        onClickCapture={(e) => {
          if (arrastou.current) {
            e.stopPropagation();
            e.preventDefault();
            arrastou.current = false;
          }
        }}
        onDrag={(_, info) => {
          const alem = info.offset.x > LIMITE_SWIPE;
          if (alem && !passou.current && 'vibrate' in navigator) navigator.vibrate?.(12);
          passou.current = alem;
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > LIMITE_SWIPE) onPagar();
          passou.current = false;
          // Se o navegador não disparar o clique depois do arraste, libera o próximo toque
          setTimeout(() => { arrastou.current = false; }, 0);
        }}
        className="relative bg-surface touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
