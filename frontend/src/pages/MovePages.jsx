import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '../services/api.js';
import { formatCad, newIdempotencyKey } from '../lib/money.js';
import { amountSchema } from '../lib/schemas.js';
import { Button, Card, DemoBanner, Field, inputClass, Modal, useAsync } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

function MoneyFlow({ title, kind }) {
  const toast = useToast();
  const accounts = useAsync(() => api.get('/accounts').then((response) => response.data.items), []);
  const [draft, setDraft] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const schema = z.object({
    accountId: z.string().min(1, 'Choose an account.'),
    amount: amountSchema,
    description: z.string().max(140).optional(),
  });
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema) });
  async function confirm() {
    try {
      const path = kind === 'deposit' ? '/transactions/deposit' : '/transactions/withdraw';
      const response = await api.post(path, draft, { headers: { 'Idempotency-Key': newIdempotencyKey() } });
      setReceipt(response.data.transaction);
      setDraft(null);
      toast.push('Simulated transaction posted.');
    } catch (error) {
      toast.push(errorMessage(error), 'error');
      setDraft(null);
    }
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DemoBanner />
      <h1 className="text-3xl font-semibold">{title}</h1>
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(setDraft)} noValidate>
          <Field label="Account" error={formState.errors.accountId?.message}>
            <select className={inputClass} {...register('accountId')}>
              <option value="">Select</option>
              {(accounts.data || []).map((account) => (
                <option key={account.id} value={account.id}>{account.name} · {account.accountNumber} · {formatCad(account.balanceMinor)}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount (CAD)" error={formState.errors.amount?.message}>
            <input className={inputClass} inputMode="decimal" placeholder="25.00" {...register('amount')} />
          </Field>
          <Field label="Description" error={formState.errors.description?.message}>
            <input className={inputClass} {...register('description')} />
          </Field>
          <Button type="submit">Review</Button>
        </form>
      </Card>
      {draft ? (
        <Modal
          title={`Confirm simulated ${kind}`}
          body={`${draft.amount} CAD will be ${kind === 'deposit' ? 'credited to' : 'debited from'} the selected account. No real money moves.`}
          confirmLabel="Confirm"
          onConfirm={confirm}
          onClose={() => setDraft(null)}
        />
      ) : null}
      {receipt ? (
        <Card>
          <h2 className="font-semibold">Receipt</h2>
          <p className="mt-2 text-sm">Reference {receipt.referenceNumber}</p>
          <p className="text-2xl font-semibold">{formatCad(receipt.amountMinor)}</p>
          <p className="text-sm">{receipt.status} · simulated</p>
        </Card>
      ) : null}
    </div>
  );
}

export function DepositPage() {
  return <MoneyFlow title="Deposit simulated funds" kind="deposit" />;
}

export function WithdrawPage() {
  return <MoneyFlow title="Withdraw simulated funds" kind="withdraw" />;
}

export function TransferPage() {
  const toast = useToast();
  const accounts = useAsync(() => api.get('/accounts').then((response) => response.data.items), []);
  const [draft, setDraft] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const schema = z.object({
    sourceAccountId: z.string().min(1, 'Choose a source account.'),
    destinationAccountNumber: z.string().regex(/^\d{10}$/, 'Enter a 10-digit account number.'),
    amount: amountSchema,
    description: z.string().max(140).optional(),
  });
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(schema) });
  async function confirm() {
    try {
      const response = await api.post('/transactions/transfer', draft, { headers: { 'Idempotency-Key': newIdempotencyKey() } });
      setReceipt(response.data.transaction);
      setDraft(null);
      toast.push('Transfer posted.');
    } catch (error) {
      toast.push(errorMessage(error), 'error');
      setDraft(null);
    }
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DemoBanner />
      <h1 className="text-3xl font-semibold">Transfer</h1>
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(setDraft)} noValidate>
          <Field label="From" error={formState.errors.sourceAccountId?.message}>
            <select className={inputClass} {...register('sourceAccountId')}>
              <option value="">Select</option>
              {(accounts.data || []).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.accountNumber}</option>)}
            </select>
          </Field>
          <Field label="To account number" error={formState.errors.destinationAccountNumber?.message}>
            <input className={inputClass} {...register('destinationAccountNumber')} />
          </Field>
          <Field label="Amount (CAD)" error={formState.errors.amount?.message}>
            <input className={inputClass} {...register('amount')} />
          </Field>
          <Field label="Description"><input className={inputClass} {...register('description')} /></Field>
          <Button type="submit">Review</Button>
        </form>
      </Card>
      {draft ? <Modal title="Confirm transfer" body={`Send ${draft.amount} CAD to ${draft.destinationAccountNumber}. This cannot be partially applied.`} confirmLabel="Transfer" onConfirm={confirm} onClose={() => setDraft(null)} /> : null}
      {receipt ? <Card><h2 className="font-semibold">Receipt</h2><p>{receipt.referenceNumber}</p><p className="text-2xl">{formatCad(receipt.amountMinor)}</p></Card> : null}
    </div>
  );
}
