import { CityMap } from './grid';
import { accumulateRadialField } from './spatial';
import { FACILITY_DEFS } from './facilities';
import { NetworkFlag, Terrain, ZoneType, zoneCategory } from './types';
import type { ServiceCoverage } from './services';

/** Pollution spreads from industrial development and coal power plants. */
export function computePollution(map: CityMap): void {
  map.pollution.fill(0);
  const n = map.width * map.height;

  for (let i = 0; i < n; i++) {
    const zone = map.zone[i] as ZoneType;
    if (zoneCategory(zone) !== 'industrial') continue;
    const level = map.developmentLevel[i];
    if (level === 0) continue;
    const heavy = zone === ZoneType.IndustrialHeavy;
    const x = i % map.width;
    const y = (i / map.width) | 0;
    const peak = (heavy ? 140 : 70) * (level / 3);
    accumulateRadialField(map, map.pollution, x, y, heavy ? 7 : 5, 1, peak);
  }

  for (const facility of map.facilities.values()) {
    const def = FACILITY_DEFS[facility.type];
    if (!def.pollution) continue;
    accumulateRadialField(map, map.pollution, facility.x, facility.y, 10, def.size, def.pollution);
  }
}

/**
 * Crime and fire risk both rise with occupied building density (more
 * people/jobs on a tile means more opportunity for crime and more ignition
 * sources) and are suppressed by nearby police/fire coverage. Deliberately
 * not a function of land value: land value is downstream of crime, not an
 * input to it, otherwise an empty, undeveloped tile with a bootstrapped
 * land value of 0 would compute nonsensical crime before it ever develops.
 */
export function computeCrimeAndFireRisk(map: CityMap, coverage: ServiceCoverage): void {
  const n = map.width * map.height;
  for (let i = 0; i < n; i++) {
    if (map.terrain[i] === Terrain.Water) {
      map.crime[i] = 0;
      map.fireRisk[i] = 0;
      continue;
    }
    const zone = map.zone[i] as ZoneType;
    const level = map.developmentLevel[i];
    const density = level > 0 ? level * (map.population[i] + map.jobs[i] > 30 ? 1.4 : 1) : 0;

    let crime = density * 14 - coverage.police[i] * 0.6;
    crime = Math.max(0, Math.min(255, crime));
    map.crime[i] = crime;

    const industrialBonus = zoneCategory(zone) === 'industrial' ? 40 : 0;
    let fireRisk = density * 10 + industrialBonus - coverage.fire[i] * 0.6;
    fireRisk = Math.max(0, Math.min(255, fireRisk));
    map.fireRisk[i] = fireRisk;
  }
}

export function hasNearbyRoad(map: CityMap, x: number, y: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      if (map.networks[map.idx(nx, ny)] & NetworkFlag.Road) return true;
    }
  }
  return false;
}
