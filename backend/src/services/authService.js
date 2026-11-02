import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { hashToken, newAccountNumber, newRefreshToken, signAccessToken } from '../lib/tokens.js';
import { publicUser } from '../lib/presenter.js';
import { writeAudit, notify } from './auditService.js';

const GENERIC = 'Invalid email or password.';

async function uniqueAccountNumber(db) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const accountNumber = newAccountNumber();
    const existing = await db.account.findUnique({ where: { accountNumber } });
    if (!existing) return accountNumber;
  }
  throw new AppError('ACCOUNT_NUMBER', 'Could not allocate an account number.', 500);
}

export async function registerUser({ fullName, email, password }) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new AppError('EMAIL_IN_USE', 'An account with this email already exists.', 409);
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await prisma.$transaction(async (db) => {
    const created = await db.user.create({
      data: { fullName: fullName.trim(), email: normalized, passwordHash, role: 'CUSTOMER' },
    });
    await db.account.create({
      data: {
        userId: created.id,
        accountNumber: await uniqueAccountNumber(db),
        accountType: 'CHECKING',
        name: 'Everyday Checking',
        currency: 'CAD',
      },
    });
    await notify(db, {
      userId: created.id,
      title: 'Welcome to VaultBank',
      body: 'Your simulated checking account is open. Deposits here are not real money.',
    });
    await writeAudit(db, {
      actorId: created.id,
      action: 'user.register',
      targetType: 'User',
      targetId: created.id,
    });
    return created;
  });
  return issueSession(user);
}

export async function loginUser({ email, password, userAgent, ip }) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  const hash = user?.passwordHash || '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const match = await bcrypt.compare(password, hash);
  if (!user || !match) {
    throw new AppError('INVALID_CREDENTIALS', GENERIC, 401);
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('ACCOUNT_SUSPENDED', 'This profile is not active.', 403);
  }
  await writeAudit(prisma, {
    actorId: user.id,
    action: 'user.login',
    targetType: 'User',
    targetId: user.id,
  });
  return issueSession(user, { userAgent, ip });
}

async function issueSession(user, meta = {}) {
  const refresh = newRefreshToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 86_400_000);
  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refresh),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 200) || null,
      ip: meta.ip?.slice(0, 64) || null,
    },
  });
  return {
    accessToken: signAccessToken(user),
    refreshToken: refresh,
    user: publicUser(user),
  };
}

export async function rotateRefresh(rawToken, meta = {}) {
  if (!rawToken) throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  const tokenHash = hashToken(rawToken);
  return prisma.$transaction(async (db) => {
    const session = await db.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
    }
    if (session.user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_SUSPENDED', 'This profile is not active.', 403);
    }
    const refresh = newRefreshToken();
    const created = await db.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + env.refreshTokenDays * 86_400_000),
        userAgent: meta.userAgent?.slice(0, 200) || null,
        ip: meta.ip?.slice(0, 64) || null,
      },
    });
    await db.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
    return {
      accessToken: signAccessToken(session.user),
      refreshToken: refresh,
      user: publicUser(session.user),
    };
  });
}

export async function revokeRefresh(rawToken) {
  if (!rawToken) return;
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('UNAUTHORIZED', 'Authentication required.', 401);
  return publicUser(user);
}

export async function updateProfile(userId, { fullName }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { fullName: fullName.trim() },
  });
  await writeAudit(prisma, {
    actorId: userId,
    action: 'user.profile_update',
    targetType: 'User',
    targetId: userId,
  });
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect.', 401);
  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await prisma.$transaction(async (db) => {
    await db.user.update({ where: { id: userId }, data: { passwordHash } });
    await db.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(db, {
      actorId: userId,
      action: 'user.password_change',
      targetType: 'User',
      targetId: userId,
    });
  });
}

export { uniqueAccountNumber };
