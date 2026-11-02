import { Link } from 'react-router-dom';
import { DemoBanner } from '../components/ui.jsx';

export function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <DemoBanner />
      <section className="mt-8 grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">Simulated private banking</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight">A calm place to practice everyday money.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-800/80 dark:text-white/70">
            VaultBank is a portfolio demonstration of accounts, a double-entry ledger, transfers, and savings interest. Nothing here is a real deposit.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/register" className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white dark:bg-mint-400 dark:text-ink-950">Create a profile</Link>
            <Link to="/demo" className="rounded-full px-5 py-3 text-sm font-semibold ring-1 ring-ink-900/15">View the demo</Link>
          </div>
        </div>
        <div className="rounded-[2rem] bg-ink-900 p-6 text-mint-50 shadow-card">
          <p className="text-sm text-white/60">Sample checking</p>
          <p className="mt-2 text-4xl font-semibold">$2,480.00</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-white/60">Savings</p><p className="text-xl">$1,001.25</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-white/60">Rate</p><p className="text-xl">2.50%</p></div>
          </div>
        </div>
      </section>
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          ['Balanced ledger', 'Every deposit, withdrawal, transfer, and interest posting has equal debits and credits.'],
          ['Your accounts only', 'The API checks ownership. Administrators use a separate seeded role.'],
          ['Interest you can audit', 'Daily Actual/365 accrual is stored exactly. Estimates stay off the ledger until posted.'],
        ].map(([title, body]) => (
          <article key={title} className="rounded-3xl bg-white p-5 shadow-card dark:bg-ink-900">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-ink-800/70 dark:text-white/70">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
