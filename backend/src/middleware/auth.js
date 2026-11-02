import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new AppError('UNAUTHORIZED', 'Authentication required.', 401));
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('TOKEN_EXPIRED', 'Your session expired. Refresh and try again.', 401));
    }
    return next(new AppError('UNAUTHORIZED', 'Authentication required.', 401));
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new AppError('FORBIDDEN', 'You do not have access to this area.', 403));
    }
    return next();
  };
}

export function requireVaultHeader(req, _res, next) {
  if (req.headers['x-vault-request'] !== '1') {
    return next(new AppError('CSRF', 'Missing required request header.', 403));
  }
  return next();
}
