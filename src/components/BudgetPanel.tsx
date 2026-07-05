import { useGameStore } from '../state/store';
import { totalOutstandingDebt } from '../sim/bonds';
import { formatMoney } from '../utils/format';

const TAX_KINDS = [
  { key: 'residential' as const, label: 'Residential' },
  { key: 'commercial' as const, label: 'Commercial' },
  { key: 'industrial' as const, label: 'Industrial' },
];

const LOAN_PRESETS = [
  { amount: 5000, rate: 6, term: 10 },
  { amount: 15000, rate: 7, term: 15 },
  { amount: 40000, rate: 8, term: 20 },
];

export function BudgetPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const taxRates = useGameStore((s) => s.taxRates);
  const setTaxRate = useGameStore((s) => s.setTaxRate);
  const lastBudget = useGameStore((s) => s.lastBudget);
  const bonds = useGameStore((s) => s.bonds);
  const takeLoan = useGameStore((s) => s.takeLoan);
  const funds = useGameStore((s) => s.funds);

  if (!open) return null;

  const debt = totalOutstandingDebt(bonds);
  const monthlyDebtService = bonds.reduce((sum, b) => sum + b.monthlyPayment, 0);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col justify-end sm:justify-center sm:items-center bg-black/50">
      <div className="w-full sm:w-[28rem] sm:max-h-[85vh] max-h-[80vh] overflow-y-auto bg-neutral-900 text-white rounded-t-2xl sm:rounded-2xl border border-white/10 p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Budget & Taxes</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-2 text-sm text-white/60">Treasury</div>
        <div className="text-2xl font-semibold mb-4">{formatMoney(funds)}</div>

        <section className="mb-5">
          <h3 className="text-sm font-semibold text-white/70 mb-2">Tax rates</h3>
          <div className="flex flex-col gap-4">
            {TAX_KINDS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white/70">{label}</span>
                  <span className="tabular-nums font-medium">{taxRates[key]}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTaxRate(key, taxRates[key] - 1)}
                    className="w-11 h-11 rounded-lg bg-white/10 active:bg-white/20 shrink-0 text-lg"
                    aria-label={`Decrease ${label} tax`}
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={taxRates[key]}
                    onChange={(e) => setTaxRate(key, Number(e.target.value))}
                    className="flex-1 min-w-0 h-11 accent-sky-500"
                  />
                  <button
                    onClick={() => setTaxRate(key, taxRates[key] + 1)}
                    className="w-11 h-11 rounded-lg bg-white/10 active:bg-white/20 shrink-0 text-lg"
                    aria-label={`Increase ${label} tax`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="text-sm font-semibold text-white/70 mb-2">Daily budget</h3>
          {lastBudget ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-white/50">Residential tax</dt>
              <dd className="text-right">{formatMoney(lastBudget.residentialTax)}</dd>
              <dt className="text-white/50">Commercial tax</dt>
              <dd className="text-right">{formatMoney(lastBudget.commercialTax)}</dd>
              <dt className="text-white/50">Industrial tax</dt>
              <dd className="text-right">{formatMoney(lastBudget.industrialTax)}</dd>
              <dt className="text-white/50 font-medium">Total revenue</dt>
              <dd className="text-right font-medium">{formatMoney(lastBudget.totalRevenue)}</dd>

              <dt className="text-white/50 mt-2">Power upkeep</dt>
              <dd className="text-right mt-2">-{formatMoney(lastBudget.powerUpkeep)}</dd>
              <dt className="text-white/50">Water upkeep</dt>
              <dd className="text-right">-{formatMoney(lastBudget.waterUpkeep)}</dd>
              <dt className="text-white/50">Service upkeep</dt>
              <dd className="text-right">-{formatMoney(lastBudget.serviceUpkeep)}</dd>
              <dt className="text-white/50">Road maintenance</dt>
              <dd className="text-right">-{formatMoney(lastBudget.roadMaintenance)}</dd>
              <dt className="text-white/50">Debt service</dt>
              <dd className="text-right">-{formatMoney(monthlyDebtService / 30)}</dd>
              <dt className="text-white/50 font-medium">Total expenses</dt>
              <dd className="text-right font-medium">-{formatMoney(lastBudget.totalExpenses + monthlyDebtService / 30)}</dd>

              <dt className="text-white/80 font-semibold mt-2">Net / day</dt>
              <dd className={`text-right font-semibold mt-2 ${lastBudget.net - monthlyDebtService / 30 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatMoney(lastBudget.net - monthlyDebtService / 30)}
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-white/50">Budget figures appear after the first simulation tick.</p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Bonds & loans</h3>
          {debt > 0 && (
            <p className="text-sm text-white/70 mb-2">
              Outstanding debt: {formatMoney(debt)} ({formatMoney(monthlyDebtService)}/mo)
            </p>
          )}
          {bonds.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {bonds.map((b) => (
                <li key={b.id} className="text-xs text-white/60 flex justify-between">
                  <span>
                    {formatMoney(b.principal)} @ {b.annualRatePercent}% / {b.termYears}yr
                  </span>
                  <span>{formatMoney(b.remainingBalance)} left</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2">
            {LOAN_PRESETS.map((p) => (
              <button
                key={p.amount}
                onClick={() => takeLoan(p.amount, p.rate, p.term)}
                className="h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-between px-3 text-sm"
              >
                <span>Issue {formatMoney(p.amount)} bond</span>
                <span className="text-white/50">
                  {p.rate}% / {p.term}yr
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
