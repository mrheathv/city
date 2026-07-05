import { CityMap } from './grid';
import { NetworkFlag, ZoneType, zoneCategory } from './types';
import type { RCIDemand } from './rci';

// Population/jobs generated per development level for each zone type.
// Low-density zones cap at level 2, high-density zones reach level 3 —
// modeling low-rise vs. high-rise development, loosely inspired by the
// original game's density tiers.
const LEVEL_UNITS: Record<number, { perLevel: number; maxLevel: number }> = {
  [ZoneType.ResidentialLow]: { perLevel: 8, maxLevel: 2 },
  [ZoneType.ResidentialHigh]: { perLevel: 20, maxLevel: 3 },
  [ZoneType.CommercialLow]: { perLevel: 6, maxLevel: 2 },
  [ZoneType.CommercialHigh]: { perLevel: 15, maxLevel: 3 },
  [ZoneType.IndustrialLight]: { perLevel: 8, maxLevel: 2 },
  [ZoneType.IndustrialHeavy]: { perLevel: 18, maxLevel: 3 },
};

function hasAdjacentRoad(map: CityMap, x: number, y: number): boolean {
  const neighbors: [number, number][] = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  for (const [nx, ny] of neighbors) {
    if (!map.inBounds(nx, ny)) continue;
    if (map.networks[map.idx(nx, ny)] & NetworkFlag.Road) return true;
  }
  return false;
}

export interface GrowthResult {
  developed: number;
  abandoned: number;
  demolished: number;
}

/**
 * Applies one tick of growth/decay to every zoned tile based on the current
 * RCI demand signal. Each tile rolls independently so growth visibly
 * ripples outward from serviced, well-connected areas rather than jumping
 * uniformly across the whole map.
 */
export function applyGrowth(map: CityMap, demand: RCIDemand): GrowthResult {
  const result: GrowthResult = { developed: 0, abandoned: 0, demolished: 0 };
  const n = map.width * map.height;

  for (let i = 0; i < n; i++) {
    const zone = map.zone[i] as ZoneType;
    if (zone === ZoneType.None) continue;

    const category = zoneCategory(zone);
    const demandValue = category === 'residential' ? demand.residential : category === 'commercial' ? demand.commercial : demand.industrial;

    const x = i % map.width;
    const y = (i / map.width) | 0;
    const serviced = map.powered[i] === 1 && map.watered[i] === 1 && hasAdjacentRoad(map, x, y);
    const units = LEVEL_UNITS[zone];
    const level = map.developmentLevel[i];

    // Land value nudges growth/decay chances but never fully gates them —
    // a rough neighborhood can still fill in slowly under strong demand,
    // and a nice one can still lose buildings under strong negative demand.
    const landValueFactor = 0.5 + 0.5 * (map.landValue[i] / 255); // 0.5..1
    const declineFactor = 1.5 - landValueFactor; // 1..0.5, inverse

    if (!serviced) {
      if (level > 0 && Math.random() < 0.05) {
        map.developmentLevel[i] = Math.max(0, level - 1);
        map.abandoned[i] = 1;
        result.abandoned++;
      }
    } else if (level === 0) {
      if (demandValue > 0 && Math.random() < (demandValue / 400) * landValueFactor) {
        map.developmentLevel[i] = 1;
        map.abandoned[i] = 0;
        result.developed++;
      }
    } else {
      if (demandValue > 10 && level < units.maxLevel && Math.random() < (demandValue / 600) * landValueFactor) {
        map.developmentLevel[i] = level + 1;
        map.abandoned[i] = 0;
        result.developed++;
      } else if (demandValue < -10 && Math.random() < (-demandValue / 500) * declineFactor) {
        map.developmentLevel[i] = Math.max(0, level - 1);
        if (map.developmentLevel[i] === 0) result.demolished++;
        result.abandoned++;
      }
    }

    const finalLevel = map.developmentLevel[i];
    if (finalLevel === 0) {
      map.population[i] = 0;
      map.jobs[i] = 0;
    } else {
      const output = finalLevel * units.perLevel;
      if (category === 'residential') {
        map.population[i] = output;
        map.jobs[i] = 0;
      } else {
        map.jobs[i] = output;
        map.population[i] = 0;
      }
    }
  }

  return result;
}
