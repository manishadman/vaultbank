# Architecture

VaultBank is an educational simulator. Customer balances are liabilities denominated in integer Canadian cents. JavaScript floating-point values are never stored as money.

## Applications

- `frontend` is a Vite React application. The access token lives in memory. The refresh token is an HttpOnly cookie scoped to `/api/v1/auth`.
- `backend` is an Express API under `/api/v1`. Controllers are thin route handlers. Business rules live in `src/services`.
- PostgreSQL is the system of record. Prisma maps the schema and runs inside database transactions for every financial posting.

## Ledger

Completed movements use a double-entry posting model:

| Movement | Debit | Credit |
| --- | --- | --- |
| Deposit | Simulation cash clearing | Customer account |
| Withdrawal | Customer account | Simulation cash clearing |
| Transfer | Source customer account | Destination customer account |
| Posted interest | Simulation interest clearing | Savings account |

A credit increases `Account.balanceMinor`. A debit decreases it. Clearing balances are allowed to become negative, so the sum of every account balance stays zero. That cached balance is updated only in the same database transaction as the ledger rows.

Completed ledger rows are protected by a database trigger. Corrections require a new compensating transaction.

## Concurrency and idempotency

`postTransaction` locks every involved account with `SELECT … FOR UPDATE` in account-id order, checks status under that lock, inserts the transaction and ledger rows, then applies balance updates. A customer debit also requires `balanceMinor >= amount` in the update itself. If any step throws, PostgreSQL rolls the transaction back.

Clients send an `Idempotency-Key`. The unique key is `(initiatedByUserId, idempotencyKey)`, stored with a hash of the request. The same key and same request returns the original result. The same key with a different body returns `409`.

## Interest

Savings use Actual/365. The daily divisor is 365, including 29 February. Each day adds `balanceMinor * annualRateBps` to an integer numerator. Posted cents are `numerator / (365 * 10000)`, with the remainder retained. Whole cents post on the last UTC day of a month. The savings calculator is a separate monthly estimate and does not post.

## Security boundaries

Passwords are hashed with bcrypt. Access tokens are short-lived JWTs. Refresh tokens are random, stored only as SHA-256 hashes, and rotated. Logout revokes the server session. Customer routes filter by the authenticated user id. Admin routes require `role = ADMIN`. Login failures use one generic message and a rate limit. Logs redact passwords, cookies, and tokens.
