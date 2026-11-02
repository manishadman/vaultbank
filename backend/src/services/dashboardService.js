import { prisma } from '../lib/prisma.js';
import { minorToString } from '../lib/money.js';
import { publicTransaction } from '../lib/presenter.js';
import { accrueAllForUser } from './savingsService.js';

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function customerDashboard(userId) {
  await accrueAllForUser(userId);
  const accounts = await prisma.account.findMany({ where: { userId }, include: { savingsSettings: true } });
  const ids = accounts.map((account) => account.id);
  const recent = await prisma.transaction.findMany({
    where: {
      OR: [{ initiatedByUserId: userId }, { entries: { some: { accountId: { in: ids } } } }],
    },
    include: { entries: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const start = monthStart();
  const monthTx = await prisma.transaction.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: start },
      OR: [{ initiatedByUserId: userId }, { entries: { some: { accountId: { in: ids } } } }],
    },
  });
  const sumType = (type) =>
    monthTx.filter((tx) => tx.type === type && tx.initiatedByUserId === userId).reduce((total, tx) => total + tx.amountMinor, 0n);

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId: { in: ids } },
    orderBy: { createdAt: 'asc' },
  });
  const balanceSeries = buildBalanceSeries(entries, 30);
  const activity = buildActivity(monthTx);

  const checking = accounts.filter((a) => a.accountType === 'CHECKING').reduce((t, a) => t + a.balanceMinor, 0n);
  const savings = accounts.filter((a) => a.accountType === 'SAVINGS').reduce((t, a) => t + a.balanceMinor, 0n);

  return {
    simulated: true,
    currency: 'CAD',
    totals: {
      totalMinor: minorToString(checking + savings),
      checkingMinor: minorToString(checking),
      savingsMinor: minorToString(savings),
      depositsThisMonthMinor: minorToString(sumType('DEPOSIT')),
      withdrawalsThisMonthMinor: minorToString(sumType('WITHDRAWAL')),
    },
    balanceSeries,
    monthlyActivity: activity,
    recent: recent.map(publicTransaction),
  };
}

function buildBalanceSeries(entries, days) {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  let running = 0n;
  let index = 0;
  const points = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start.getTime() + i * 86_400_000);
    const next = new Date(day.getTime() + 86_400_000);
    while (index < entries.length && entries[index].createdAt < next) {
      const entry = entries[index];
      running += entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
      index += 1;
    }
    points.push({ date: day.toISOString().slice(0, 10), balanceMinor: running.toString() });
  }
  return points;
}

function buildActivity(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const key = tx.createdAt.toISOString().slice(0, 7);
    if (!map.has(key)) map.set(key, { month: key, depositsMinor: 0n, withdrawalsMinor: 0n, count: 0 });
    const row = map.get(key);
    row.count += 1;
    if (tx.type === 'DEPOSIT') row.depositsMinor += tx.amountMinor;
    if (tx.type === 'WITHDRAWAL') row.withdrawalsMinor += tx.amountMinor;
  }
  return [...map.values()].map((row) => ({
    month: row.month,
    depositsMinor: row.depositsMinor.toString(),
    withdrawalsMinor: row.withdrawalsMinor.toString(),
    count: row.count,
  }));
}
