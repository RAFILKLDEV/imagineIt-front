import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  notify: (message: string, options?: { type?: ToastType }) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, options?: { type?: ToastType }) => {
    const id = Date.now() + Math.random();
    const toast: Toast = {
      id,
      message,
      type: options?.type || 'info'
    };

    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastCtx.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col gap-3 md:right-4 md:inset-x-auto">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl transition ${
              toast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : toast.type === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-sky-500/40 bg-sky-500/10 text-sky-200'
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToastContext must be used inside ToastProvider');
  return ctx;
}
