import { describe, expect, it } from 'vitest';
import { CityMap } from './grid';
import { applyTool } from './tools';
import { computeServiceCoverage } from './services';
import { computePollution, computeCrimeAndFireRisk } from './environment';
import { computeLandValue } from './landvalue';
import { Terrain } from './types';

function makeFlatMap(size = 30): CityMap {
  const map = new CityMap(size, size);
  map.terrain.fill(Terrain.Land);
  return map;
}

describe('service coverage', () => {
  it('reduces crime near a police station relative to an unpoliced area', () => {
    const map = makeFlatMap();
    const funds = 100000;
    // give both spots the same base density/land-value conditions
    for (const [cx, cy] of [
      [10, 10],
      [20, 20],
    ] as const) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          applyTool(map, 'zone_res_high', x, y, funds);
          map.developmentLevel[map.idx(x, y)] = 3;
          map.population[map.idx(x, y)] = 60;
        }
      }
    }
    applyTool(map, 'facility_police', 9, 9, funds);

    const coverage = computeServiceCoverage(map);
    computePollution(map);
    computeCrimeAndFireRisk(map, coverage);

    const policed = map.crime[map.idx(10, 12)];
    const unpoliced = map.crime[map.idx(20, 20)];
    expect(policed).toBeLessThan(unpoliced);
  });
});

describe('land value', () => {
  it('is higher near a park and lower near heavy industry pollution', () => {
    const map = makeFlatMap();
    const funds = 100000;
    applyTool(map, 'facility_park', 10, 10, funds);
    applyTool(map, 'zone_ind_heavy', 20, 20, funds);
    map.developmentLevel[map.idx(20, 20)] = 3;
    map.jobs[map.idx(20, 20)] = 54;

    const coverage = computeServiceCoverage(map);
    computePollution(map);
    computeCrimeAndFireRisk(map, coverage);
    computeLandValue(map, coverage);

    const nearPark = map.landValue[map.idx(11, 10)];
    const nearIndustry = map.landValue[map.idx(21, 20)];
    const farAway = map.landValue[map.idx(0, 0)];

    expect(nearPark).toBeGreaterThan(farAway);
    expect(nearIndustry).toBeLessThan(farAway);
  });
});
