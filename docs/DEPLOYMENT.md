# Deployment

VaultBank is a demonstration. Deploy it only where visitors understand that balances are simulated. Do not collect real banking credentials.

## Processes

- **API:** `npm start -w backend` runs `node src/server.js`. It reads `backend/.env` through `dotenv` when that file exists, and it also reads the process environment.
- **Web:** `npm run build` writes `frontend/dist`. Serve that directory as static files. Proxy `/api` to the API, or set `VITE_API_URL` to the public API origin **before** `npm run build`.
- **Database:** PostgreSQL 16. Apply `npm run db:migrate -w backend` (`prisma migrate deploy`) before serving traffic.

## Environment

Copy `.env.example` and replace every secret. Required for a real host:

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL for the app database. Do not point tests at this database. |
| `JWT_ACCESS_SECRET` | Long random string, different from the refresh secret. |
| `JWT_REFRESH_SECRET` | Long random string. |
| `CORS_ORIGIN` | Exact frontend origin, including scheme. |
| `COOKIE_SECURE` | `true` when the site is HTTPS. |
| `NODE_ENV` | `production` |
| `PORT` | API listen port, default `4000` |

`TEST_DATABASE_URL` is only for `npm test`. The seed command exits when `NODE_ENV=production` unless `SEED_ALLOW=true`. Leave seeding off on any database you do not fully control.

## Database setup

```bash
npm run db:migrate -w backend
```

Migrations live in `backend/prisma/migrations` and must be committed. They create the tables and the ledger immutability triggers. Clearing accounts (`0000000001`, `0000000002`) and the savings rate are created by the seed script, not by the SQL migration. A production-style boot needs those two clearing accounts and the `savingsAnnualRateBps` setting before customers can deposit or accrue interest. Create them with a controlled seed, or insert the same rows the seed script creates.

## Health and cookies

Point the platform health check at `GET /api/v1/health`. It runs `SELECT 1`.

The refresh cookie path is `/api/v1/auth`, `SameSite=Lax`, `HttpOnly`. The browser and API must share a site configuration where that cookie is sent. A cross-site API needs a deliberate cookie and CORS design that this demo does not implement.

## What this document does not include

There is no Dockerfile for the Node processes, no Kubernetes manifest, and no CI config. `docker-compose.yml` starts PostgreSQL only.
