import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { LIMITS } from '../config/env.js';
import { assertLimit, formatCad, parseAmountToMinor } from '../lib/money.js';
import { publicTransaction } from '../lib/presenter.js';
import {
  assertActiveDestination,
  assertActiveOwned,
  getClearingAccount,
  postTransaction,
  } from './ledgerService.js';
import { notify } from './auditService.js';

async function ownedAccount(userId, accountId) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 'Account was not found.', 404);
  return account;
}

export async function deposit({ userId, accountId, amount, description, idempotencyKey }) {
  const amountMinor = parseAmountToMinor(amount);
  assertLimit(amountMinor, LIMITS.maxDepositMinor, 'Deposit');
  const account = await ownedAccount(userId, accountId);
  const clearing = await getClearingAccount(prisma, 'CLEARING_CASH');
  const note = (description || 'Simulated deposit').trim();
  const requestPayload = { type: 'DEPOSIT', accountId, amountMinor: amountMinor.toString(), description: note };
  const result = await postTransaction({
    type: 'DEPOSIT',
    userId,
    description: note,
    idempotencyKey,
    amountMinor,
    requestPayload,
    validate: (locked) => assertActiveOwned(locked.get(account.id), userId, 'The destination account'),
    legs: [
      { accountId: clearing.id, direction: 'DEBIT', amountMinor },
      { accountId: account.id, direction: 'CREDIT', amountMinor },
    ],
    notifyUser: {
      userId,
      title: 'Simulated deposit posted',
      body: `${formatCad(amountMinor)} was added to ${account.name}. No real money moved.`,
    },
  });
  return result;
}

export async function withdraw({ userId, accountId, amount, description, idempotencyKey }) {
  const amountMinor = parseAmountToMinor(amount);
  assertLimit(amountMinor, LIMITS.maxWithdrawalMinor, 'Withdrawal');
  const account = await ownedAccount(userId, accountId);
  const clearing = await getClearingAccount(prisma, 'CLEARING_CASH');
  const note = (description || 'Simulated withdrawal').trim();
  const requestPayload = { type: 'WITHDRAWAL', accountId, amountMinor: amountMinor.toString(), description: note };
  return postTransaction({
    type: 'WITHDRAWAL',
    userId,
    description: note,
    idempotencyKey,
    amountMinor,
    requestPayload,
    validate: (locked) => assertActiveOwned(locked.get(account.id), userId, 'The source account'),
    legs: [
      { accountId: account.id, direction: 'DEBIT', amountMinor },
      { accountId: clearing.id, direction: 'CREDIT', amountMinor },
    ],
    notifyUser: {
      userId,
      title: 'Simulated withdrawal posted',
      body: `${formatCad(amountMinor)} was withdrawn from ${account.name}. No real money moved.`,
    },
  });
}

export async function transfer({ userId, sourceAccountId, destinationAccountNumber, amount, description, idempotencyKey }) {
  const amountMinor = parseAmountToMinor(amount);
  assertLimit(amountMinor, LIMITS.maxTransferMinor, 'Transfer');
  const source = await ownedAccount(userId, sourceAccountId);
  const destination = await prisma.account.findUnique({
    where: { accountNumber: destinationAccountNumber.trim() },
  });
  if (!destination) throw new AppError('ACCOUNT_NOT_FOUND', 'The destination account was not found.', 404);
  if (destination.id === source.id) {
    throw new AppError('SAME_ACCOUNT', 'Choose two different accounts.');
  }
  const note = (description || 'Simulated transfer').trim();
  const requestPayload = {
    type: 'TRANSFER',
    sourceAccountId,
    destinationAccountNumber: destination.accountNumber,
    amountMinor: amountMinor.toString(),
    description: note,
  };
  const result = await postTransaction({
    type: 'TRANSFER',
    userId,
    description: note,
    idempotencyKey,
    amountMinor,
    requestPayload,
    validate: (locked) => {
      assertActiveOwned(locked.get(source.id), userId, 'The source account');
      assertActiveDestination(locked.get(destination.id));
    },
    legs: [
      { accountId: source.id, direction: 'DEBIT', amountMinor },
      { accountId: destination.id, direction: 'CREDIT', amountMinor },
    ],
    notifyUser: {
      userId,
      title: 'Transfer posted',
      body: `${formatCad(amountMinor)} moved from ${source.name} to account ${destination.accountNumber}.`,
    },
  });
  if (destination.userId && destination.userId !== userId) {
    await notify(prisma, {
      userId: destination.userId,
      title: 'Transfer received',
      body: `${formatCad(amountMinor)} was credited to ${destination.name}. This is simulated money.`,
    });
  }
  return result;
}

export async function listTransactions(userId, query) {
  const page = query.page;
  const pageSize = query.pageSize;
  const where = {
    status: query.status,
    type: query.type,
    OR: [
      { initiatedByUserId: userId },
      { entries: { some: { account: { userId } } } },
    ],
    createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    AND: query.q
      ? {
          OR: [
            { referenceNumber: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : undefined,
  };
  const orderBy =
    query.sort === 'amount'
      ? { amountMinor: query.direction === 'asc' ? 'asc' : 'desc' }
      : { createdAt: query.direction === 'asc' ? 'asc' : 'desc' };
  const [total, rows] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { entries: { include: { account: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    page,
    pageSize,
    total,
    items: rows.map(publicTransaction),
  };
}

export async function getTransaction(userId, id, role) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { entries: { include: { account: true } } },
  });
  if (!tx) throw new AppError('NOT_FOUND', 'Transaction was not found.', 404);
  if (role !== 'ADMIN') {
    const owns =
      tx.initiatedByUserId === userId || tx.entries.some((entry) => entry.account.userId === userId);
    if (!owns) throw new AppError('FORBIDDEN', 'You cannot view this transaction.', 403);
  }
  return publicTransaction(tx);
}

export async function listForStatement(userId, query) {
  const result = await listTransactions(userId, { ...query, page: 1, pageSize: 500 });
  return result.items;
}
