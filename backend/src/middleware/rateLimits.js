import rateLimit from 'express-rate-limit';

const message = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Wait a moment and try again.' } };

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const moneyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
