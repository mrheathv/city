import { CityMap } from './grid';
import { ZoneType } from './types';

export interface RCIDemand {
  residential: number; // -100..100
  commercial: number;
  industrial: number;
}

export interface RCITotals {
  population: number;
  residentialCapacityJobsSeeking: number;
  commercialJobs: number;
  industrialJobs: number;
  totalJobs: number;
}

export function computeCityTotals(map: CityMap): RCITotals {
  let population = 0;
  let commercialJobs = 0;
  let industrialJobs = 0;
  const n = map.width * map.height;
  for (let i = 0; i < n; i++) {
    const zone = map.zone[i];
    if (zone === ZoneType.ResidentialLow || zone === ZoneType.ResidentialHigh) {
      population += map.population[i];
    } else if (zone === ZoneType.CommercialLow || zone === ZoneType.CommercialHigh) {
      commercialJobs += map.jobs[i];
    } else if (zone === ZoneType.IndustrialLight || zone === ZoneType.IndustrialHeavy) {
      industrialJobs += map.jobs[i];
    }
  }
  const totalJobs = commercialJobs + industrialJobs;
  // Roughly half the population is working-age / in the labor force.
  const residentialCapacityJobsSeeking = Math.round(population * 0.5);
  return { population, residentialCapacityJobsSeeking, commercialJobs, industrialJobs, totalJobs };
}

/** A slow multi-year sine wave standing in for a regional business cycle. */
export function businessCycleMultiplier(simDay: number): number {
  const years = simDay / 365;
  return Math.sin(years * (Math.PI * 2) / 6) * 0.5; // -0.5..0.5, ~6yr period
}

export interface TaxRates {
  residential: number;
  commercial: number;
  industrial: number;
}

/**
 * Demand is expressed as -100..100. Positive values encourage new
 * development/growth of that zone category; negative values encourage
 * decay/abandonment. See SIMULATION.md for the reasoning behind each term.
 */
export function computeRCIDemand(
  totals: RCITotals,
  avgLandValue: number,
  taxRates: TaxRates,
  simDay: number,
): RCIDemand {
  const cycle = businessCycleMultiplier(simDay); // -0.5..0.5
  const workers = totals.residentialCapacityJobsSeeking;
  const jobs = totals.totalJobs;

  // Ratios are clamped to +/-100% of "balanced" (1.0) so that a brand-new
  // city with a handful of residents and zero jobs (or vice versa) doesn't
  // see demand swing to the extreme and instantly wipe out what little has
  // developed — a real labor market absorbs slack gradually, it doesn't
  // collapse the moment supply and demand aren't perfectly matched.
  const clamp01to2 = (v: number) => Math.max(0, Math.min(2, v));
  const jobsPerWorker = clamp01to2(workers > 0 ? jobs / workers : jobs > 0 ? 1.5 : 1);
  const workersPerJob = clamp01to2(jobs > 0 ? workers / jobs : workers > 0 ? 1.5 : 1);

  const landValueFactor = (avgLandValue - 128) / 128; // -1..1

  const taxDrag = (rate: number) => -(rate - 9) * 3; // baseline ~9% is neutral

  // A small flat baseline so a brand-new city (zero population, zero jobs)
  // has enough demand to bootstrap its first buildings before the labor
  // market and tax base exist to drive things organically.
  const BOOTSTRAP = 15;

  // Residential: attracted by jobs being available relative to current workers,
  // by good land value, and by the macro cycle. Suppressed by high residential tax.
  let residential = BOOTSTRAP + (jobsPerWorker - 1) * 35 + landValueFactor * 20 + cycle * 40 + taxDrag(taxRates.residential);

  // Commercial: needs a local customer base (population) and goods supplied by
  // industry; too little of either caps commercial growth.
  const commercialSupplyFactor = totals.industrialJobs > 0 ? Math.min(1, totals.industrialJobs / Math.max(1, totals.population * 0.15)) : 0.6;
  let commercial =
    BOOTSTRAP * 0.7 +
    Math.min(60, totals.population / 8) * commercialSupplyFactor +
    landValueFactor * 15 +
    cycle * 40 +
    taxDrag(taxRates.commercial);

  // Industrial: needs available labor (workers not already employed) and
  // benefits from the export-driven business cycle more than local factors.
  let industrial = BOOTSTRAP + (workersPerJob - 1) * 35 + cycle * 50 + taxDrag(taxRates.industrial);

  residential = Math.max(-100, Math.min(100, residential));
  commercial = Math.max(-100, Math.min(100, commercial));
  industrial = Math.max(-100, Math.min(100, industrial));

  return { residential, commercial, industrial };
}
