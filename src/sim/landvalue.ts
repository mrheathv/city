import { CityMap } from './grid';
import { NetworkFlag, Terrain } from './types';
import type { ServiceCoverage } from './services';

/**
 * Land value per tile, recomputed every tick from: proximity to water and
 * roads, forest/park amenity, pollution, crime, fire risk, and civic
 * service coverage. See SIMULATION.md for the full weighting rationale.
 */
export function computeLandValue(map: CityMap, coverage: ServiceCoverage): void {
  const width = map.width;
  const height = map.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = map.idx(x, y);
      if (map.terrain[i] === Terrain.Water) {
        map.landValue[i] = 0;
        continue;
      }

      let value = 80;

      let waterDist = Infinity;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          if (map.terrain[map.idx(nx, ny)] === Terrain.Water) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < waterDist) waterDist = d;
          }
        }
      }
      if (waterDist <= 4) value += 40 * (1 - waterDist / 4);

      let roadDist = Infinity;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          if (map.networks[map.idx(nx, ny)] & NetworkFlag.Road) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < roadDist) roadDist = d;
          }
        }
      }
      if (roadDist <= 3) value += 22 * (1 - roadDist / 3);

      if (map.forest[i]) value += 8;

      value += (coverage.park[i] / 255) * 35;
      value += (coverage.police[i] / 255) * 8;
      value += (coverage.fire[i] / 255) * 6;
      value += (coverage.health[i] / 255) * 8;
      value += (coverage.education[i] / 255) * 8;

      value -= (map.pollution[i] / 255) * 90;
      value -= (map.crime[i] / 255) * 90;
      value -= (map.fireRisk[i] / 255) * 35;

      map.landValue[i] = Math.max(0, Math.min(255, Math.round(value)));
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
