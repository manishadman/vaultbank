export class AppError extends Error {
  constructor(code, message, status = 400, extra = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
    this.recordFailure = Boolean(extra.recordFailure);
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
