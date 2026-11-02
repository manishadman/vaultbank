const REDACT = /password|authorization|cookie|token|secret/i;

function sanitize(value, depth = 0) {
  if (depth > 4 || value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = REDACT.test(key) ? '[redacted]' : sanitize(inner, depth + 1);
    }
    return out;
  }
  return value;
}

export const logger = {
  info(message, meta) {
    console.log(JSON.stringify({ level: 'info', message, ...sanitize(meta), time: new Date().toISOString() }));
  },
  warn(message, meta) {
    console.warn(JSON.stringify({ level: 'warn', message, ...sanitize(meta), time: new Date().toISOString() }));
  },
  error(message, meta) {
    console.error(JSON.stringify({ level: 'error', message, ...sanitize(meta), time: new Date().toISOString() }));
  },
};
