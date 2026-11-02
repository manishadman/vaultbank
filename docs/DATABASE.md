# Database

PostgreSQL tables are created from `backend/prisma/schema.prisma`.

## Entities

- `User` — customer or administrator, with status and password hash.
- `Account` — checking, savings, or an internal clearing account. `balanceMinor` is a cached integer-cent balance.
- `Transaction` — deposit, withdrawal, transfer, or interest, completed or failed. Failed rows have no ledger entries.
- `LedgerEntry` — immutable debit or credit linked to one transaction and one account.
- `SavingsSettings` — rate in basis points, Actual/365 method, last accrual date, and accrual numerator.
- `InterestRateHistory` — rates as they change. A change applies to future accrual and does not rewrite posted interest.
- `RefreshSession` — hashed refresh token, expiry, and revocation.
- `AuditLog` — actor, action, target, and JSON metadata.
- `Notification` — customer messages.
- `AppSetting` — current savings rate key.

Account numbers are unique. Customer numbers generated at runtime start with `45`. Clearing accounts are `0000000001` and `0000000002`.

## Integrity

The migration adds:

- ledger amounts must be positive
- transaction amounts must be non-negative
- triggers that reject updates or deletes of ledger entries
- a trigger that rejects changes to the financial fields of a completed transaction

Financial operations use one Prisma `$transaction`. Account rows are locked in sorted id order before balances change.

## Money representation

All persisted amounts are `BIGINT` minor units (cents). A rate is an integer number of basis points. `250` means 2.50 percent per year. Interest fractions live in `SavingsSettings.accrualNumerator`, not in a floating-point column.
