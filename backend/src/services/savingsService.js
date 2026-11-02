import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { formatCad, minorToString, parseAmountToMinor } from '../lib/money.js';
import {
  addUtcDays,
  dailyNumerator,
  eachUtcDay,
  isMonthEnd,
  numeratorAfterPosting,
  projectSavings,
  utcDateOnly,
  wholeCentsFromNumerator,
} from '../lib/interest.js';
import { getClearingAccount, postTransaction } from './ledgerService.js';
import { publicAccount } from '../lib/presenter.js';

export function calculateProjection(input) {
  const initialMinor = parseAmountToMinor(input.initialDeposit);
  const monthlyMinor = input.monthlyContribution
    ? parseAmountToMinor(input.monthlyContribution)
    : 0n;
  const years = input.years;
  if (input.annualInterestRateBps < 0 || input.annualInterestRateBps > 2000) {
    throw new AppError('INVALID_RATE', 'Interest rate must be between 0 and 20.00%.');
  }
  return projectSavings({
    initialMinor,
    monthlyMinor,
    annualRateBps: input.annualInterestRateBps,
    years,
  });
}

export async function listSavings(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId, accountType: 'SAVINGS' },
    include: { savingsSettings: true },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map(publicAccount);
}

export async function projectAccount(userId, accountId, years = 1) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, accountType: 'SAVINGS' },
    include: { savingsSettings: true },
  });
  if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 'Savings account was not found.', 404);
  const projection = projectSavings({
    initialMinor: account.balanceMinor,
    monthlyMinor: 0n,
    annualRateBps: account.savingsSettings.annualInterestRateBps,
    years,
  });
  return {
    accountId: account.id,
    annualInterestRateBps: account.savingsSettings.annualInterestRateBps,
    method: account.savingsSettings.interestCalculationMethod,
    currentBalanceMinor: minorToString(account.balanceMinor),
    unpostedInterestMinor: minorToString(wholeCentsFromNumerator(account.savingsSettings.accrualNumerator)),
    projection,
  };
}

async function postInterest(db, account, settings, postedCents) {
  const clearing = await getClearingAccount(db, 'CLEARING_INTEREST');
  const amountMinor = postedCents;
  const userId = account.userId;
  await postInterestLocked(db, {
    userId,
    account,
    clearing,
    amountMinor,
  });
  await db.savingsSettings.update({
    where: { id: settings.id },
    data: { accrualNumerator: numeratorAfterPosting(settings.accrualNumerator, postedCents) },
  });
  settings.accrualNumerator = numeratorAfterPosting(settings.accrualNumerator, postedCents);
}

async function postInterestLocked(db, { userId, account, clearing, amountMinor }) {
  const { newReference } = await import('../lib/tokens.js');
  const { writeAudit, notify } = await import('./auditService.js');
  const lockedClearing = await db.$queryRaw`
    SELECT id FROM "Account" WHERE id = ${clearing.id} FOR UPDATE
  `;
  if (!lockedClearing.length) throw new AppError('CLEARING_MISSING', 'Interest clearing account is missing.', 500);
  const created = await db.transaction.create({
    data: {
      type: 'INTEREST',
      status: 'COMPLETED',
      referenceNumber: newReference(),
      description: 'Posted savings interest (simulated)',
      initiatedByUserId: userId,
      amountMinor,
      currency: 'CAD',
      completedAt: new Date(),
      entries: {
        create: [
          { accountId: clearing.id, direction: 'DEBIT', amountMinor },
          { accountId: account.id, direction: 'CREDIT', amountMinor },
        ],
      },
    },
  });
  await db.$executeRaw`
    UPDATE "Account" SET "balanceMinor" = "balanceMinor" - ${amountMinor}, "updatedAt" = NOW()
    WHERE id = ${clearing.id}
  `;
  await db.$executeRaw`
    UPDATE "Account" SET "balanceMinor" = "balanceMinor" + ${amountMinor}, "updatedAt" = NOW()
    WHERE id = ${account.id}
  `;
  await writeAudit(db, {
    actorId: userId,
    action: 'transaction.interest',
    targetType: 'Transaction',
    targetId: created.id,
    metadata: { amountMinor: amountMinor.toString() },
  });
  await notify(db, {
    userId,
    title: 'Interest posted',
    body: `${formatCad(amountMinor)} of simulated interest was posted to ${account.name}.`,
  });
}

export async function accrueSavingsAccount(accountId, asOf = new Date()) {
  return prisma.$transaction(async (db) => {
    const rows = await db.$queryRaw`
      SELECT a.id, a."userId", a.name, a."balanceMinor", a."createdAt", a.status::text AS status,
             s.id AS "settingsId", s."annualInterestRateBps", s."lastAccrualDate", s."accrualNumerator"
      FROM "Account" a
      JOIN "SavingsSettings" s ON s."accountId" = a.id
      WHERE a.id = ${accountId}
      FOR UPDATE
    `;
    if (!rows.length) throw new AppError('ACCOUNT_NOT_FOUND', 'Savings account was not found.', 404);
    const row = rows[0];
    if (row.status !== 'ACTIVE') return { accruedDays: 0, postedMinor: '0' };
    const opened = utcDateOnly(row.createdAt);
    const start = row.lastAccrualDate ? utcDateOnly(row.lastAccrualDate) : addUtcDays(opened, -1);
    const yesterday = addUtcDays(utcDateOnly(asOf), -1);
    const days = eachUtcDay(start, yesterday);
    let numerator = BigInt(row.accrualNumerator);
    let balance = BigInt(row.balanceMinor);
    let posted = 0n;
    let last = row.lastAccrualDate ? utcDateOnly(row.lastAccrualDate) : null;
    for (const day of days) {
      numerator += dailyNumerator(balance, row.annualInterestRateBps);
      last = day;
      if (isMonthEnd(day)) {
        const whole = wholeCentsFromNumerator(numerator);
        if (whole > 0n) {
          const settings = { id: row.settingsId, accrualNumerator: numerator };
          const account = { id: row.id, userId: row.userId, name: row.name };
          await postInterest(db, account, settings, whole);
          numerator = settings.accrualNumerator;
          posted += whole;
          balance += whole;
        }
      }
    }
    await db.savingsSettings.update({
      where: { id: row.settingsId },
      data: { accrualNumerator: numerator, lastAccrualDate: last },
    });
    return { accruedDays: days.length, postedMinor: posted.toString() };
  });
}

export async function accrueAllForUser(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId, accountType: 'SAVINGS', status: 'ACTIVE' },
    select: { id: true },
  });
  const results = [];
  for (const account of accounts) {
    results.push({ accountId: account.id, ...(await accrueSavingsAccount(account.id)) });
  }
  return results;
}

export async function interestHistory(userId, accountId) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 'Account was not found.', 404);
  return prisma.transaction.findMany({
    where: { type: 'INTEREST', status: 'COMPLETED', entries: { some: { accountId } } },
    orderBy: { createdAt: 'desc' },
    include: { entries: { include: { account: true } } },
  });
}

export { postTransaction };
