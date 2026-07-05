import { ValueNoise2D } from './noise';
import { Terrain, ZoneType, type Facility, type FacilityType, type TileInfo } from './types';

/**
 * Struct-of-arrays tile grid. Using typed arrays (rather than an array of
 * per-tile objects) keeps memory compact and cache-friendly so the map can
 * scale from 32x32 up to 128x128+ without a rewrite of the storage layer.
 */
export class CityMap {
  readonly width: number;
  readonly height: number;

  readonly terrain: Uint8Array;
  readonly elevation: Uint8Array;
  readonly forest: Uint8Array;
  readonly zone: Uint8Array;
  readonly networks: Uint8Array;
  readonly powered: Uint8Array;
  readonly watered: Uint8Array;
  readonly landValue: Uint8Array;
  readonly pollution: Uint8Array;
  readonly crime: Uint8Array;
  readonly fireRisk: Uint8Array;
  readonly traffic: Uint8Array;
  readonly population: Uint16Array;
  readonly jobs: Uint16Array;
  readonly developmentLevel: Uint8Array;
  readonly abandoned: Uint8Array;
  readonly facilityId: Uint16Array;

  facilities: Map<number, Facility> = new Map();
  private nextFacilityId = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.terrain = new Uint8Array(n).fill(Terrain.Land);
    this.elevation = new Uint8Array(n);
    this.forest = new Uint8Array(n);
    this.zone = new Uint8Array(n).fill(ZoneType.None);
    this.networks = new Uint8Array(n);
    this.powered = new Uint8Array(n);
    this.watered = new Uint8Array(n);
    this.landValue = new Uint8Array(n);
    this.pollution = new Uint8Array(n);
    this.crime = new Uint8Array(n);
    this.fireRisk = new Uint8Array(n);
    this.traffic = new Uint8Array(n);
    this.population = new Uint16Array(n);
    this.jobs = new Uint16Array(n);
    this.developmentLevel = new Uint8Array(n);
    this.abandoned = new Uint8Array(n);
    this.facilityId = new Uint16Array(n);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  addFacility(type: FacilityType, x: number, y: number): Facility {
    const id = this.nextFacilityId++;
    const facility: Facility = { id, type, x, y };
    this.facilities.set(id, facility);
    return facility;
  }

  removeFacility(id: number) {
    this.facilities.delete(id);
  }

  getTile(x: number, y: number): TileInfo {
    const i = this.idx(x, y);
    return {
      x,
      y,
      terrain: this.terrain[i] as Terrain,
      elevation: this.elevation[i],
      forest: this.forest[i] === 1,
      zone: this.zone[i] as ZoneType,
      networks: this.networks[i],
      powered: this.powered[i] === 1,
      watered: this.watered[i] === 1,
      landValue: this.landValue[i],
      pollution: this.pollution[i],
      crime: this.crime[i],
      fireRisk: this.fireRisk[i],
      traffic: this.traffic[i],
      population: this.population[i],
      jobs: this.jobs[i],
      developmentLevel: this.developmentLevel[i],
      abandoned: this.abandoned[i] === 1,
      facilityId: this.facilityId[i],
    };
  }
}

export interface TerrainGenOptions {
  seed: number;
  waterLevel?: number; // 0-1, fraction of fbm value below which tile is water
  forestDensity?: number; // 0-1
}

/** Generates elevation, water bodies, and forest cover using layered value noise. */
export function generateTerrain(map: CityMap, opts: TerrainGenOptions) {
  const { seed, waterLevel = 0.22, forestDensity = 0.55 } = opts;
  const elevationNoise = new ValueNoise2D(seed);
  const forestNoise = new ValueNoise2D(seed + 1);
  const riverNoise = new ValueNoise2D(seed + 2);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = map.idx(x, y);
      const nx = x / map.width;
      const ny = y / map.height;

      let e = elevationNoise.fbm(x, y, 5, 0.5, 4 / Math.max(map.width, map.height));

      // Gentle radial falloff so large lakes/coastline tend to form away from
      // the very center, leaving a buildable core.
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const edgeDist = Math.sqrt(dx * dx + dy * dy);
      e -= Math.max(0, edgeDist - 0.32) * 0.6;

      // A meandering river band using a separate noise field.
      const riverBand = riverNoise.fbm(x, y, 3, 0.5, 10 / Math.max(map.width, map.height));
      const isRiver = Math.abs(riverBand - 0.5) < 0.012;

      const isWater = e < waterLevel || isRiver;

      map.terrain[i] = isWater ? Terrain.Water : Terrain.Land;
      map.elevation[i] = Math.max(0, Math.min(255, Math.round(e * 255)));

      if (!isWater) {
        const f = forestNoise.fbm(x, y, 3, 0.5, 8 / Math.max(map.width, map.height));
        map.forest[i] = f > 1 - forestDensity * 0.5 ? 1 : 0;
      }
    }
  }
}

export function createCity(width: number, height: number, seed: number): CityMap {
  const map = new CityMap(width, height);
  generateTerrain(map, { seed });
  return map;
}
