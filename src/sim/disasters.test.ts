import { describe, expect, it } from 'vitest';
import { CityMap } from './grid';
import { applyTool } from './tools';
import { computeServiceCoverage } from './services';
import { updateFires, triggerEarthquake } from './disasters';
import { Terrain, ZoneType } from './types';

function makeFlatMap(size = 20): CityMap {
  const map = new CityMap(size, size);
  map.terrain.fill(Terrain.Land);
  return map;
}

describe('updateFires', () => {
  it('destroys a burning tile and clears its disaster flag', () => {
    const map = makeFlatMap();
    const i = map.idx(5, 5);
    map.zone[i] = ZoneType.ResidentialHigh;
    map.developmentLevel[i] = 3;
    map.population[i] = 60;
    map.disaster[i] = 1; // already on fire from a previous tick

    const coverage = computeServiceCoverage(map);
    const result = updateFires(map, coverage);

    expect(result.destroyed).toBe(1);
    expect(map.developmentLevel[i]).toBe(0);
    expect(map.population[i]).toBe(0);
    expect(map.abandoned[i]).toBe(1);
    expect(map.disaster[i]).toBe(0);
  });

  it('never ignites a tile with zero fire risk', () => {
    const map = makeFlatMap();
    // no development anywhere, so fireRisk stays 0 everywhere
    const coverage = computeServiceCoverage(map);
    const result = updateFires(map, coverage);
    expect(result.ignited).toBe(0);
  });
});

describe('triggerEarthquake', () => {
  it('destroys buildings and knocks out infrastructure near the epicenter', () => {
    const map = makeFlatMap();
    const funds = 100000;
    for (let x = 8; x <= 12; x++) {
      applyTool(map, 'road', x, 10, funds);
      map.zone[map.idx(x, 10)] = ZoneType.CommercialHigh;
      map.developmentLevel[map.idx(x, 10)] = 3;
      map.jobs[map.idx(x, 10)] = 45;
    }

    // Force every roll in the epicenter to hit by stubbing Math.random low.
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const destroyed = triggerEarthquake(map, 10, 10, 5);
      expect(destroyed).toBeGreaterThan(0);
      expect(map.networks[map.idx(10, 10)]).toBe(0);
    } finally {
      Math.random = originalRandom;
    }
  });
});
