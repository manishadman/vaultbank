import dotenv from 'dotenv';

dotenv.config();
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://mani@127.0.0.1:5433/vaultbank_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-should-be-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-should-be-long-enough';
process.env.BCRYPT_ROUNDS = '4';
process.env.CORS_ORIGIN = 'http://localhost:5173';

import { expect } from 'chai';
import request from 'supertest';

const { createApp } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');

const app = createApp();
const header = { 'X-Vault-Request': '1' };

async function reset() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LedgerEntry",
      "Transaction",
      "Notification",
      "AuditLog",
      "SavingsSettings",
      "RefreshSession",
      "Account",
      "User"
    RESTART IDENTITY CASCADE
  `);
  await prisma.account.createMany({
    data: [
      { accountNumber: '0000000001', accountType: 'CLEARING_CASH', name: 'Cash clearing', currency: 'CAD' },
      { accountNumber: '0000000002', accountType: 'CLEARING_INTEREST', name: 'Interest clearing', currency: 'CAD' },
    ],
  });
}

async function register(email = `user${Date.now()}@example.com`) {
  const response = await request(app).post('/api/v1/auth/register').set(header).send({
    fullName: 'Test Customer',
    email,
    password: 'Correct-Horse-1!',
    confirmPassword: 'Correct-Horse-1!',
  });
  return response;
}

describe('VaultBank API', function () {
  this.timeout(30000);
  before(async () => {
    await prisma.$connect();
    await reset();
  });
  after(async () => {
    await reset();
    await prisma.$disconnect();
  });
  beforeEach(reset);

  it('registers, rejects duplicate email, and rejects a bad login', async () => {
    const created = await register('ada@example.com');
    expect(created.status).to.equal(201);
    expect(created.body.user.email).to.equal('ada@example.com');
    expect(created.headers['set-cookie'].join(';')).to.match(/HttpOnly/i);

    const duplicate = await register('ada@example.com');
    expect(duplicate.status).to.equal(409);

    const bad = await request(app).post('/api/v1/auth/login').set(header).send({
      email: 'ada@example.com',
      password: 'wrong-password',
    });
    expect(bad.status).to.equal(401);
    expect(bad.body.error.message).to.equal('Invalid email or password.');
  });

  it('blocks unauthenticated access and refreshes then revokes sessions', async () => {
    const denied = await request(app).get('/api/v1/accounts');
    expect(denied.status).to.equal(401);

    const created = await register('refresh@example.com');
    const cookie = created.headers['set-cookie'];
    const refreshed = await request(app).post('/api/v1/auth/refresh').set(header).set('Cookie', cookie);
    expect(refreshed.status).to.equal(200);
    expect(refreshed.body.accessToken).to.be.a('string');

    const oldRefresh = await request(app).post('/api/v1/auth/refresh').set(header).set('Cookie', cookie);
    expect(oldRefresh.status).to.equal(401);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set(header)
      .set('Cookie', refreshed.headers['set-cookie']);
    expect(logout.status).to.equal(200);
    const again = await request(app)
      .post('/api/v1/auth/refresh')
      .set(header)
      .set('Cookie', refreshed.headers['set-cookie']);
    expect(again.status).to.equal(401);
  });

  it('posts deposits, withdrawals, and transfers with a balanced ledger', async () => {
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');
    const token = owner.body.accessToken;
    const accounts = await request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${token}`);
    const checking = accounts.body.items[0];

    const deposit = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'deposit-key-001')
      .send({ accountId: checking.id, amount: '150.00', description: 'Pay' });
    expect(deposit.status).to.equal(201);
    expect(deposit.body.transaction.amountMinor).to.equal('15000');

    const replay = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'deposit-key-001')
      .send({ accountId: checking.id, amount: '150.00', description: 'Pay' });
    expect(replay.status).to.equal(200);
    expect(replay.body.replayed).to.equal(true);

    const conflict = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'deposit-key-001')
      .send({ accountId: checking.id, amount: '10.00', description: 'Pay' });
    expect(conflict.status).to.equal(409);

    const otherAccounts = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${other.body.accessToken}`);
    const destination = otherAccounts.body.items[0].accountNumber;

    const transfer = await request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'transfer-key-01')
      .send({ sourceAccountId: checking.id, destinationAccountNumber: destination, amount: '40.00' });
    expect(transfer.status).to.equal(201);

    const peek = await request(app)
      .get(`/api/v1/accounts/${otherAccounts.body.items[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(peek.status).to.equal(404);

    const withdraw = await request(app)
      .post('/api/v1/transactions/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'withdraw-key-01')
      .send({ accountId: checking.id, amount: '20.00' });
    expect(withdraw.status).to.equal(201);

    const tooMuch = await request(app)
      .post('/api/v1/transactions/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'withdraw-key-02')
      .send({ accountId: checking.id, amount: '1000.00' });
    expect(tooMuch.status).to.equal(422);
    expect(tooMuch.body.error.code).to.equal('INSUFFICIENT_FUNDS');

    const balances = await prisma.account.aggregate({ _sum: { balanceMinor: true } });
    expect(balances._sum.balanceMinor).to.equal(0n);
  });

  it('stops a second concurrent withdrawal from overdrawing', async () => {
    const created = await register('race@example.com');
    const token = created.body.accessToken;
    const accounts = await request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${token}`);
    const checking = accounts.body.items[0];
    await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'race-deposit-1')
      .send({ accountId: checking.id, amount: '50.00' });

    const calls = await Promise.all([
      request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'race-withdraw-a')
        .send({ accountId: checking.id, amount: '50.00' }),
      request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'race-withdraw-b')
        .send({ accountId: checking.id, amount: '50.00' }),
    ]);
    const statuses = calls.map((call) => call.status).sort();
    expect(statuses).to.deep.equal([201, 422]);
    const account = await prisma.account.findUnique({ where: { id: checking.id } });
    expect(account.balanceMinor).to.equal(0n);
    const balances = await prisma.account.aggregate({ _sum: { balanceMinor: true } });
    expect(balances._sum.balanceMinor).to.equal(0n);
  });

  it('rejects frozen accounts and hides admin routes from customers', async () => {
    const created = await register('frozen@example.com');
    const token = created.body.accessToken;
    const accounts = await request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${token}`);
    const checking = accounts.body.items[0];
    await prisma.account.update({ where: { id: checking.id }, data: { status: 'FROZEN' } });
    const deposit = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'frozen-deposit-1')
      .send({ accountId: checking.id, amount: '10.00' });
    expect(deposit.status).to.equal(409);
    expect(deposit.body.error.code).to.equal('ACCOUNT_NOT_ACTIVE');

    const admin = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${token}`);
    expect(admin.status).to.equal(403);

    const invalid = await request(app)
      .post('/api/v1/transactions/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: checking.id, amount: '-2' });
    expect(invalid.status).to.equal(422);
  });
});
