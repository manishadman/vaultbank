import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign({ role: user.role, email: user.email }, env.jwtAccessSecret, {
    subject: user.id,
    expiresIn: env.accessTokenTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashRequest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function newReference() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VB${stamp}${rand}`;
}

export function newAccountNumber() {
  const body = crypto.randomInt(0, 100_000_000).toString().padStart(8, '0');
  return `45${body}`;
}
