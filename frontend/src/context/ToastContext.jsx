import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const value = useMemo(
    () => ({
      push(message, tone = 'ok') {
        const id = crypto.randomUUID();
        setToasts((current) => [...current, { id, message, tone }]);
        setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
      },
    }),
    [],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl px-4 py-3 text-sm shadow-card ${toast.tone === 'error' ? 'bg-red-700 text-white' : 'bg-ink-900 text-white'}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
