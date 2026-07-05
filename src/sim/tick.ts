import { CityMap } from './grid';
import { updatePowerGrid } from './power';
import { updateWaterGrid } from './water';
import { updateTraffic, type TrafficResult } from './traffic';
import { computeServiceCoverage } from './services';
import { computePollution, computeCrimeAndFireRisk } from './environment';
import { computeLandValue, averageLandValue } from './landvalue';
import { computeCityTotals, computeRCIDemand, type TaxRates, type RCIDemand } from './rci';
import { applyGrowth } from './growth';
import { computeDailyBudget, type DailyBudget } from './budget';

export type SimSpeed = 0 | 1 | 2 | 3; // 0 = paused (handled separately), 1-3 = speed multiplier

export interface TickInput {
  taxRates: TaxRates;
  simDay: number;
}

export interface TickResult {
  population: number;
  jobs: number;
  demand: RCIDemand;
  avgLandValue: number;
  traffic: TrafficResult;
  budget: DailyBudget;
}

export function runSimTick(map: CityMap, input: TickInput): TickResult {
  updatePowerGrid(map);
  updateWaterGrid(map);

  // Traffic is computed from last tick's population/jobs (grown further
  // down below), which is the standard one-tick-lagged feedback loop used
  // throughout this simulation to avoid same-tick circular dependencies.
  const traffic = updateTraffic(map);

  const coverage = computeServiceCoverage(map);
  computePollution(map);
  computeCrimeAndFireRisk(map, coverage);
  computeLandValue(map, coverage);
  const avgLandValue = averageLandValue(map);

  const totals = computeCityTotals(map);
  const demand = computeRCIDemand(totals, avgLandValue, input.taxRates, input.simDay, traffic.avgCommuteDistance);
  applyGrowth(map, demand);

  const budget = computeDailyBudget(map, input.taxRates);
  const newTotals = computeCityTotals(map);

  return {
    population: newTotals.population,
    jobs: newTotals.totalJobs,
    demand,
    avgLandValue,
    traffic,
    budget,
  };
}
