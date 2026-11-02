import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api, errorMessage } from '../services/api.js';
import { bpsToPercent, formatCad } from '../lib/money.js';
import { Badge, Button, Card, Empty, Field, inputClass, Skeleton, useAsync } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function AccountsPage() {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const state = useAsync(() => api.get('/accounts').then((response) => response.data.items), [version]);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { accountType: 'SAVINGS', name: 'Growth Savings' } });
  async function onSubmit(values) {
    try {
      await api.post('/accounts', values);
      toast.push('Account opened.');
      reset();
      setVersion((value) => value + 1);
    } catch (error) {
      toast.push(errorMessage(error), 'error');
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">My accounts</h1>
      {state.loading ? <Skeleton /> : state.error ? <p>{state.error}</p> : state.data.length === 0 ? <Empty title="No accounts" body="Open a checking or savings account." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.data.map((account) => (
            <Link key={account.id} to={`/app/accounts/${account.id}`}>
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-ink-800/60 dark:text-white/60">{account.name}</p>
                    <p className="text-2xl font-semibold">{formatCad(account.balanceMinor)}</p>
                    <p className="mt-1 text-sm">{account.accountNumber}</p>
                  </div>
                  <Badge tone={account.status === 'ACTIVE' ? 'good' : 'bad'}>{account.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Card>
        <h2 className="font-semibold">Open an account</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Type"><select className={inputClass} {...register('accountType')}><option value="CHECKING">Checking</option><option value="SAVINGS">Savings</option></select></Field>
          <Field label="Name"><input className={inputClass} {...register('name', { required: true })} /></Field>
          <Button className="self-end" type="submit">Open</Button>
        </form>
      </Card>
    </div>
  );
}

export function AccountDetailPage() {
  const { id } = useParams();
  const state = useAsync(async () => {
    const [account, activity] = await Promise.all([
      api.get(`/accounts/${id}`),
      api.get('/transactions', { params: { pageSize: 20 } }),
    ]);
    return {
      account: account.data.account,
      items: activity.data.items.filter((tx) => tx.entries.some((entry) => entry.accountId === id)),
    };
  }, [id]);
  if (state.loading) return <Skeleton />;
  if (state.error) return <p>{state.error}</p>;
  const { account, items } = state.data;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{account.name}</h1>
      <Card>
        <p className="text-sm">{account.accountType} · {account.accountNumber}</p>
        <p className="mt-2 text-4xl font-semibold">{formatCad(account.balanceMinor)}</p>
        <p className="mt-2"><Badge tone={account.status === 'ACTIVE' ? 'good' : 'bad'}>{account.status}</Badge></p>
        {account.annualInterestRateBps != null ? <p className="mt-3 text-sm">Rate {bpsToPercent(account.annualInterestRateBps)} · unposted interest {formatCad(account.unpostedInterestMinor)}</p> : null}
      </Card>
      <Card>
        <h2 className="font-semibold">Related activity</h2>
        {items.length === 0 ? <p className="mt-3 text-sm">No activity on this account yet.</p> : items.map((tx) => (
          <Link key={tx.id} to={`/app/transactions/${tx.id}`} className="mt-3 flex justify-between text-sm">
            <span>{tx.description}</span><span>{formatCad(tx.amountMinor)}</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
