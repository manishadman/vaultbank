import { expect } from 'chai';
import { formatCad, parseAmountToMinor } from '../src/lib/money.js';
import { AppError } from '../src/lib/errors.js';

describe('money', () => {
  it('parses decimal strings into cents without floating point', () => {
    expect(parseAmountToMinor('10')).to.equal(1000n);
    expect(parseAmountToMinor('10.5')).to.equal(1050n);
    expect(parseAmountToMinor('0.01')).to.equal(1n);
    expect(parseAmountToMinor('2500.25')).to.equal(250025n);
  });

  it('rejects zero, negative, and imprecise amounts', () => {
    for (const value of ['0', '0.00', '-5', '1.234', '1e2', '10.5.1', '']) {
      expect(() => parseAmountToMinor(value)).to.throw(AppError);
    }
  });

  it('formats cents as CAD', () => {
    expect(formatCad(123456n)).to.equal('$1,234.56');
    expect(formatCad(-5n)).to.equal('-$0.05');
  });
});
