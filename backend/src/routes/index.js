import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, requireVaultHeader } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authLimiter, moneyLimiter } from '../middleware/rateLimits.js';
import {
  depositSchema,
  listQuerySchema,
  loginSchema,
  openAccountSchema,
  passwordSchema,
  profileSchema,
  projectionSchema,
  rateSchema,
  registerSchema,
  transferSchema,
  withdrawSchema,
} from '../validators/schemas.js';
import * as auth from '../services/authService.js';
import * as accounts from '../services/accountService.js';
import * as tx from '../services/transactionService.js';
import * as savings from '../services/savingsService.js';
import * as dashboard from '../services/dashboardService.js';
import * as admin from '../services/adminService.js';
import { toCsv, toPdf } from '../services/statementService.js';
import { env } from '../config/env.js';
import { publicTransaction } from '../lib/presenter.js';

const router = Router();

function refreshCookie(res, token) {
  res.cookie('vb_refresh', token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.refreshTokenDays * 86_400_000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('vb_refresh', { path: '/api/v1/auth' });
}

router.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'vaultbank', simulated: true, time: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/register', authLimiter, requireVaultHeader, validateBody(registerSchema), async (req, res, next) => {
  try {
    const session = await auth.registerUser(req.body);
    refreshCookie(res, session.refreshToken);
    res.status(201).json({ accessToken: session.accessToken, user: session.user, simulated: true });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', authLimiter, requireVaultHeader, validateBody(loginSchema), async (req, res, next) => {
  try {
    const session = await auth.loginUser({
      ...req.body,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    refreshCookie(res, session.refreshToken);
    res.json({ accessToken: session.accessToken, user: session.user });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/refresh', requireVaultHeader, async (req, res, next) => {
  try {
    const session = await auth.rotateRefresh(req.cookies.vb_refresh, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    refreshCookie(res, session.refreshToken);
    res.json({ accessToken: session.accessToken, user: session.user });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/logout', requireVaultHeader, async (req, res, next) => {
  try {
    await auth.revokeRefresh(req.cookies.vb_refresh);
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ user: await auth.getMe(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', requireAuth, validateBody(profileSchema), async (req, res, next) => {
  try {
    res.json({ user: await auth.updateProfile(req.user.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.post('/profile/password', requireAuth, validateBody(passwordSchema), async (req, res, next) => {
  try {
    await auth.changePassword(req.user.id, req.body);
    clearRefreshCookie(res);
    res.json({ ok: true, message: 'Password updated. Sign in again with the new password.' });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.json(await dashboard.customerDashboard(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.get('/accounts', requireAuth, async (req, res, next) => {
  try {
    res.json({ items: await accounts.listMyAccounts(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/accounts', requireAuth, validateBody(openAccountSchema), async (req, res, next) => {
  try {
    res.status(201).json({ account: await accounts.openAccount(req.user.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.get('/accounts/:id', requireAuth, async (req, res, next) => {
  try {
    res.json({ account: await accounts.getMyAccount(req.user.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.get('/accounts/:id/balance', requireAuth, async (req, res, next) => {
  try {
    res.json(await accounts.getBalance(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
});

function idempotencyKey(req) {
  const key = req.get('idempotency-key');
  if (key && !/^[A-Za-z0-9:_-]{8,80}$/.test(key)) {
    const error = new Error('Idempotency-Key must be 8 to 80 letters, numbers, colons, or dashes.');
    error.status = 422;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return key || null;
}

router.post('/transactions/deposit', requireAuth, moneyLimiter, validateBody(depositSchema), async (req, res, next) => {
  try {
    const result = await tx.deposit({ userId: req.user.id, ...req.body, idempotencyKey: idempotencyKey(req) });
    res.status(result.replayed ? 200 : 201).json({ ...result, simulated: true });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions/withdraw', requireAuth, moneyLimiter, validateBody(withdrawSchema), async (req, res, next) => {
  try {
    const result = await tx.withdraw({ userId: req.user.id, ...req.body, idempotencyKey: idempotencyKey(req) });
    res.status(result.replayed ? 200 : 201).json({ ...result, simulated: true });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions/transfer', requireAuth, moneyLimiter, validateBody(transferSchema), async (req, res, next) => {
  try {
    const result = await tx.transfer({ userId: req.user.id, ...req.body, idempotencyKey: idempotencyKey(req) });
    res.status(result.replayed ? 200 : 201).json({ ...result, simulated: true });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', requireAuth, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    res.json(await tx.listTransactions(req.user.id, req.query));
  } catch (error) {
    next(error);
  }
});

router.get('/transactions/statement.csv', requireAuth, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const items = await tx.listForStatement(req.user.id, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vaultbank-statement.csv"');
    res.send(toCsv(items));
  } catch (error) {
    next(error);
  }
});

router.get('/transactions/statement.pdf', requireAuth, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const items = await tx.listForStatement(req.user.id, req.query);
    const me = await auth.getMe(req.user.id);
    const pdf = await toPdf(items, me);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="vaultbank-statement.pdf"');
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions/:id', requireAuth, async (req, res, next) => {
  try {
    res.json({ transaction: await tx.getTransaction(req.user.id, req.params.id, req.user.role) });
  } catch (error) {
    next(error);
  }
});

router.get('/savings', requireAuth, async (req, res, next) => {
  try {
    await savings.accrueAllForUser(req.user.id);
    res.json({ items: await savings.listSavings(req.user.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/savings', requireAuth, validateBody(openAccountSchema), async (req, res, next) => {
  try {
    if (req.body.accountType !== 'SAVINGS') {
      res.status(422).json({ error: { code: 'INVALID_ACCOUNT_TYPE', message: 'This route opens savings accounts.' } });
      return;
    }
    res.status(201).json({ account: await accounts.openAccount(req.user.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.post('/savings/calculate', requireAuth, validateBody(projectionSchema), (req, res, next) => {
  try {
    res.json(savings.calculateProjection(req.body));
  } catch (error) {
    next(error);
  }
});

router.get('/savings/:id/projections', requireAuth, async (req, res, next) => {
  try {
    const years = z.coerce.number().int().min(1).max(40).parse(req.query.years || 1);
    res.json(await savings.projectAccount(req.user.id, req.params.id, years));
  } catch (error) {
    next(error);
  }
});

router.get('/savings/:id/interest', requireAuth, async (req, res, next) => {
  try {
    const rows = await savings.interestHistory(req.user.id, req.params.id);
    res.json({ items: rows.map(publicTransaction) });
  } catch (error) {
    next(error);
  }
});

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/dashboard', async (_req, res, next) => {
  try {
    res.json(await admin.adminDashboard());
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    res.json(await admin.listCustomers(req.query));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users/:id', async (req, res, next) => {
  try {
    res.json(await admin.getCustomer(req.params.id));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/accounts', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    res.json({ items: await admin.listAdminAccounts(req.query) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/accounts/:id/freeze', async (req, res, next) => {
  try {
    res.json({ account: await admin.freezeAccount(req.user.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/accounts/:id/unfreeze', async (req, res, next) => {
  try {
    res.json({ account: await admin.unfreezeAccount(req.user.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/transactions', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    res.json(await admin.listAdminTransactions(req.query));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/audit-logs', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    res.json(await admin.listAudit(req.query));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/interest-rate', async (_req, res, next) => {
  try {
    res.json(await admin.getInterestSettings());
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/interest-rate', validateBody(rateSchema), async (req, res, next) => {
  try {
    res.json(await admin.updateInterestRate(req.user.id, req.body.annualInterestRateBps, req.body.note));
  } catch (error) {
    next(error);
  }
});

router.use('/admin', adminRouter);

export default router;
