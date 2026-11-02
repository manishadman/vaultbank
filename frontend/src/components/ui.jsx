import { useEffect, useState } from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 dark:bg-mint-400 dark:text-ink-950',
    quiet: 'bg-white text-ink-900 ring-1 ring-ink-900/10 hover:bg-mint-50 dark:bg-ink-900 dark:text-mint-50 dark:ring-white/10',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    gold: 'bg-gold-500 text-ink-950 hover:bg-gold-300',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-red-700 dark:text-red-300">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-ink-950 outline-none ring-gold-500 focus:ring-2 dark:border-white/10 dark:bg-ink-900 dark:text-white';

export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-card dark:bg-ink-900 ${className}`}>{children}</section>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-ink-900/5 text-ink-800 dark:bg-white/10 dark:text-mint-50',
    good: 'bg-mint-100 text-mint-600 dark:bg-mint-400/20 dark:text-mint-100',
    bad: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-100',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Empty({ title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-900/15 px-4 py-10 text-center dark:border-white/15">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-800/70 dark:text-white/70">{body}</p>
    </div>
  );
}

export function Skeleton({ className = 'h-24' }) {
  return <div className={`animate-pulse rounded-3xl bg-ink-900/10 dark:bg-white/10 ${className}`} />;
}

export function Modal({ title, body, confirmLabel, tone = 'primary', onConfirm, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-ink-900">
        <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-ink-800/80 dark:text-white/70">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <p className="rounded-2xl bg-gold-300/40 px-4 py-2 text-sm text-ink-950 dark:bg-gold-500/20 dark:text-gold-300">
      Demonstration only. VaultBank moves simulated Canadian dollars. No real deposit is collected or sent.
    </p>
  );
}

export function useAsync(loader, deps) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader()
      .then((data) => {
        if (active) setState({ loading: false, error: '', data });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error?.response?.data?.error?.message || 'Unable to load this view.', data: null });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
