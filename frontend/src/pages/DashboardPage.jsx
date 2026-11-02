import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { formatCad, formatWhen } from '../lib/money.js';
import { Badge, Card, DemoBanner, Skeleton, useAsync } from '../components/ui.jsx';

export function DashboardPage() {
  const state = useAsync(() => api.get('/dashboard').then((response) => response.data), []);
  if (state.loading) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} />)}</div>;
  if (state.error) return <p className="text-red-700">{state.error}</p>;
  const { totals, balanceSeries, monthlyActivity, recent } = state.data;
  const cards = [
    ['Total balance', totals.totalMinor],
    ['Checking', totals.checkingMinor],
    ['Savings', totals.savingsMinor],
    ['Deposits this month', totals.depositsThisMonthMinor],
    ['Withdrawals this month', totals.withdrawalsThisMonthMinor],
  ];
  const series = balanceSeries.map((point) => ({ ...point, balance: Number(point.balanceMinor) / 100 }));
  const activity = monthlyActivity.map((point) => ({
    month: point.month,
    deposits: Number(point.depositsMinor) / 100,
    withdrawals: Number(point.withdrawalsMinor) / 100,
    count: point.count,
  }));
  return (
    <div className="space-y-6">
      <DemoBanner />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-mint-400 dark:text-ink-950" to="/app/deposit">Deposit</Link>
          <Link className="rounded-full px-4 py-2 text-sm ring-1 ring-ink-900/10" to="/app/withdraw">Withdraw</Link>
          <Link className="rounded-full px-4 py-2 text-sm ring-1 ring-ink-900/10" to="/app/transfer">Transfer</Link>
          <Link className="rounded-full px-4 py-2 text-sm ring-1 ring-ink-900/10" to="/app/savings">Open savings</Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, amount]) => (
          <Card key={label}><p className="text-sm text-ink-800/60 dark:text-white/60">{label}</p><p className="mt-2 text-2xl font-semibold">{formatCad(amount)}</p></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Balance over 30 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Area dataKey="balance" stroke="#127a4d" fill="#e5f6ec" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Deposits and withdrawals</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity}>
                <XAxis dataKey="month" />
                <Tooltip />
                <Bar dataKey="deposits" fill="#127a4d" />
                <Bar dataKey="withdrawals" fill="#b8894a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">Recent activity</h2>
        <ul className="mt-3 divide-y divide-ink-900/5 dark:divide-white/10">
          {recent.length === 0 ? <li className="py-6 text-sm">No transactions yet. Make a simulated deposit to begin.</li> : recent.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <Link to={`/app/transactions/${tx.id}`} className="font-medium">{tx.description}</Link>
                <p className="text-ink-800/60 dark:text-white/50">{formatWhen(tx.createdAt)}</p>
              </div>
              <div className="text-right">
                <p>{formatCad(tx.amountMinor)}</p>
                <Badge tone={tx.status === 'COMPLETED' ? 'good' : 'bad'}>{tx.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
