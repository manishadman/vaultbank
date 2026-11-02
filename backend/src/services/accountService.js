import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { LIMITS } from '../config/env.js';
import { publicAccount } from '../lib/presenter.js';
import { uniqueAccountNumber } from './authService.js';
import { writeAudit, notify } from './auditService.js';

async function currentSavingsBps(db) {
  const setting = await db.appSetting.findUnique({ where: { key: 'savingsAnnualRateBps' } });
  return setting ? Number(setting.value) : LIMITS.defaultSavingsBps;
}

export async function listMyAccounts(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { savingsSettings: true },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map(publicAccount);
}

export async function getMyAccount(userId, accountId) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    include: { savingsSettings: true },
  });
  if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 'Account was not found.', 404);
  return publicAccount(account);
}

export async function openAccount(userId, { accountType, name }) {
  if (!['CHECKING', 'SAVINGS'].includes(accountType)) {
    throw new AppError('INVALID_ACCOUNT_TYPE', 'Choose checking or savings.');
  }
  const count = await prisma.account.count({ where: { userId } });
  if (count >= LIMITS.maxAccountsPerUser) {
    throw new AppError('ACCOUNT_LIMIT', 'You have reached the maximum number of accounts.', 409);
  }
  const account = await prisma.$transaction(async (db) => {
    const created = await db.account.create({
      data: {
        userId,
        accountNumber: await uniqueAccountNumber(db),
        accountType,
        name: name.trim(),
        currency: 'CAD',
      },
    });
    if (accountType === 'SAVINGS') {
      const bps = await currentSavingsBps(db);
      await db.savingsSettings.create({
        data: { accountId: created.id, annualInterestRateBps: bps },
      });
    }
    await writeAudit(db, {
      actorId: userId,
      action: 'account.open',
      targetType: 'Account',
      targetId: created.id,
      metadata: { accountType },
    });
    await notify(db, {
      userId,
      title: `${accountType === 'SAVINGS' ? 'Savings' : 'Checking'} account opened`,
      body: `${created.name} (${created.accountNumber}) is ready for simulated activity.`,
    });
    return db.account.findUnique({ where: { id: created.id }, include: { savingsSettings: true } });
  });
  return publicAccount(account);
}

export async function getBalance(userId, accountId) {
  const account = await getMyAccount(userId, accountId);
  return { accountId: account.id, currency: account.currency, balanceMinor: account.balanceMinor };
}
