import { AppError } from './errors.js';
import { LIMITS } from '../config/env.js';

const AMOUNT = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

/** Parse a decimal dollar string into integer cents. Rejects floats and scientific notation. */
export function parseAmountToMinor(input) {
  if (typeof input === 'bigint') {
    if (input <= 0n) throw new AppError('INVALID_AMOUNT', 'Amount must be greater than zero.', 422);
    return input;
  }
  const raw = String(input ?? '').trim();
  if (!AMOUNT.test(raw)) {
    throw new AppError('INVALID_AMOUNT', 'Enter a positive amount with at most two decimal places.', 422);
  }
  const [dollars, fraction = ''] = raw.split('.');
  const cents = BigInt(dollars) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (cents <= 0n) throw new AppError('INVALID_AMOUNT', 'Amount must be greater than zero.', 422);
  return cents;
}

export function assertLimit(amountMinor, maxMinor, label) {
  if (amountMinor < LIMITS.minMinor) {
    throw new AppError('INVALID_AMOUNT', 'Amount must be greater than zero.', 422);
  }
  if (amountMinor > maxMinor) {
    throw new AppError('LIMIT_EXCEEDED', `${label} exceeds the configured limit of ${formatCad(maxMinor)}.`, 422);
  }
}

export function formatCad(minor) {
  const value = typeof minor === 'bigint' ? minor : BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const dollars = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars}.${cents}`;
}

export function minorToString(minor) {
  return (typeof minor === 'bigint' ? minor : BigInt(minor)).toString();
}
