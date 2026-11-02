# API

Base path: `/api/v1`. The machine-readable contract is `docs/openapi.yaml`.

Successful financial responses include the transaction. Errors use:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "…", "fields": [] } }
```

Send `X-Vault-Request: 1` on browser calls. Send `Authorization: Bearer <accessToken>` on protected calls. Send `Idempotency-Key` on deposit, withdrawal, and transfer.

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Customer

- `GET /dashboard`
- `GET /accounts`, `POST /accounts`, `GET /accounts/:id`, `GET /accounts/:id/balance`
- `GET /transactions`, `GET /transactions/:id`
- `GET /transactions/statement.csv`, `GET /transactions/statement.pdf`
- `POST /transactions/deposit`, `POST /transactions/withdraw`, `POST /transactions/transfer`
- `GET /savings`, `POST /savings`, `POST /savings/calculate`
- `GET /savings/:id/projections`, `GET /savings/:id/interest`
- `PATCH /profile`, `POST /profile/password`
- `GET /notifications`, `POST /notifications/:id/read`

## Administration

- `GET /admin/dashboard`
- `GET /admin/users`, `GET /admin/users/:id`
- `GET /admin/accounts`
- `PATCH /admin/accounts/:id/freeze`, `PATCH /admin/accounts/:id/unfreeze`
- `GET /admin/transactions`
- `GET /admin/audit-logs`
- `GET /admin/interest-rate`, `PUT /admin/interest-rate`

## Health

`GET /health` checks the process and the database.

Amounts in JSON are decimal strings such as `"25.00"`. Amounts in responses are integer cents encoded as strings, for example `"2500"`.
