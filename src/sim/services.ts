import { CityMap } from './grid';
import { FACILITY_DEFS } from './facilities';
import { FacilityType } from './types';
import { accumulateRadialField } from './spatial';

export interface ServiceCoverage {
  police: Uint8Array;
  fire: Uint8Array;
  health: Uint8Array;
  education: Uint8Array;
  park: Uint8Array;
}

/**
 * Computes coverage-strength fields (0-255, falling off linearly with
 * distance) for each service type. Overlapping coverage from multiple
 * facilities of the same type stacks (clamped), modeling redundancy.
 */
export function computeServiceCoverage(map: CityMap): ServiceCoverage {
  const n = map.width * map.height;
  const coverage: ServiceCoverage = {
    police: new Uint8Array(n),
    fire: new Uint8Array(n),
    health: new Uint8Array(n),
    education: new Uint8Array(n),
    park: new Uint8Array(n),
  };

  const targetField: Partial<Record<FacilityType, Uint8Array>> = {
    [FacilityType.PoliceStation]: coverage.police,
    [FacilityType.FireStation]: coverage.fire,
    [FacilityType.Hospital]: coverage.health,
    [FacilityType.School]: coverage.education,
    [FacilityType.Park]: coverage.park,
  };

  for (const facility of map.facilities.values()) {
    const def = FACILITY_DEFS[facility.type];
    const field = targetField[facility.type];
    if (!field || def.radius <= 0) continue;
    accumulateRadialField(map, field, facility.x, facility.y, def.radius, def.size);
  }

  return coverage;
}
