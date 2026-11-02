import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { formatCad, formatWhen } from '../lib/money.js';
import { Badge, Button, Card, Empty, inputClass, Skeleton } from '../components/ui.jsx';

export function TransactionsPage() {
  const [filters, setFilters] = useState({ q: '', type: '', status: '', from: '', to: '', sort: 'date', direction: 'desc', page: 1 });
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    load(filters, setState);
    // The first load uses the initial filters. Later changes go through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function update(partial) {
    const next = { ...filters, ...partial, page: partial.page || 1 };
    setFilters(next);
    load(next, setState);
  }
  async function download(kind) {
    const response = await api.get(`/transactions/statement.${kind}`, { params: clean(filters), responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vaultbank-statement.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => download('csv')}>CSV</Button>
          <Button variant="quiet" onClick={() => download('pdf')}>PDF</Button>
        </div>
      </div>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <input className={inputClass} placeholder="Search reference or description" value={filters.q} onChange={(event) => update({ q: event.target.value })} />
          <select className={inputClass} value={filters.type} onChange={(event) => update({ type: event.target.value })}>
            <option value="">All types</option>
            {['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'INTEREST'].map((type) => <option key={type}>{type}</option>)}
          </select>
          <select className={inputClass} value={filters.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">All statuses</option>
            <option>COMPLETED</option>
            <option>FAILED</option>
          </select>
          <input className={inputClass} type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
          <input className={inputClass} type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} />
          <select className={inputClass} value={`${filters.sort}:${filters.direction}`} onChange={(event) => {
            const [sort, direction] = event.target.value.split(':');
            update({ sort, direction });
          }}>
            <option value="date:desc">Newest</option>
            <option value="date:asc">Oldest</option>
            <option value="amount:desc">Highest amount</option>
            <option value="amount:asc">Lowest amount</option>
          </select>
        </div>
      </Card>
      {state.loading ? <Skeleton /> : state.error ? <p>{state.error}</p> : state.data.items.length === 0 ? <Empty title="No transactions" body="Adjust the filters or make a simulated deposit." /> : (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-card dark:bg-ink-900">
          <table className="min-w-full text-left text-sm">
            <thead className="text-ink-800/60 dark:text-white/50"><tr><th className="px-4 py-3">When</th><th>Reference</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {state.data.items.map((tx) => (
                <tr key={tx.id} className="border-t border-ink-900/5 dark:border-white/10">
                  <td className="px-4 py-3">{formatWhen(tx.createdAt)}</td>
                  <td><Link className="font-medium" to={`/app/transactions/${tx.id}`}>{tx.referenceNumber}</Link></td>
                  <td>{tx.type}</td>
                  <td>{tx.description}</td>
                  <td>{formatCad(tx.amountMinor)} {tx.currency}</td>
                  <td><Badge tone={tx.status === 'COMPLETED' ? 'good' : 'bad'}>{tx.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-4 text-sm">
            <span>{state.data.total} records</span>
            <div className="flex gap-2">
              <Button variant="quiet" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Previous</Button>
              <Button variant="quiet" disabled={filters.page * state.data.pageSize >= state.data.total} onClick={() => update({ page: filters.page + 1 })}>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clean(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

function load(filters, setState) {
  setState((current) => ({ ...current, loading: true, error: '' }));
  api.get('/transactions', { params: clean(filters) })
    .then((response) => setState({ loading: false, error: '', data: response.data }))
    .catch((error) => setState({ loading: false, error: error?.response?.data?.error?.message || 'Unable to load transactions.', data: null }));
}

export function TransactionDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  useEffect(() => {
    api.get(`/transactions/${id}`).then((response) => setState({ loading: false, error: '', data: response.data.transaction })).catch((error) => {
      setState({ loading: false, error: error?.response?.data?.error?.message || 'Not available.', data: null });
    });
  }, [id]);
  if (state.loading) return <Skeleton />;
  if (state.error) return <p>{state.error}</p>;
  const tx = state.data;
  return (
    <Card>
      <p className="text-sm">{tx.type} · {tx.currency}</p>
      <h1 className="text-3xl font-semibold">{formatCad(tx.amountMinor)}</h1>
      <p className="mt-2">{tx.description}</p>
      <p className="mt-1 text-sm">Reference {tx.referenceNumber}</p>
      <p className="text-sm">{formatWhen(tx.createdAt)} · <Badge tone={tx.status === 'COMPLETED' ? 'good' : 'bad'}>{tx.status}</Badge></p>
      {tx.failureReason ? <p className="mt-2 text-sm text-red-700">{tx.failureReason}</p> : null}
      <h2 className="mt-6 font-semibold">Ledger entries</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {tx.entries.map((entry) => (
          <li key={entry.id} className="flex justify-between">
            <span>{entry.direction} · {entry.accountName || 'Clearing'} · {entry.accountNumber}</span>
            <span>{formatCad(entry.amountMinor)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
