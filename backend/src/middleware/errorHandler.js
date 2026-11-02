import { logger } from '../lib/logger.js';

export function notFound(_req, _res, next) {
  const error = new Error('Not found');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status = error.status || 500;
  if (status >= 500) {
    logger.error('request_failed', { path: req.path, method: req.method, message: error.message });
  }
  const body = {
    error: {
      code: error.code || 'INTERNAL',
      message: status >= 500 ? 'Something went wrong. Please try again.' : error.message,
      fields: error.extra?.fields,
      transaction: error.extra?.transaction,
    },
  };
  res.status(status).json(body);
}
