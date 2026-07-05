import { CityMap } from './grid';
import { NetworkFlag, Terrain } from './types';

/**
 * Phase 3 placeholder: land value driven only by proximity to water and
 * roads. Phase 4 extends this with pollution, crime, fire risk, parks, and
 * distance to city services — see SIMULATION.md.
 */
export function computeLandValue(map: CityMap): void {
  const width = map.width;
  const height = map.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = map.idx(x, y);
      if (map.terrain[i] === Terrain.Water) {
        map.landValue[i] = 0;
        continue;
      }

      let value = 90;

      let nearWater = false;
      let nearRoad = false;
      for (let dy = -3; dy <= 3 && !nearWater; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          if (map.terrain[map.idx(nx, ny)] === Terrain.Water) {
            nearWater = true;
            break;
          }
        }
      }
      for (let dy = -2; dy <= 2 && !nearRoad; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          if (map.networks[map.idx(nx, ny)] & NetworkFlag.Road) {
            nearRoad = true;
            break;
          }
        }
      }

      if (nearWater) value += 40;
      if (nearRoad) value += 20;
      if (map.forest[i]) value += 10;

      map.landValue[i] = Math.max(0, Math.min(255, value));
    }
  }
}

export function averageLandValue(map: CityMap): number {
  let sum = 0;
  let count = 0;
  const n = map.width * map.height;
  for (let i = 0; i < n; i++) {
    if (map.terrain[i] === Terrain.Water) continue;
    sum += map.landValue[i];
    count++;
  }
  return count > 0 ? sum / count : 128;
}
