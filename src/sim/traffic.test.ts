import { describe, expect, it } from 'vitest';
import { CityMap } from './grid';
import { applyTool } from './tools';
import { updateTraffic } from './traffic';
import { Terrain } from './types';

function makeFlatMap(size = 20): CityMap {
  const map = new CityMap(size, size);
  map.terrain.fill(Terrain.Land);
  return map;
}

describe('updateTraffic', () => {
  it('routes commuters from residential tiles to the nearest job and loads the roads between them', () => {
    const map = makeFlatMap();
    const funds = 100000;
    // A single road corridor from x=2 to x=12 at y=5.
    for (let x = 2; x <= 12; x++) applyTool(map, 'road', x, 5, funds);

    // Residents at x=2 (above the road), a job at x=12.
    applyTool(map, 'zone_res_low', 2, 4, funds);
    map.developmentLevel[map.idx(2, 4)] = 1;
    map.population[map.idx(2, 4)] = 20;

    applyTool(map, 'zone_com_low', 12, 4, funds);
    map.developmentLevel[map.idx(12, 4)] = 1;
    map.jobs[map.idx(12, 4)] = 12;

    const result = updateTraffic(map);

    expect(result.avgCommuteDistance).toBeGreaterThan(0);
    expect(result.strandedPopulation).toBe(0);

    // A road tile in the middle of the corridor should have picked up load
    // from the commute, since it's the only path between home and work.
    const midRoad = map.idx(7, 5);
    expect(map.traffic[midRoad]).toBeGreaterThan(0);
  });

  it('marks residents with no road-connected job as stranded', () => {
    const map = makeFlatMap();
    const funds = 100000;
    applyTool(map, 'zone_res_low', 5, 5, funds); // isolated, no road at all
    map.developmentLevel[map.idx(5, 5)] = 1;
    map.population[map.idx(5, 5)] = 10;

    const result = updateTraffic(map);
    expect(result.strandedPopulation).toBe(10);
    expect(result.servedPopulation).toBe(0);
  });

  it('decays congestion over time when trips stop', () => {
    const map = makeFlatMap();
    const i = map.idx(5, 5);
    map.traffic[i] = 200;
    updateTraffic(map);
    expect(map.traffic[i]).toBeLessThan(200);
  });
});
