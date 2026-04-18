'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { Check, AlertCircle, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback<ToastContextValue['toast']>(({ title, description, variant = 'info' }) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, title, description, variant }]);
  }, []);

  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={3000}>
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              'fixed bottom-4 right-4 z-[100] w-[min(92vw,360px)] rounded-lg border p-3 shadow-lg bg-white',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
              t.variant === 'success' && 'border-teal/40',
              t.variant === 'error' && 'border-accent/40',
              t.variant === 'info' && 'border-rule',
            )}
          >
            <div className="flex items-start gap-2">
              {t.variant === 'success' && <Check className="w-5 h-5 text-teal-dark shrink-0" />}
              {t.variant === 'error' && <AlertCircle className="w-5 h-5 text-accent shrink-0" />}
              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="text-xs text-mute mt-0.5">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close className="text-mute hover:text-charcoal" aria-label="閉じる">
                <X className="w-4 h-4" />
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex flex-col p-4 gap-2 w-[min(92vw,400px)] outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
