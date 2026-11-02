import { expect } from 'chai';
import {
  dailyNumerator,
  dayCountDivisor,
  eachUtcDay,
  isMonthEnd,
  numeratorAfterPosting,
  projectSavings,
  wholeCentsFromNumerator,
} from '../src/lib/interest.js';

describe('interest', () => {
  it('uses Actual/365 on leap day', () => {
    const leapDay = new Date('2024-02-29T12:00:00.000Z');
    expect(dayCountDivisor(leapDay)).to.equal(365n);
    const numerator = dailyNumerator(100000n, 365);
    expect(wholeCentsFromNumerator(numerator)).to.equal(10n);
  });

  it('keeps the fractional remainder instead of discarding it', () => {
    const oneDay = dailyNumerator(100n, 250);
    expect(wholeCentsFromNumerator(oneDay)).to.equal(0n);
    const many = oneDay * 400n;
    const posted = wholeCentsFromNumerator(many);
    expect(posted).to.be.greaterThan(0n);
    const left = numeratorAfterPosting(many, posted);
    expect(wholeCentsFromNumerator(left)).to.equal(0n);
    expect(left).to.be.greaterThan(0n);
  });

  it('recognizes month ends and date boundaries', () => {
    expect(isMonthEnd(new Date('2026-01-31T00:00:00.000Z'))).to.equal(true);
    expect(isMonthEnd(new Date('2024-02-29T00:00:00.000Z'))).to.equal(true);
    expect(isMonthEnd(new Date('2026-01-30T00:00:00.000Z'))).to.equal(false);
    const days = eachUtcDay(new Date('2026-01-30T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z'));
    expect(days.map((day) => day.toISOString().slice(0, 10))).to.deep.equal(['2026-01-31', '2026-02-01']);
  });

  it('projects growth in integer cents', () => {
    const result = projectSavings({
      initialMinor: 100000n,
      monthlyMinor: 10000n,
      annualRateBps: 1200,
      years: 1,
    });
    expect(BigInt(result.totalContributionsMinor)).to.equal(220000n);
    expect(BigInt(result.projectedFinalMinor)).to.be.greaterThan(220000n);
    expect(result.disclaimer).to.match(/estimate/i);
  });
});
