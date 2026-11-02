import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  Calculator,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Receipt,
  Shield,
  Sun,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const customerLinks = [
  ['/app', 'Dashboard', LayoutDashboard],
  ['/app/accounts', 'Accounts', Wallet],
  ['/app/deposit', 'Deposit', PiggyBank],
  ['/app/withdraw', 'Withdraw', Receipt],
  ['/app/transfer', 'Transfer', ArrowLeftRight],
  ['/app/transactions', 'Activity', Receipt],
  ['/app/savings', 'Savings', PiggyBank],
  ['/app/savings/calculator', 'Calculator', Calculator],
  ['/app/profile', 'Profile', UserRound],
  ['/app/security', 'Security', Shield],
];

const adminLinks = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/customers', 'Customers', UserRound],
  ['/admin/accounts', 'Accounts', Wallet],
  ['/admin/transactions', 'Monitoring', Receipt],
  ['/admin/audit', 'Audit log', Shield],
  ['/admin/interest', 'Interest', Calculator],
];

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('vault-theme') === 'dark');
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const links = user?.role === 'ADMIN' ? adminLinks : customerLinks;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('vault-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (user?.role === 'ADMIN') return;
    api.get('/notifications').then((response) => setNotes(response.data.items)).catch(() => {});
  }, [user]);

  async function signOut() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className={`${open ? 'fixed inset-0 z-30 block bg-ink-950/40 md:static md:bg-transparent' : 'hidden md:block'}`}>
        <div className="flex h-full w-72 flex-col bg-ink-900 p-4 text-mint-50 md:w-auto">
          <div className="mb-6 flex items-center justify-between px-2">
            <NavLink to={user?.role === 'ADMIN' ? '/admin' : '/app'} className="text-lg font-semibold tracking-tight">VaultBank</NavLink>
            <button className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
            {links.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app' || to === '/admin'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <button onClick={signOut} className="mt-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm hover:bg-white/5">
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <div>
        <header className="flex items-center justify-between gap-3 border-b border-ink-900/5 px-4 py-3 dark:border-white/10">
          <button className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <p className="hidden text-sm text-ink-800/70 dark:text-white/60 sm:block">Simulated CAD banking</p>
          <div className="ml-auto flex items-center gap-2">
            <button aria-label="Toggle color theme" className="rounded-full p-2 hover:bg-ink-900/5 dark:hover:bg-white/10" onClick={() => setDark((value) => !value)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user?.role !== 'ADMIN' ? (
              <div className="relative">
                <button aria-label="Notifications" className="rounded-full p-2 hover:bg-ink-900/5 dark:hover:bg-white/10" onClick={() => setShowNotes((value) => !value)}>
                  <Bell size={18} />
                </button>
                {showNotes ? (
                  <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl bg-white p-3 shadow-card dark:bg-ink-900">
                    {notes.length === 0 ? <p className="text-sm">No notifications.</p> : notes.slice(0, 6).map((note) => (
                      <button
                        key={note.id}
                        className="block w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-mint-50 dark:hover:bg-white/5"
                        onClick={async () => {
                          await api.post(`/notifications/${note.id}/read`);
                          setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, readAt: new Date().toISOString() } : item)));
                        }}
                      >
                        <span className="font-semibold">{note.title}</span>
                        <span className="mt-1 block text-ink-800/70 dark:text-white/60">{note.body}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <span className="text-sm font-medium">{user?.fullName}</span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PublicLayout({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('vault-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('vault-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <div>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <a href="/" className="text-lg font-semibold">VaultBank</a>
        <nav className="flex items-center gap-4 text-sm" aria-label="Public">
          <a href="/demo">Demo</a>
          <a href="/login">Sign in</a>
          <a href="/register" className="rounded-full bg-ink-900 px-4 py-2 text-white dark:bg-mint-400 dark:text-ink-950">Open account</a>
          <button aria-label="Toggle color theme" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </nav>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
