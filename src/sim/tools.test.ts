import { describe, expect, it } from 'vitest';
import { CityMap } from './grid';
import { applyTool } from './tools';
import { NetworkFlag, Terrain, ZoneType } from './types';

function makeFlatMap(size = 20): CityMap {
  const map = new CityMap(size, size);
  map.terrain.fill(Terrain.Land);
  return map;
}

describe('facility placement', () => {
  it('refuses to place a facility on top of a zoned/developed tile instead of silently bulldozing it', () => {
    const map = makeFlatMap();
    const funds = 100000;
    const zonedIdx = map.idx(5, 5);
    applyTool(map, 'zone_res_high', 5, 5, funds);
    map.developmentLevel[zonedIdx] = 3;
    map.population[zonedIdx] = 60;

    // Coal plant is 4x4; origin (4,4) would cover (5,5).
    const result = applyTool(map, 'facility_power_coal', 4, 4, funds);

    expect(result.changed).toBe(false);
    expect(map.zone[zonedIdx]).toBe(ZoneType.ResidentialHigh);
    expect(map.developmentLevel[zonedIdx]).toBe(3);
    expect(map.population[zonedIdx]).toBe(60);
    expect(map.facilityId[zonedIdx]).toBe(0);
  });

  it('refuses to place a facility on top of a road/power/water tile', () => {
    const map = makeFlatMap();
    const funds = 100000;
    const roadIdx = map.idx(6, 6);
    applyTool(map, 'road', 6, 6, funds);

    const result = applyTool(map, 'facility_police', 5, 5, funds); // 2x2, covers (6,6)

    expect(result.changed).toBe(false);
    expect(map.networks[roadIdx] & NetworkFlag.Road).toBe(NetworkFlag.Road);
  });

  it('still allows placement on empty land, and clears the full footprint cleanly', () => {
    const map = makeFlatMap();
    const funds = 100000;

    const result = applyTool(map, 'facility_power_coal', 4, 4, funds);

    expect(result.changed).toBe(true);
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        const i = map.idx(4 + dx, 4 + dy);
        expect(map.facilityId[i]).toBeGreaterThan(0);
        expect(map.zone[i]).toBe(ZoneType.None);
        expect(map.developmentLevel[i]).toBe(0);
      }
    }
  });

  it('requires bulldozing a zoned tile before a facility can be placed there', () => {
    const map = makeFlatMap();
    const funds = 100000;
    const zonedIdx = map.idx(5, 5);
    applyTool(map, 'zone_res_high', 5, 5, funds);

    expect(applyTool(map, 'facility_power_coal', 4, 4, funds).changed).toBe(false);

    applyTool(map, 'bulldoze', 5, 5, funds);
    expect(map.zone[zonedIdx]).toBe(ZoneType.None);

    expect(applyTool(map, 'facility_power_coal', 4, 4, funds).changed).toBe(true);
  });
});

describe('bridges', () => {
  function makeWaterMap(size = 20): CityMap {
    const map = new CityMap(size, size);
    map.terrain.fill(Terrain.Water);
    return map;
  }

  it('allows a road to span open water, at a premium over normal cost', () => {
    const map = makeWaterMap();
    const funds = 100000;
    const i = map.idx(5, 5);

    const result = applyTool(map, 'road', 5, 5, funds);

    expect(result.changed).toBe(true);
    expect(result.cost).toBeGreaterThan(10); // more than plain road cost
    expect(map.networks[i] & NetworkFlag.Road).toBe(NetworkFlag.Road);
    expect(map.terrain[i]).toBe(Terrain.Water); // still water underneath
  });

  it('allows rail to span open water too', () => {
    const map = makeWaterMap();
    const funds = 100000;
    const result = applyTool(map, 'rail', 5, 5, funds);
    expect(result.changed).toBe(true);
    expect(map.networks[map.idx(5, 5)] & NetworkFlag.Rail).toBe(NetworkFlag.Rail);
  });

  it('refuses power lines/water pipes on open water with no bridge deck', () => {
    const map = makeWaterMap();
    const funds = 100000;
    expect(applyTool(map, 'powerline', 5, 5, funds).changed).toBe(false);
    expect(applyTool(map, 'waterpipe', 5, 5, funds).changed).toBe(false);
  });

  it('allows power lines/water pipes to piggyback once a bridge deck exists, at normal cost', () => {
    const map = makeWaterMap();
    const funds = 100000;
    applyTool(map, 'road', 5, 5, funds);

    const result = applyTool(map, 'powerline', 5, 5, funds);

    expect(result.changed).toBe(true);
    expect(result.cost).toBe(5); // normal powerline cost, not a bridge premium
    expect(map.networks[map.idx(5, 5)] & NetworkFlag.PowerLine).toBe(NetworkFlag.PowerLine);
  });

  it('still refuses zoning on a bridge tile', () => {
    const map = makeWaterMap();
    const funds = 100000;
    applyTool(map, 'road', 5, 5, funds);
    const result = applyTool(map, 'zone_res_low', 5, 5, funds);
    expect(result.changed).toBe(false);
  });
});
