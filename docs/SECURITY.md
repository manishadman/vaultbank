# Security

VaultBank is a demonstration. It is not a bank, it is not production-compliance ready, and it must not be used to collect real financial credentials or move real money.

## Controls that are implemented

- bcrypt password hashes and a password policy of length, case, digit, and symbol
- generic login failure text
- rate limits on authentication and money movement
- short-lived JWT access tokens returned in JSON and kept in frontend memory
- refresh tokens in an HttpOnly, SameSite=Lax cookie, marked Secure in production
- refresh token rotation and server-side revocation
- a required `X-Vault-Request: 1` header on cookie-authenticated session routes
- CORS limited to `CORS_ORIGIN`
- Helmet response headers
- Zod validation on inputs
- Prisma parameterized queries
- ownership checks on customer accounts and transactions
- role checks on `/api/v1/admin`
- audit records for registration, login, postings, freezes, and rate changes
- no secrets in the repository; copy `.env.example` to `backend/.env`
- logger redaction for password, token, cookie, and authorization fields

## Limits of this demo

- There is no real customer identification, sanctions screening, or fraud model beyond failed-attempt history.
- Access tokens are bearer tokens. A stolen access token works until it expires.
- CSRF protection depends on SameSite cookies plus the custom header. It is appropriate for this first-party browser app, not a general third-party API.
- The seed command prints development passwords. Do not run it against a public database unless `NODE_ENV=production` protections are understood. Production seed is refused unless `SEED_ALLOW=true`.
- Statements and dashboards are only as confidential as the deployment's network and database.
- Integer-cent accounting avoids binary floating point, but it is not a substitute for a regulated core ledger.

## Deployment notes

Set `COOKIE_SECURE=true` behind HTTPS. Use a long random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Restrict `CORS_ORIGIN` to the frontend origin. Run `prisma migrate deploy` before serving traffic. Expose `GET /api/v1/health` to the platform health check.
