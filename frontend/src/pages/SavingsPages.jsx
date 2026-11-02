import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage } from '../services/api.js';
import { bpsToPercent, formatCad } from '../lib/money.js';
import { Button, Card, DemoBanner, Empty, Field, inputClass, useAsync } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function SavingsPage() {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const state = useAsync(() => api.get('/savings').then((response) => response.data.items), [version]);
  const [projection, setProjection] = useState(null);
  async function openSavings() {
    try {
      await api.post('/savings', { accountType: 'SAVINGS', name: 'Growth Savings' });
      toast.push('Savings account opened.');
      setVersion((value) => value + 1);
    } catch (error) {
      toast.push(errorMessage(error), 'error');
    }
  }
  return (
    <div className="space-y-4">
      <DemoBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Savings</h1>
        <Button onClick={openSavings}>Open savings</Button>
      </div>
      {state.loading ? <p>Loading…</p> : state.data?.length ? state.data.map((account) => (
        <Card key={account.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{account.name}</h2>
              <p className="text-sm">{account.accountNumber}</p>
              <p className="mt-2 text-3xl">{formatCad(account.balanceMinor)}</p>
              <p className="mt-1 text-sm">Rate {bpsToPercent(account.annualInterestRateBps)} · accrued, not yet posted {formatCad(account.unpostedInterestMinor)}</p>
            </div>
            <Button variant="quiet" onClick={async () => {
              const response = await api.get(`/savings/${account.id}/projections`, { params: { years: 3 } });
              const history = await api.get(`/savings/${account.id}/interest`);
              setProjection({ account, ...response.data, history: history.data.items });
            }}>View projection</Button>
          </div>
        </Card>
      )) : <Empty title="No savings account" body="Open one to start daily accrual." />}
      {projection ? (
        <Card>
          <h2 className="font-semibold">Estimate for {projection.account.name}</h2>
          <p className="text-sm">{projection.projection.disclaimer}</p>
          <p className="mt-2">Projected balance {formatCad(projection.projection.projectedFinalMinor)} · estimated interest {formatCad(projection.projection.estimatedInterestMinor)}</p>
          <h3 className="mt-4 font-semibold">Posted interest</h3>
          {projection.history.length === 0 ? <p className="text-sm">No interest has been posted yet.</p> : projection.history.map((tx) => (
            <p key={tx.id} className="text-sm">{formatCad(tx.amountMinor)} · {tx.referenceNumber}</p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

export function CalculatorPage() {
  const { register, handleSubmit } = useForm({
    defaultValues: { initialDeposit: '1000.00', monthlyContribution: '100.00', annualInterestRateBps: 250, years: 5 },
  });
  const [result, setResult] = useState(null);
  async function onSubmit(values) {
    const response = await api.post('/savings/calculate', {
      ...values,
      annualInterestRateBps: Number(values.annualInterestRateBps),
      years: Number(values.years),
    });
    setResult(response.data);
  }
  const chart = (result?.points || []).map((point) => ({ month: point.month, balance: Number(point.balanceMinor) / 100 }));
  return (
    <div className="space-y-4">
      <DemoBanner />
      <h1 className="text-3xl font-semibold">Savings calculator</h1>
      <Card>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Initial deposit"><input className={inputClass} {...register('initialDeposit')} /></Field>
          <Field label="Monthly contribution"><input className={inputClass} {...register('monthlyContribution')} /></Field>
          <Field label="Annual rate (basis points)"><input className={inputClass} type="number" {...register('annualInterestRateBps')} /></Field>
          <Field label="Years"><input className={inputClass} type="number" {...register('years')} /></Field>
          <Button type="submit">Estimate</Button>
        </form>
      </Card>
      {result ? (
        <Card>
          <p className="text-sm">{result.disclaimer}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <p>Contributions<br /><strong>{formatCad(result.totalContributionsMinor)}</strong></p>
            <p>Estimated interest<br /><strong>{formatCad(result.estimatedInterestMinor)}</strong></p>
            <p>Projected balance<br /><strong>{formatCad(result.projectedFinalMinor)}</strong></p>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line dataKey="balance" stroke="#127a4d" dot={false} /></LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
