import { CityMap } from './grid';
import { FACILITY_DEFS } from './facilities';
import { NetworkFlag, ZoneType } from './types';
import type { TaxRates } from './rci';

export interface DailyBudget {
  residentialTax: number;
  commercialTax: number;
  industrialTax: number;
  upkeep: number;
  roadMaintenance: number;
  net: number;
}

/**
 * Very small daily budget model for Phase 3. Phase 6 replaces this with a
 * full itemized monthly/yearly report plus bonds and interest.
 */
export function computeDailyBudget(map: CityMap, taxRates: TaxRates): DailyBudget {
  let residentialPop = 0;
  let commercialJobs = 0;
  let industrialJobs = 0;
  let roadTiles = 0;
  const n = map.width * map.height;
  for (let i = 0; i < n; i++) {
    const zone = map.zone[i];
    if (zone === ZoneType.ResidentialLow || zone === ZoneType.ResidentialHigh) residentialPop += map.population[i];
    else if (zone === ZoneType.CommercialLow || zone === ZoneType.CommercialHigh) commercialJobs += map.jobs[i];
    else if (zone === ZoneType.IndustrialLight || zone === ZoneType.IndustrialHeavy) industrialJobs += map.jobs[i];
    if (map.networks[i] & NetworkFlag.Road) roadTiles++;
  }

  const residentialTax = (residentialPop * taxRates.residential) / 100;
  const commercialTax = (commercialJobs * taxRates.commercial) / 60;
  const industrialTax = (industrialJobs * taxRates.industrial) / 80;

  let upkeep = 0;
  for (const facility of map.facilities.values()) {
    upkeep += FACILITY_DEFS[facility.type].upkeep / 30;
  }
  const roadMaintenance = roadTiles * 0.05;

  const net = residentialTax + commercialTax + industrialTax - upkeep - roadMaintenance;

  return { residentialTax, commercialTax, industrialTax, upkeep, roadMaintenance, net };
}
