import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { minorToString } from '../lib/money.js';
import { publicAccount, publicTransaction, publicUser } from '../lib/presenter.js';
import { writeAudit } from './auditService.js';
import { utcDateOnly } from '../lib/interest.js';

export async function adminDashboard() {
  const [customers, accounts, deposit, withdrawal, transfer, recent] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.account.count({ where: { accountType: { in: ['CHECKING', 'SAVINGS'] }, status: 'ACTIVE' } }),
    prisma.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amountMinor: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'COMPLETED' }, _sum: { amountMinor: true } }),
    prisma.transaction.aggregate({ where: { type: 'TRANSFER', status: 'COMPLETED' }, _sum: { amountMinor: true } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { entries: { include: { account: true } } },
    }),
  ]);
  return {
    customers,
    activeAccounts: accounts,
    depositsMinor: minorToString(deposit._sum.amountMinor || 0n),
    withdrawalsMinor: minorToString(withdrawal._sum.amountMinor || 0n),
    transferVolumeMinor: minorToString(transfer._sum.amountMinor || 0n),
    recent: recent.map(publicTransaction),
  };
}

export async function listCustomers(query) {
  const where = {
    role: 'CUSTOMER',
    OR: query.q
      ? [
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ]
      : undefined,
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { accounts: true },
    }),
  ]);
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: users.map((user) => ({
      ...publicUser(user),
      accounts: user.accounts.length,
      balanceMinor: minorToString(user.accounts.reduce((sum, account) => sum + account.balanceMinor, 0n)),
    })),
  };
}

export async function getCustomer(id) {
  const user = await prisma.user.findFirst({
    where: { id, role: 'CUSTOMER' },
    include: { accounts: { include: { savingsSettings: true } } },
  });
  if (!user) throw new AppError('NOT_FOUND', 'Customer was not found.', 404);
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ initiatedByUserId: id }, { entries: { some: { account: { userId: id } } } }],
    },
    include: { entries: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  return {
    user: publicUser(user),
    accounts: user.accounts.map(publicAccount),
    transactions: transactions.map(publicTransaction),
  };
}

async function setStatus(actorId, accountId, status) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.accountType.startsWith('CLEARING')) {
    throw new AppError('ACCOUNT_NOT_FOUND', 'Account was not found.', 404);
  }
  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { status },
    include: { savingsSettings: true },
  });
  await writeAudit(prisma, {
    actorId,
    action: status === 'FROZEN' ? 'account.freeze' : 'account.unfreeze',
    targetType: 'Account',
    targetId: accountId,
    metadata: { previous: account.status, next: status },
  });
  return publicAccount(updated);
}

export function freezeAccount(actorId, accountId) {
  return setStatus(actorId, accountId, 'FROZEN');
}

export function unfreezeAccount(actorId, accountId) {
  return setStatus(actorId, accountId, 'ACTIVE');
}

export async function listAdminTransactions(query) {
  const where = {
    type: query.type,
    status: query.status,
    createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    AND: query.q
      ? {
          OR: [
            { referenceNumber: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
            { failureReason: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : undefined,
  };
  const [total, rows] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { entries: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { page: query.page, pageSize: query.pageSize, total, items: rows.map(publicTransaction) };
}

export async function listAudit(query) {
  const where = {
    action: query.action ? { contains: query.action, mode: 'insensitive' } : undefined,
  };
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor: row.actor ? { id: row.actor.id, email: row.actor.email, fullName: row.actor.fullName } : null,
    })),
  };
}

export async function listAdminAccounts(query) {
  const where = {
    accountType: { in: ['CHECKING', 'SAVINGS'] },
    status: query.status,
    OR: query.q
      ? [
          { accountNumber: { contains: query.q } },
          { name: { contains: query.q, mode: 'insensitive' } },
          { user: { email: { contains: query.q, mode: 'insensitive' } } },
        ]
      : undefined,
  };
  const accounts = await prisma.account.findMany({
    where,
    include: { user: true, savingsSettings: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return accounts.map((account) => ({
    ...publicAccount(account),
    owner: account.user ? { id: account.user.id, fullName: account.user.fullName, email: account.user.email } : null,
  }));
}

export async function updateInterestRate(actorId, annualInterestRateBps, note) {
  if (annualInterestRateBps < 0 || annualInterestRateBps > 2000) {
    throw new AppError('INVALID_RATE', 'Rate must be between 0 and 2000 basis points.');
  }
  await prisma.$transaction(async (db) => {
    await db.appSetting.upsert({
      where: { key: 'savingsAnnualRateBps' },
      update: { value: String(annualInterestRateBps) },
      create: { key: 'savingsAnnualRateBps', value: String(annualInterestRateBps) },
    });
    await db.interestRateHistory.create({
      data: {
        annualInterestRateBps,
        effectiveFrom: utcDateOnly(new Date()),
        createdById: actorId,
        note: note || null,
      },
    });
    await db.savingsSettings.updateMany({ data: { annualInterestRateBps } });
    await writeAudit(db, {
      actorId,
      action: 'interest.rate_update',
      targetType: 'InterestRate',
      metadata: { annualInterestRateBps, note: note || null },
    });
  });
  return getInterestSettings();
}

export async function getInterestSettings() {
  const [current, history] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'savingsAnnualRateBps' } }),
    prisma.interestRateHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return {
    annualInterestRateBps: current ? Number(current.value) : 250,
    method: 'ACT_365',
    history,
  };
}
