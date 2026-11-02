import { minorToString } from './money.js';

export function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export function publicAccount(account) {
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    currency: account.currency,
    status: account.status,
    name: account.name,
    balanceMinor: minorToString(account.balanceMinor),
    createdAt: account.createdAt,
    annualInterestRateBps: account.savingsSettings?.annualInterestRateBps ?? null,
    unpostedInterestMinor: account.savingsSettings
      ? minorToString(unpostedCents(account.savingsSettings.accrualNumerator))
      : null,
  };
}

function unpostedCents(numerator) {
  const value = typeof numerator === 'bigint' ? numerator : BigInt(numerator || 0);
  return value / 365n / 10_000n;
}

export function publicTransaction(tx) {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    referenceNumber: tx.referenceNumber,
    description: tx.description,
    currency: tx.currency,
    amountMinor: minorToString(tx.amountMinor),
    failureReason: tx.failureReason,
    createdAt: tx.createdAt,
    completedAt: tx.completedAt,
    entries: (tx.entries || []).map((entry) => ({
      id: entry.id,
      accountId: entry.accountId,
      accountNumber: entry.account?.accountNumber ?? null,
      accountName: entry.account?.name ?? null,
      direction: entry.direction,
      amountMinor: minorToString(entry.amountMinor),
    })),
  };
}
