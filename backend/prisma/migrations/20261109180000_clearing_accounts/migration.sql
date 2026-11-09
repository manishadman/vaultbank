-- System accounts are the other side of deposits, withdrawals, and interest.
-- Customer seed data stays in prisma/seed.js. These rows must exist after migrate.
INSERT INTO "Account" (
  "id",
  "accountNumber",
  "accountType",
  "currency",
  "status",
  "balanceMinor",
  "name",
  "createdAt",
  "updatedAt"
)
SELECT
  'system-clearing-cash',
  '0000000001',
  'CLEARING_CASH',
  'CAD',
  'ACTIVE',
  0,
  'Simulation cash clearing',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" WHERE "accountType" = 'CLEARING_CASH'
);

INSERT INTO "Account" (
  "id",
  "accountNumber",
  "accountType",
  "currency",
  "status",
  "balanceMinor",
  "name",
  "createdAt",
  "updatedAt"
)
SELECT
  'system-clearing-interest',
  '0000000002',
  'CLEARING_INTEREST',
  'CAD',
  'ACTIVE',
  0,
  'Simulation interest clearing',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" WHERE "accountType" = 'CLEARING_INTEREST'
);
