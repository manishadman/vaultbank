import { describe, expect, it } from 'vitest';
import { formatCad } from '../lib/money.js';
import { amountSchema, loginSchema } from '../lib/schemas.js';

describe('frontend money and forms', () => {
  it('formats integer cents', () => {
    expect(formatCad('123456')).toBe('$1,234.56');
  });

  it('rejects an incomplete login', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a two-decimal amount', () => {
    expect(amountSchema.safeParse('25.50').success).toBe(true);
    expect(amountSchema.safeParse('0.00').success).toBe(false);
  });
});
