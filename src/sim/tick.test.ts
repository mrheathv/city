import { describe, expect, it } from 'vitest';
import { CityMap } from './grid';
import { applyTool } from './tools';
import { runSimTick } from './tick';
import { updatePowerGrid } from './power';
import { updateWaterGrid } from './water';
import { applyGrowth } from './growth';
import { Terrain } from './types';

function makeFlatMap(size = 20): CityMap {
  const map = new CityMap(size, size);
  map.terrain.fill(Terrain.Land);
  return map;
}

describe('utility networks', () => {
  it('only powers/waters tiles connected to a source through conduits', () => {
    const map = makeFlatMap();
    const funds = 100000;
    for (let x = 2; x <= 13; x++) {
      applyTool(map, 'road', x, 5, funds);
      applyTool(map, 'powerline', x, 5, funds);
      applyTool(map, 'waterpipe', x, 5, funds);
    }
    for (let x = 2; x <= 6; x++) applyTool(map, 'zone_res_low', x, 4, funds);
    applyTool(map, 'facility_power_coal', 8, 6, funds);
    applyTool(map, 'facility_water_pump', 2, 10, funds);
    for (let y = 6; y <= 9; y++) applyTool(map, 'waterpipe', 2, y, funds);

    updatePowerGrid(map);
    updateWaterGrid(map);

    const connected = map.idx(4, 4);
    expect(map.powered[connected]).toBe(1);
    expect(map.watered[connected]).toBe(1);

    // An identical zoned tile far away with no network nearby should not be powered.
    applyTool(map, 'zone_res_low', 18, 18, funds);
    const disconnected = map.idx(18, 18);
    updatePowerGrid(map);
    updateWaterGrid(map);
    expect(map.powered[disconnected]).toBe(0);
    expect(map.watered[disconnected]).toBe(0);
  });
});

describe('applyGrowth', () => {
  it('develops a serviced zoned tile when demand is strongly positive', () => {
    const map = makeFlatMap();
    const funds = 100000;
    applyTool(map, 'road', 4, 5, funds);
    applyTool(map, 'zone_res_low', 4, 4, funds);
    const i = map.idx(4, 4);
    map.powered[i] = 1;
    map.watered[i] = 1;

    let developed = false;
    for (let day = 0; day < 60 && !developed; day++) {
      applyGrowth(map, { residential: 90, commercial: 0, industrial: 0 });
      if (map.developmentLevel[i] > 0) developed = true;
    }

    expect(developed).toBe(true);
    expect(map.population[i]).toBeGreaterThan(0);
  });

  it('does not develop tiles lacking power, water, or road access', () => {
    const map = makeFlatMap();
    const funds = 100000;
    applyTool(map, 'zone_res_low', 4, 4, funds); // no road, no utilities
    for (let day = 0; day < 60; day++) {
      applyGrowth(map, { residential: 90, commercial: 90, industrial: 90 });
    }
    expect(map.developmentLevel[map.idx(4, 4)]).toBe(0);
  });
});

describe('full city tick integration', () => {
  it('a mixed R/C/I city with services bootstraps population and jobs', () => {
    const map = makeFlatMap(24);
    const funds = 100000;

    for (let x = 1; x <= 20; x++) {
      applyTool(map, 'road', x, 10, funds);
      applyTool(map, 'powerline', x, 10, funds);
      applyTool(map, 'waterpipe', x, 10, funds);
    }
    for (let x = 1; x <= 8; x++) applyTool(map, 'zone_res_low', x, 9, funds);
    for (let x = 9; x <= 14; x++) applyTool(map, 'zone_com_low', x, 9, funds);
    for (let x = 15; x <= 20; x++) applyTool(map, 'zone_ind_light', x, 9, funds);

    applyTool(map, 'facility_power_coal', 1, 11, funds);
    applyTool(map, 'facility_water_pump', 6, 11, funds);
    for (let x = 1; x <= 9; x++) {
      applyTool(map, 'powerline', x, 11, funds);
      applyTool(map, 'waterpipe', x, 11, funds);
    }

    let result;
    for (let day = 0; day < 400; day++) {
      result = runSimTick(map, {
        taxRates: { residential: 9, commercial: 9, industrial: 9 },
        simDay: day,
      });
    }

    expect(result!.population).toBeGreaterThan(0);
    expect(result!.jobs).toBeGreaterThan(0);
  });
});
