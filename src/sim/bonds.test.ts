import { describe, expect, it } from 'vitest';
import { createBond, amortizeMonthly, dailyDebtService, totalOutstandingDebt } from './bonds';

describe('bonds', () => {
  it('amortizes a loan to zero over its term', () => {
    let bonds = [createBond(1, 10000, 6, 5, 0)];
    expect(bonds[0].monthlyPayment).toBeGreaterThan(0);

    for (let month = 0; month < 5 * 12; month++) {
      bonds = amortizeMonthly(bonds);
    }

    expect(bonds.length).toBe(0);
  });

  it('charges more total interest at a higher rate for the same principal/term', () => {
    const cheap = createBond(1, 10000, 4, 10, 0);
    const expensive = createBond(2, 10000, 12, 10, 0);
    expect(expensive.monthlyPayment).toBeGreaterThan(cheap.monthlyPayment);
  });

  it('reports smoothed daily debt service and total outstanding debt', () => {
    const bonds = [createBond(1, 10000, 6, 10, 0), createBond(2, 5000, 6, 10, 0)];
    expect(dailyDebtService(bonds)).toBeCloseTo((bonds[0].monthlyPayment + bonds[1].monthlyPayment) / 30, 6);
    expect(totalOutstandingDebt(bonds)).toBeCloseTo(15000, 6);
  });
});
