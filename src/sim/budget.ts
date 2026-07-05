import { CityMap } from './grid';
import { FACILITY_DEFS } from './facilities';
import { FacilityType, NetworkFlag, ZoneType } from './types';
import type { TaxRates } from './rci';

export interface DailyBudget {
  residentialTax: number;
  commercialTax: number;
  industrialTax: number;
  powerUpkeep: number;
  waterUpkeep: number;
  serviceUpkeep: number; // police + fire + health + education + parks
  roadMaintenance: number;
  totalRevenue: number;
  totalExpenses: number;
  net: number;
}

const POWER_TYPES = new Set<FacilityType>([FacilityType.PowerPlantCoal, FacilityType.PowerPlantSolar]);
const WATER_TYPES = new Set<FacilityType>([FacilityType.WaterPump, FacilityType.WaterTower]);

/** Daily itemized revenue/expense breakdown, the basis of the monthly/yearly budget report. */
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

  let powerUpkeep = 0;
  let waterUpkeep = 0;
  let serviceUpkeep = 0;
  for (const facility of map.facilities.values()) {
    const dailyUpkeep = FACILITY_DEFS[facility.type].upkeep / 30;
    if (POWER_TYPES.has(facility.type)) powerUpkeep += dailyUpkeep;
    else if (WATER_TYPES.has(facility.type)) waterUpkeep += dailyUpkeep;
    else serviceUpkeep += dailyUpkeep;
  }
  const roadMaintenance = roadTiles * 0.05;

  const totalRevenue = residentialTax + commercialTax + industrialTax;
  const totalExpenses = powerUpkeep + waterUpkeep + serviceUpkeep + roadMaintenance;

  return {
    residentialTax,
    commercialTax,
    industrialTax,
    powerUpkeep,
    waterUpkeep,
    serviceUpkeep,
    roadMaintenance,
    totalRevenue,
    totalExpenses,
    net: totalRevenue - totalExpenses,
  };
}
