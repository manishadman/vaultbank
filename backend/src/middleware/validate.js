import { AppError } from '../lib/errors.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        new AppError('VALIDATION_ERROR', 'Check the highlighted fields.', 422, {
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
    }
    req.body = parsed.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(new AppError('VALIDATION_ERROR', 'Those filters are not valid.', 422));
    }
    req.query = parsed.data;
    return next();
  };
}
