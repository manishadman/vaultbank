import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { hashRequest, newReference } from '../lib/tokens.js';
import { publicTransaction } from '../lib/presenter.js';
import { writeAudit, notify } from './auditService.js';

const CUSTOMER_TYPES = new Set(['CHECKING', 'SAVINGS']);

export async function getClearingAccount(db, accountType) {
  const account = await db.account.findFirst({ where: { accountType } });
  if (!account) throw new AppError('CLEARING_MISSING', 'Simulation clearing account is not configured.', 500);
  return account;
}

export async function lockAccounts(db, ids) {
  const unique = [...new Set(ids)].filter(Boolean).sort();
  if (!unique.length) return new Map();
  const rows = await db.$queryRaw`
    SELECT id, "userId", "accountNumber", "accountType"::text AS "accountType",
           currency, status::text AS status, "balanceMinor", name
    FROM "Account"
    WHERE id IN (${Prisma.join(unique)})
    ORDER BY id
    FOR UPDATE
  `;
  if (rows.length !== unique.length) {
    throw new AppError('ACCOUNT_NOT_FOUND', 'One or more accounts were not found.', 404);
  }
  return new Map(rows.map((row) => [row.id, { ...row, balanceMinor: BigInt(row.balanceMinor) }]));
}

function assertCustomerAccount(account, { ownerId, label }) {
  if (!account || !CUSTOMER_TYPES.has(account.accountType)) {
    throw new AppError('ACCOUNT_NOT_FOUND', `${label} was not found.`, 404);
  }
  if (ownerId && account.userId !== ownerId) {
    throw new AppError('FORBIDDEN_ACCOUNT', 'You can only use your own source account.', 403);
  }
  if (account.status !== 'ACTIVE') {
    throw new AppError(
      'ACCOUNT_NOT_ACTIVE',
      `${label} is ${account.status.toLowerCase()} and cannot be used.`,
      409,
      { recordFailure: true },
    );
  }
  if (account.currency !== 'CAD') {
    throw new AppError('CURRENCY_MISMATCH', 'Only CAD accounts are supported.', 422, { recordFailure: true });
  }
}

async function findIdempotent(db, userId, key) {
  if (!key) return null;
  return db.transaction.findFirst({
    where: { initiatedByUserId: userId, idempotencyKey: key },
    include: { entries: { include: { account: true } } },
  });
}

function replay(existing, requestHash) {
  if (existing.requestHash && existing.requestHash !== requestHash) {
    throw new AppError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used with a different request.',
      409,
    );
  }
  if (existing.status === 'FAILED') {
    throw new AppError(existing.failureReason || 'TRANSACTION_FAILED', 'This request previously failed.', 409, {
      transaction: publicTransaction(existing),
    });
  }
  return publicTransaction(existing);
}

async function applyBalance(db, account, direction, amountMinor) {
  if (direction === 'CREDIT') {
    await db.$executeRaw`
      UPDATE "Account"
      SET "balanceMinor" = "balanceMinor" + ${amountMinor}, "updatedAt" = NOW()
      WHERE id = ${account.id}
    `;
    return;
  }
  const clearing = account.accountType.startsWith('CLEARING');
  if (clearing) {
    await db.$executeRaw`
      UPDATE "Account"
      SET "balanceMinor" = "balanceMinor" - ${amountMinor}, "updatedAt" = NOW()
      WHERE id = ${account.id}
    `;
    return;
  }
  const updated = await db.$executeRaw`
    UPDATE "Account"
    SET "balanceMinor" = "balanceMinor" - ${amountMinor}, "updatedAt" = NOW()
    WHERE id = ${account.id} AND "balanceMinor" >= ${amountMinor}
  `;
  if (Number(updated) !== 1) {
    throw new AppError('INSUFFICIENT_FUNDS', 'This account does not have enough available balance.', 422, {
      recordFailure: true,
    });
  }
}

/**
 * Post a completed, balanced transaction.
 * legs: [{ accountId, direction, amountMinor }]
 * Debits and credits must be equal. Customer debits cannot overdraw.
 */
export async function postTransaction({
  type,
  userId,
  description,
  idempotencyKey,
  requestPayload,
  amountMinor,
  legs,
  notifyUser,
  validate,
}) {
  const requestHash = hashRequest(requestPayload);
  const existing = await findIdempotent(prisma, userId, idempotencyKey);
  if (existing) return { replayed: true, transaction: replay(existing, requestHash) };

  try {
    const transaction = await prisma.$transaction(async (db) => {
      const again = await findIdempotent(db, userId, idempotencyKey);
      if (again) return { replayed: true, existing: again };

      const locked = await lockAccounts(
        db,
        legs.map((leg) => leg.accountId),
      );
      if (validate) validate(locked);
      let debit = 0n;
      let credit = 0n;
      for (const leg of legs) {
        if (leg.amountMinor <= 0n) throw new AppError('INVALID_AMOUNT', 'Ledger amounts must be positive.');
        const account = locked.get(leg.accountId);
        if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 'Account was not found.', 404);
        if (leg.direction === 'DEBIT') debit += leg.amountMinor;
        else if (leg.direction === 'CREDIT') credit += leg.amountMinor;
        else throw new AppError('LEDGER_INVALID', 'Ledger direction is invalid.', 500);
      }
      if (debit !== credit || debit !== amountMinor) {
        throw new AppError('LEDGER_UNBALANCED', 'The transaction does not balance.', 500);
      }

      const created = await db.transaction.create({
        data: {
          type,
          status: 'COMPLETED',
          referenceNumber: newReference(),
          description,
          idempotencyKey: idempotencyKey || null,
          requestHash,
          initiatedByUserId: userId,
          amountMinor,
          currency: 'CAD',
          completedAt: new Date(),
          entries: {
            create: legs.map((leg) => ({
              accountId: leg.accountId,
              amountMinor: leg.amountMinor,
              direction: leg.direction,
            })),
          },
        },
        include: { entries: { include: { account: true } } },
      });

      for (const leg of legs) {
        await applyBalance(db, locked.get(leg.accountId), leg.direction, leg.amountMinor);
      }

      await writeAudit(db, {
        actorId: userId,
        action: `transaction.${type.toLowerCase()}`,
        targetType: 'Transaction',
        targetId: created.id,
        metadata: { referenceNumber: created.referenceNumber, amountMinor: amountMinor.toString() },
      });

      if (notifyUser) {
        await notify(db, { userId: notifyUser.userId, title: notifyUser.title, body: notifyUser.body });
      }
      return { replayed: false, existing: created };
    });

    if (transaction.replayed) {
      return { replayed: true, transaction: replay(transaction.existing, requestHash) };
    }
    const fresh = await prisma.transaction.findUnique({
      where: { id: transaction.existing.id },
      include: { entries: { include: { account: true } } },
    });
    return { replayed: false, transaction: publicTransaction(fresh) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await findIdempotent(prisma, userId, idempotencyKey);
      if (raced) return { replayed: true, transaction: replay(raced, requestHash) };
    }
    if (error instanceof AppError && error.recordFailure && idempotencyKey) {
      await recordFailure({
        type,
        userId,
        description,
        idempotencyKey,
        requestHash,
        amountMinor,
        code: error.code,
      });
    }
    throw error;
  }
}

export async function recordFailedAttempt(input) {
  return recordFailure(input);
}

async function recordFailure({ type, userId, description, idempotencyKey, requestHash, amountMinor, code }) {
  try {
    await prisma.transaction.create({
      data: {
        type,
        status: 'FAILED',
        referenceNumber: newReference(),
        description,
        idempotencyKey,
        requestHash,
        initiatedByUserId: userId,
        amountMinor,
        failureReason: code,
        currency: 'CAD',
      },
    });
    await writeAudit(prisma, {
      actorId: userId,
      action: 'transaction.failed',
      targetType: 'Transaction',
      metadata: { type, code, amountMinor: amountMinor.toString() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }
}

export function assertActiveOwned(account, userId, label) {
  assertCustomerAccount(account, { ownerId: userId, label });
}

export function assertActiveDestination(account) {
  assertCustomerAccount(account, { label: 'The destination account' });
}
