import { CityMap } from './grid';
import type { ServiceCoverage } from './services';

export interface DisasterSettings {
  enabled: boolean;
}

export const DEFAULT_DISASTER_SETTINGS: DisasterSettings = { enabled: true };

// Tuned so a modestly-sized, poorly-covered city sees an occasional fire
// (roughly one every couple of in-game months) rather than a constant
// stream of them — see SIMULATION.md for the reasoning.
const FIRE_IGNITION_SCALE = 0.00003;
const FIRE_SPREAD_BASE = 0.32;
const FIRE_SUPPRESSION_STRENGTH = 0.85;

export interface FireTickResult {
  ignited: number;
  destroyed: number;
}

/**
 * One generation of a simple fire cellular automaton: tiles that were
 * already burning (from the previous tick) are destroyed and may spread to
 * flammable neighbors; then fresh ignitions roll in proportional to each
 * tile's fire risk. Fire coverage suppresses both spread and (via fireRisk,
 * computed elsewhere) ignition odds.
 */
export function updateFires(map: CityMap, coverage: ServiceCoverage): FireTickResult {
  const width = map.width;
  const height = map.height;
  const n = width * height;
  let destroyed = 0;
  let ignited = 0;

  const previouslyBurning: number[] = [];
  for (let i = 0; i < n; i++) {
    if (map.disaster[i] === 1) previouslyBurning.push(i);
  }

  for (const i of previouslyBurning) {
    if (map.developmentLevel[i] > 0) {
      map.developmentLevel[i] = 0;
      map.population[i] = 0;
      map.jobs[i] = 0;
      map.abandoned[i] = 1;
      destroyed++;
    }
    map.disaster[i] = 0;

    const x = i % width;
    const y = (i / width) | 0;
    const neighbors: [number, number][] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (map.disaster[ni] === 1 || map.developmentLevel[ni] <= 0) continue;
      const suppression = (coverage.fire[ni] / 255) * FIRE_SUPPRESSION_STRENGTH;
      if (Math.random() < FIRE_SPREAD_BASE * (1 - suppression)) {
        map.disaster[ni] = 1;
        ignited++;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (map.disaster[i] === 1 || map.developmentLevel[i] <= 0) continue;
    const risk = map.fireRisk[i] / 255;
    if (risk <= 0) continue;
    if (Math.random() < risk * FIRE_IGNITION_SCALE * 255) {
      map.disaster[i] = 1;
      ignited++;
    }
  }

  return { ignited, destroyed };
}

/** Damages/destroys buildings and knocks out infrastructure in a radius, more severely near the epicenter. */
export function triggerEarthquake(map: CityMap, cx: number, cy: number, radius: number): number {
  let destroyed = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!map.inBounds(x, y)) continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > radius) continue;
      const i = map.idx(x, y);
      const severity = 1 - dist / radius;
      if (Math.random() < severity * 0.8) {
        if (map.developmentLevel[i] > 0) {
          map.developmentLevel[i] = 0;
          map.population[i] = 0;
          map.jobs[i] = 0;
          map.abandoned[i] = 1;
          destroyed++;
        }
        map.networks[i] = 0;
      }
    }
  }
  return destroyed;
}

const EARTHQUAKE_DAILY_CHANCE = 1 / 3000; // roughly once every ~8 in-game years, unprompted

/** Rolls for a rare, unprompted earthquake. Returns the epicenter if one struck. */
export function maybeTriggerRandomEarthquake(map: CityMap): { x: number; y: number } | null {
  if (Math.random() > EARTHQUAKE_DAILY_CHANCE) return null;
  const x = Math.floor(Math.random() * map.width);
  const y = Math.floor(Math.random() * map.height);
  triggerEarthquake(map, x, y, 5 + Math.floor(Math.random() * 4));
  return { x, y };
}
