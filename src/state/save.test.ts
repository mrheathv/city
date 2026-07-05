import { describe, expect, it } from 'vitest';
import { createCity } from '../sim/grid';
import { applyTool } from '../sim/tools';
import { serializeCity, deserializeCity } from './save';

describe('save/load round-trip', () => {
  it('preserves terrain, zoning, facilities, and development after serializing', () => {
    const map = createCity(24, 24, 42);
    const funds = 100000;
    // Force this corner to land regardless of the seeded terrain, so the
    // test doesn't depend on where water happened to generate.
    for (let y = 4; y <= 9; y++) {
      for (let x = 4; x <= 9; x++) map.terrain[map.idx(x, y)] = 1;
    }
    applyTool(map, 'road', 5, 5, funds);
    applyTool(map, 'zone_res_low', 5, 4, funds);
    map.developmentLevel[map.idx(5, 4)] = 2;
    map.population[map.idx(5, 4)] = 16;
    applyTool(map, 'facility_police', 8, 8, funds);

    const meta = {
      funds: 12345,
      simDay: 42,
      taxRates: { residential: 11, commercial: 8, industrial: 10 },
      bonds: [],
      nextBondId: 1,
      camera: { x: 100, y: 200, zoom: 1.5 },
      disastersEnabled: true,
    };

    const save = serializeCity(map, meta);
    const restored = deserializeCity(save);

    expect(restored.map.width).toBe(24);
    expect(restored.map.height).toBe(24);
    expect(Array.from(restored.map.terrain)).toEqual(Array.from(map.terrain));
    expect(restored.map.zone[map.idx(5, 4)]).toBe(map.zone[map.idx(5, 4)]);
    expect(restored.map.developmentLevel[map.idx(5, 4)]).toBe(2);
    expect(restored.map.population[map.idx(5, 4)]).toBe(16);
    expect(restored.map.networks[map.idx(5, 5)]).toBe(map.networks[map.idx(5, 5)]);
    expect([...restored.map.facilities.values()]).toHaveLength(1);
    expect(restored.meta.funds).toBe(12345);
    expect(restored.meta.simDay).toBe(42);
    expect(restored.meta.taxRates.residential).toBe(11);
    expect(restored.meta.camera).toEqual(meta.camera);
  });
});
