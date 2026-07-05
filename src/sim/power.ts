import { CityMap } from './grid';
import { computeUtilityCoverage, type UtilitySource } from './utility';
import { FACILITY_DEFS } from './facilities';
import { FacilityType, NetworkFlag, ZoneType } from './types';

export const POWER_DEMAND_PER_TILE = 4;

function facilityFootprintIndices(map: CityMap, x: number, y: number, size: number): number[] {
  const indices: number[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (map.inBounds(x + dx, y + dy)) indices.push(map.idx(x + dx, y + dy));
    }
  }
  return indices;
}

function tileNeedsPower(map: CityMap, i: number): number {
  if (map.zone[i] !== ZoneType.None) return POWER_DEMAND_PER_TILE;
  const fid = map.facilityId[i];
  if (fid > 0) {
    const facility = map.facilities.get(fid);
    if (facility && map.idx(facility.x, facility.y) === i) {
      const def = FACILITY_DEFS[facility.type];
      if (def.type !== FacilityType.Park && !def.powerOutput) return POWER_DEMAND_PER_TILE * 2;
    }
  }
  return 0;
}

/** Recomputes which tiles are powered this tick. Mutates map.powered in place. */
export function updatePowerGrid(map: CityMap): void {
  const sources: UtilitySource[] = [];
  for (const facility of map.facilities.values()) {
    const def = FACILITY_DEFS[facility.type];
    if (!def.powerOutput) continue;
    sources.push({
      tileIndices: facilityFootprintIndices(map, facility.x, facility.y, def.size),
      capacity: def.powerOutput,
    });
  }

  const covered = computeUtilityCoverage(map, NetworkFlag.PowerLine, sources, (i) => tileNeedsPower(map, i));
  map.powered.set(covered);
}
