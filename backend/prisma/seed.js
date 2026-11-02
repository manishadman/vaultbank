import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const prisma = new PrismaClient();
const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Demo-Customer-1!';
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@vaultbank.demo';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Admin-1!';

if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW !== 'true') {
  console.error('Refusing to seed while NODE_ENV=production. Set SEED_ALLOW=true only for a deliberate demo.');
  process.exit(1);
}

const customers = [
  { email: 'ava.chen@vaultbank.demo', fullName: 'Ava Chen', checking: '4521000001', savings: '4521000002' },
  { email: 'noah.patel@vaultbank.demo', fullName: 'Noah Patel', checking: '4521000003', savings: '4521000004' },
  { email: 'mia.ross@vaultbank.demo', fullName: 'Mia Ross', checking: '4521000005', savings: null },
  { email: 'liam.okonkwo@vaultbank.demo', fullName: 'Liam Okonkwo', checking: '4521000006', savings: '4521000007' },
  { email: 'sofia.nguyen@vaultbank.demo', fullName: 'Sofia Nguyen', checking: '4521000008', savings: '4521000009' },
];

async function ensureClearing(accountNumber, accountType, name) {
  return prisma.account.upsert({
    where: { accountNumber },
    update: {},
    create: { accountNumber, accountType, name, currency: 'CAD', balanceMinor: 0n },
  });
}

async function post(db, { type, userId, description, amountMinor, legs, when }) {
  const referenceNumber = `SEED${type.slice(0, 3)}${legs[0].accountId.slice(-4)}${amountMinor}`;
  const existing = await db.transaction.findUnique({ where: { referenceNumber } });
  if (existing) return;
  await db.transaction.create({
    data: {
      type,
      status: 'COMPLETED',
      referenceNumber,
      description,
      initiatedByUserId: userId,
      amountMinor,
      currency: 'CAD',
      createdAt: when,
      completedAt: when,
      entries: { create: legs },
    },
  });
  for (const leg of legs) {
    const delta = leg.direction === 'CREDIT' ? leg.amountMinor : -leg.amountMinor;
    await db.account.update({
      where: { id: leg.accountId },
      data: { balanceMinor: { increment: delta } },
    });
  }
}

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const cash = await ensureClearing('0000000001', 'CLEARING_CASH', 'Simulation cash clearing');
  const interest = await ensureClearing('0000000002', 'CLEARING_INTEREST', 'Simulation interest clearing');
  await prisma.appSetting.upsert({
    where: { key: 'savingsAnnualRateBps' },
    update: {},
    create: { key: 'savingsAnnualRateBps', value: '250' },
  });
  await prisma.interestRateHistory.upsert({
    where: { id: 'seed-rate-250' },
    update: {},
    create: {
      id: 'seed-rate-250',
      annualInterestRateBps: 250,
      effectiveFrom: new Date('2026-01-01'),
      note: 'Opening demonstration rate of 2.50%',
    },
  });

  const adminHash = await bcrypt.hash(adminPassword, rounds);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { fullName: 'VaultBank Administrator', role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      fullName: 'VaultBank Administrator',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  const customerHash = await bcrypt.hash(demoPassword, rounds);
  for (const person of customers) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { fullName: person.fullName, role: 'CUSTOMER', status: 'ACTIVE' },
      create: {
        email: person.email,
        fullName: person.fullName,
        passwordHash: customerHash,
        role: 'CUSTOMER',
      },
    });
    const checking = await prisma.account.upsert({
      where: { accountNumber: person.checking },
      update: { userId: user.id },
      create: {
        userId: user.id,
        accountNumber: person.checking,
        accountType: 'CHECKING',
        name: 'Everyday Checking',
        currency: 'CAD',
      },
    });
    let savings = null;
    if (person.savings) {
      savings = await prisma.account.upsert({
        where: { accountNumber: person.savings },
        update: { userId: user.id },
        create: {
          userId: user.id,
          accountNumber: person.savings,
          accountType: 'SAVINGS',
          name: 'Growth Savings',
          currency: 'CAD',
        },
      });
      await prisma.savingsSettings.upsert({
        where: { accountId: savings.id },
        update: {},
        create: { accountId: savings.id, annualInterestRateBps: 250, lastAccrualDate: new Date() },
      });
    }
    const day = new Date('2026-10-02T15:00:00.000Z');
    await post(prisma, {
      type: 'DEPOSIT',
      userId: user.id,
      description: 'Opening simulated deposit',
      amountMinor: 250000n,
      when: day,
      legs: [
        { accountId: cash.id, direction: 'DEBIT', amountMinor: 250000n },
        { accountId: checking.id, direction: 'CREDIT', amountMinor: 250000n },
      ],
    });
    if (savings) {
      await post(prisma, {
        type: 'TRANSFER',
        userId: user.id,
        description: 'Move funds into savings',
        amountMinor: 100000n,
        when: new Date('2026-10-05T15:00:00.000Z'),
        legs: [
          { accountId: checking.id, direction: 'DEBIT', amountMinor: 100000n },
          { accountId: savings.id, direction: 'CREDIT', amountMinor: 100000n },
        ],
      });
    }
    await post(prisma, {
      type: 'WITHDRAWAL',
      userId: user.id,
      description: 'Simulated cash withdrawal',
      amountMinor: 2000n,
      when: new Date('2026-10-12T15:00:00.000Z'),
      legs: [
        { accountId: checking.id, direction: 'DEBIT', amountMinor: 2000n },
        { accountId: cash.id, direction: 'CREDIT', amountMinor: 2000n },
      ],
    });
    if (person.email === 'ava.chen@vaultbank.demo' && savings) {
      await post(prisma, {
        type: 'INTEREST',
        userId: user.id,
        description: 'Posted savings interest (simulated)',
        amountMinor: 125n,
        when: new Date('2026-10-31T23:00:00.000Z'),
        legs: [
          { accountId: interest.id, direction: 'DEBIT', amountMinor: 125n },
          { accountId: savings.id, direction: 'CREDIT', amountMinor: 125n },
        ],
      });
    }
    await prisma.notification.upsert({
      where: { id: `welcome-${user.id}` },
      update: {},
      create: {
        id: `welcome-${user.id}`,
        userId: user.id,
        title: 'Demo profile ready',
        body: 'This VaultBank profile uses simulated Canadian dollars only.',
      },
    });
  }

  const ava = await prisma.user.findUnique({ where: { email: 'ava.chen@vaultbank.demo' } });
  const noahChecking = await prisma.account.findUnique({ where: { accountNumber: '4521000003' } });
  const avaChecking = await prisma.account.findUnique({ where: { accountNumber: '4521000001' } });
  if (ava && noahChecking && avaChecking) {
    await post(prisma, {
      type: 'TRANSFER',
      userId: ava.id,
      description: 'Simulated transfer to Noah',
      amountMinor: 5000n,
      when: new Date('2026-10-18T18:00:00.000Z'),
      legs: [
        { accountId: avaChecking.id, direction: 'DEBIT', amountMinor: 5000n },
        { accountId: noahChecking.id, direction: 'CREDIT', amountMinor: 5000n },
      ],
    });
  }

  console.log('VaultBank demo data is ready.');
  console.log(`Admin (development only): ${adminEmail}`);
  console.log('Customers: *.vaultbank.demo — see README. Do not use these passwords in production.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
