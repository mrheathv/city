export interface Bond {
  id: number;
  principal: number;
  annualRatePercent: number;
  termYears: number;
  issuedDay: number;
  monthlyPayment: number;
  remainingBalance: number;
}

/** Standard fixed-rate amortizing loan, like a municipal bond issue. */
export function createBond(id: number, principal: number, annualRatePercent: number, termYears: number, issuedDay: number): Bond {
  const monthlyRate = annualRatePercent / 100 / 12;
  const termMonths = termYears * 12;
  const monthlyPayment =
    monthlyRate === 0 ? principal / termMonths : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  return { id, principal, annualRatePercent, termYears, issuedDay, monthlyPayment, remainingBalance: principal };
}

/** Smoothed daily share of every bond's monthly payment, for the day-to-day funds ticker. */
export function dailyDebtService(bonds: Bond[]): number {
  return bonds.reduce((sum, b) => sum + b.monthlyPayment / 30, 0);
}

/**
 * Applies one month of amortization: splits each payment into interest
 * (on the remaining balance) and principal, and drops bonds once paid off.
 * Called every 30 sim-days.
 */
export function amortizeMonthly(bonds: Bond[]): Bond[] {
  return bonds
    .map((b) => {
      const monthlyRate = b.annualRatePercent / 100 / 12;
      const interestPortion = b.remainingBalance * monthlyRate;
      const principalPortion = b.monthlyPayment - interestPortion;
      const remainingBalance = Math.max(0, b.remainingBalance - principalPortion);
      return { ...b, remainingBalance };
    })
    .filter((b) => b.remainingBalance > 0.01);
}

export function totalOutstandingDebt(bonds: Bond[]): number {
  return bonds.reduce((sum, b) => sum + b.remainingBalance, 0);
}
