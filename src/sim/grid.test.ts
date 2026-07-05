import { describe, expect, it } from 'vitest';
import { createCity } from './grid';
import { Terrain } from './types';

describe('createCity', () => {
  it('is deterministic for a given seed', () => {
    const a = createCity(32, 32, 42);
    const b = createCity(32, 32, 42);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.elevation).toEqual(b.elevation);
  });

  it('produces both land and water tiles', () => {
    const map = createCity(48, 48, 7);
    let land = 0;
    let water = 0;
    for (const t of map.terrain) {
      if (t === Terrain.Land) land++;
      else water++;
    }
    expect(land).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(0);
  });

  it('varies with a different seed', () => {
    const a = createCity(32, 32, 1);
    const b = createCity(32, 32, 2);
    expect(a.terrain).not.toEqual(b.terrain);
  });
});
