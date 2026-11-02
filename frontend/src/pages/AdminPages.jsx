import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../services/api.js';
import { bpsToPercent, formatCad, formatWhen } from '../lib/money.js';
import { Badge, Button, Card, inputClass, Modal, Skeleton, useAsync } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function AdminDashboardPage() {
  const state = useAsync(() => api.get('/admin/dashboard').then((response) => response.data), []);
  if (state.loading) return <Skeleton />;
  if (state.error) return <p>{state.error}</p>;
  const cards = [
    ['Customers', state.data.customers],
    ['Active accounts', state.data.activeAccounts],
    ['Deposits', formatCad(state.data.depositsMinor)],
    ['Withdrawals', formatCad(state.data.withdrawalsMinor)],
    ['Transfer volume', formatCad(state.data.transferVolumeMinor)],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Administration</h1>
      <div className="grid gap-3 md:grid-cols-5">{cards.map(([label, value]) => <Card key={label}><p className="text-sm">{label}</p><p className="text-2xl font-semibold">{value}</p></Card>)}</div>
      <Card>
        <h2 className="font-semibold">Recent activity</h2>
        {state.data.recent.map((tx) => <p key={tx.id} className="mt-2 text-sm">{formatWhen(tx.createdAt)} · {tx.type} · {formatCad(tx.amountMinor)} · {tx.status}</p>)}
      </Card>
    </div>
  );
}

export function AdminCustomersPage() {
  const [q, setQ] = useState('');
  const state = useAsync(() => api.get('/admin/users', { params: { q } }).then((response) => response.data), [q]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Customers</h1>
      <input className={inputClass} placeholder="Search name or email" value={q} onChange={(event) => setQ(event.target.value)} />
      {state.loading ? <Skeleton /> : (
        <div className="space-y-2">
          {state.data.items.map((user) => (
            <Link key={user.id} to={`/admin/customers/${user.id}`} className="block">
              <Card><div className="flex justify-between"><span>{user.fullName}<br /><span className="text-sm">{user.email}</span></span><span>{formatCad(user.balanceMinor)} · {user.accounts} accounts</span></div></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const state = useAsync(() => api.get(`/admin/users/${id}`).then((response) => response.data), [id]);
  if (state.loading) return <Skeleton />;
  if (state.error) return <p>{state.error}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{state.data.user.fullName}</h1>
      <p>{state.data.user.email}</p>
      {state.data.accounts.map((account) => <Card key={account.id}>{account.name} · {account.accountNumber} · {formatCad(account.balanceMinor)} · {account.status}</Card>)}
      <Card>{state.data.transactions.map((tx) => <p key={tx.id} className="text-sm">{tx.referenceNumber} · {tx.type} · {formatCad(tx.amountMinor)} · {tx.status}</p>)}</Card>
    </div>
  );
}

export function AdminAccountsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(null);
  const state = useAsync(() => api.get('/admin/accounts', { params: { q } }).then((response) => response.data.items), [q, version]);
  async function apply() {
    try {
      const action = pending.status === 'FROZEN' ? 'unfreeze' : 'freeze';
      await api.patch(`/admin/accounts/${pending.id}/${action}`);
      toast.push(action === 'freeze' ? 'Account frozen.' : 'Account restored.');
      setPending(null);
      setVersion((value) => value + 1);
    } catch (error) {
      toast.push(errorMessage(error), 'error');
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Account management</h1>
      <input className={inputClass} placeholder="Search number, name, or email" value={q} onChange={(event) => setQ(event.target.value)} />
      {state.loading ? <Skeleton /> : state.data.map((account) => (
        <Card key={account.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{account.name} · {account.accountNumber}</p>
              <p className="text-sm">{account.owner?.fullName} · {account.owner?.email}</p>
              <p>{formatCad(account.balanceMinor)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={account.status === 'ACTIVE' ? 'good' : 'bad'}>{account.status}</Badge>
              <Button variant={account.status === 'FROZEN' ? 'primary' : 'danger'} onClick={() => setPending(account)}>
                {account.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
              </Button>
            </div>
          </div>
        </Card>
      ))}
      {pending ? <Modal title={pending.status === 'FROZEN' ? 'Unfreeze account' : 'Freeze account'} body="This writes an audit record. Completed transactions stay unchanged." confirmLabel="Confirm" tone={pending.status === 'FROZEN' ? 'primary' : 'danger'} onConfirm={apply} onClose={() => setPending(null)} /> : null}
    </div>
  );
}

export function MonitorPage() {
  const [status, setStatus] = useState('');
  const state = useAsync(() => api.get('/admin/transactions', { params: { status: status || undefined, pageSize: 50 } }).then((response) => response.data), [status]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Transaction monitoring</h1>
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All</option>
        <option value="FAILED">Failed attempts</option>
        <option value="COMPLETED">Completed</option>
      </select>
      {state.loading ? <Skeleton /> : state.data.items.map((tx) => (
        <Card key={tx.id}><p>{tx.referenceNumber} · {tx.type} · {formatCad(tx.amountMinor)}</p><p className="text-sm">{tx.description} · {tx.status} {tx.failureReason || ''}</p></Card>
      ))}
    </div>
  );
}

export function AuditPage() {
  const state = useAsync(() => api.get('/admin/audit-logs').then((response) => response.data), []);
  if (state.loading) return <Skeleton />;
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold">Audit log</h1>
      {state.data.items.map((row) => (
        <Card key={row.id}>
          <p className="font-semibold">{row.action}</p>
          <p className="text-sm">{formatWhen(row.createdAt)} · {row.actor?.email || 'system'} · {row.targetType} {row.targetId || ''}</p>
        </Card>
      ))}
    </div>
  );
}

export function AdminInterestPage() {
  const toast = useToast();
  const state = useAsync(() => api.get('/admin/interest-rate').then((response) => response.data), []);
  const [bps, setBps] = useState('250');
  const [note, setNote] = useState('Future accrual rate');
  async function save(event) {
    event.preventDefault();
    try {
      await api.put('/admin/interest-rate', { annualInterestRateBps: Number(bps), note });
      toast.push('Rate saved for future accrual.');
    } catch (error) {
      toast.push(errorMessage(error), 'error');
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Interest settings</h1>
      <Card>
        <p>Current rate {state.data ? bpsToPercent(state.data.annualInterestRateBps) : '…'} · {state.data?.method}</p>
        <form className="mt-4 space-y-3" onSubmit={save}>
          <input className={inputClass} value={bps} onChange={(event) => setBps(event.target.value)} aria-label="Annual rate in basis points" />
          <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} aria-label="Note" />
          <Button type="submit">Update future rate</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">History</h2>
        {(state.data?.history || []).map((row) => <p key={row.id} className="text-sm">{bpsToPercent(row.annualInterestRateBps)} from {String(row.effectiveFrom).slice(0, 10)} · {row.note}</p>)}
      </Card>
    </div>
  );
}
