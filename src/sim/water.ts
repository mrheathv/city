import { CityMap } from './grid';
import { computeUtilityCoverage, type UtilitySource } from './utility';
import { FACILITY_DEFS } from './facilities';
import { NetworkFlag, ZoneType } from './types';

export const WATER_DEMAND_PER_TILE = 4;

function facilityFootprintIndices(map: CityMap, x: number, y: number, size: number): number[] {
  const indices: number[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (map.inBounds(x + dx, y + dy)) indices.push(map.idx(x + dx, y + dy));
    }
  }
  return indices;
}

function tileNeedsWater(map: CityMap, i: number): number {
  if (map.zone[i] !== ZoneType.None) return WATER_DEMAND_PER_TILE;
  return 0;
}

/** Recomputes which tiles have water service this tick. Mutates map.watered in place. */
export function updateWaterGrid(map: CityMap): void {
  const sources: UtilitySource[] = [];
  for (const facility of map.facilities.values()) {
    const def = FACILITY_DEFS[facility.type];
    if (!def.waterOutput) continue;
    sources.push({
      tileIndices: facilityFootprintIndices(map, facility.x, facility.y, def.size),
      capacity: def.waterOutput,
    });
  }

  const covered = computeUtilityCoverage(map, NetworkFlag.WaterPipe, sources, (i) => tileNeedsWater(map, i));
  map.watered.set(covered);
}
