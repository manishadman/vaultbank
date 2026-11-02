import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(root, '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', isProd ? undefined : 'postgresql://mani@localhost:5432/vaultbank'),
  corsOrigin: process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProd,
  jwtAccessSecret: required(
    'JWT_ACCESS_SECRET',
    isProd ? undefined : 'dev-access-secret-change-me-please-32b',
  ),
  jwtRefreshSecret: required(
    'JWT_REFRESH_SECRET',
    isProd ? undefined : 'dev-refresh-secret-change-me-please-32',
  ),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@vaultbank.demo',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Admin-1!',
  seedDemoPassword: process.env.SEED_DEMO_PASSWORD || 'Demo-Customer-1!',
};

export const LIMITS = {
  minMinor: 1n,
  maxDepositMinor: 100_000_000n,
  maxWithdrawalMinor: 10_000_000n,
  maxTransferMinor: 25_000_000n,
  maxAccountsPerUser: 6,
  defaultSavingsBps: 250,
};
