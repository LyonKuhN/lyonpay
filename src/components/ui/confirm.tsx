import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Sheet } from './sheet';
import { Button } from './button';
import { Input } from './input';

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** Exige digitar este texto antes de confirmar (ações irreversíveis). */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(value: boolean) => void>(undefined);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setTyped('');
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOptions(null);
  };

  const blocked = !!options?.requireText && typed.trim().toUpperCase() !== options.requireText.toUpperCase();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={!!options}
        onClose={() => close(false)}
        title={options?.title}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => close(false)} className="sm:w-auto" fullWidth>
              {options?.cancelText ?? 'Cancelar'}
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} onClick={() => close(true)} disabled={blocked} className="sm:w-auto" fullWidth>
              {options?.confirmText ?? 'Confirmar'}
            </Button>
          </div>
        }
      >
        {options?.description && <div className="text-[15px] leading-relaxed text-muted">{options.description}</div>}
        {options?.requireText && (
          <div className="mt-4">
            <Input
              label={<>Digite <strong className="text-fg">{options.requireText}</strong> para confirmar</>}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
        )}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
