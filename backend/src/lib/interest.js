/**
 * Savings interest uses the Actual/365 day-count convention.
 * The daily divisor is always 365, including in leap years and on 29 February.
 *
 * Accrual numerator added for one day:
 *   balanceMinor * annualRateBps
 * Whole cents = numerator / (365 * 10_000)
 * Truncation is toward zero. The remainder stays in the numerator.
 *
 * Posted interest is a normal balanced ledger transaction.
 * Projected interest is not posted.
 */

export const DAY_COUNT_DIVISOR = 365n;
export const MICRO_PER_CENT = 10_000n;

export function dayCountDivisor(_date) {
  return DAY_COUNT_DIVISOR;
}

export function dailyNumerator(balanceMinor, annualRateBps) {
  const balance = typeof balanceMinor === 'bigint' ? balanceMinor : BigInt(balanceMinor);
  if (balance <= 0n || annualRateBps <= 0) return 0n;
  return balance * BigInt(annualRateBps);
}

export function microCentsFromNumerator(numerator) {
  const value = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
  return value / DAY_COUNT_DIVISOR;
}

export function wholeCentsFromNumerator(numerator) {
  return (typeof numerator === 'bigint' ? numerator : BigInt(numerator)) / (DAY_COUNT_DIVISOR * MICRO_PER_CENT);
}

/** Subtract posted cents from the numerator, preserving the fractional remainder. */
export function numeratorAfterPosting(numerator, postedCents) {
  const value = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
  const posted = typeof postedCents === 'bigint' ? postedCents : BigInt(postedCents);
  return value - posted * DAY_COUNT_DIVISOR * MICRO_PER_CENT;
}

export function utcDateOnly(input) {
  const date = input instanceof Date ? input : new Date(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date, days) {
  return new Date(utcDateOnly(date).getTime() + days * 86_400_000);
}

export function isMonthEnd(date) {
  const next = addUtcDays(date, 1);
  return next.getUTCMonth() !== utcDateOnly(date).getUTCMonth();
}

export function eachUtcDay(startExclusive, endInclusive) {
  const days = [];
  let cursor = addUtcDays(startExclusive, 1);
  const end = utcDateOnly(endInclusive).getTime();
  while (cursor.getTime() <= end) {
    days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

/**
 * Estimate-only compound growth in integer cents.
 * Each month: add the contribution, then credit interest on the new balance.
 * Monthly rate = annualBps / 10000 / 12. Half-up rounding to the cent.
 */
export function projectSavings({ initialMinor, monthlyMinor, annualRateBps, years }) {
  const months = years * 12;
  let balance = initialMinor;
  let contributed = initialMinor;
  const points = [{ month: 0, balanceMinor: balance.toString() }];
  const rateNumer = BigInt(annualRateBps);
  const rateDenom = 10000n * 12n;
  for (let month = 1; month <= months; month += 1) {
    balance += monthlyMinor;
    contributed += monthlyMinor;
    const interest = (balance * rateNumer + rateDenom / 2n) / rateDenom;
    balance += interest;
    if (month % 12 === 0 || month === months) {
      points.push({ month, balanceMinor: balance.toString() });
    }
  }
  const interestMinor = balance - contributed;
  return {
    months,
    totalContributionsMinor: contributed.toString(),
    estimatedInterestMinor: interestMinor.toString(),
    projectedFinalMinor: balance.toString(),
    points,
    disclaimer:
      'This is an estimate. It uses monthly compounding and half-up cent rounding. It is not posted interest.',
  };
}
