import { CityMap } from './grid';
import { updatePowerGrid } from './power';
import { updateWaterGrid } from './water';
import { computeLandValue, averageLandValue } from './landvalue';
import { computeCityTotals, computeRCIDemand, type TaxRates, type RCIDemand } from './rci';
import { applyGrowth } from './growth';
import { computeDailyBudget } from './budget';

export type SimSpeed = 0 | 1 | 2 | 3; // 0 = paused (handled separately), 1-3 = speed multiplier

export interface TickInput {
  funds: number;
  taxRates: TaxRates;
  simDay: number;
}

export interface TickResult {
  funds: number;
  population: number;
  jobs: number;
  demand: RCIDemand;
  avgLandValue: number;
}

export function runSimTick(map: CityMap, input: TickInput): TickResult {
  updatePowerGrid(map);
  updateWaterGrid(map);
  computeLandValue(map);
  const avgLandValue = averageLandValue(map);

  const totals = computeCityTotals(map);
  const demand = computeRCIDemand(totals, avgLandValue, input.taxRates, input.simDay);
  applyGrowth(map, demand);

  const budget = computeDailyBudget(map, input.taxRates);
  const newTotals = computeCityTotals(map);

  return {
    funds: input.funds + budget.net,
    population: newTotals.population,
    jobs: newTotals.totalJobs,
    demand,
    avgLandValue,
  };
}
