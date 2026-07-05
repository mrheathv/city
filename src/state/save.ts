import { CityMap } from '../sim/grid';
import type { Facility } from '../sim/types';
import type { Bond } from '../sim/bonds';
import type { Camera } from '../render/camera';

// Bumping this lets loadGame branch on shape if the format changes later;
// a from-scratch backend migration would read this the same way.
const SAVE_VERSION = 1;

const ARRAY_FIELDS = [
  'terrain',
  'elevation',
  'forest',
  'zone',
  'networks',
  'powered',
  'watered',
  'landValue',
  'pollution',
  'crime',
  'fireRisk',
  'traffic',
  'developmentLevel',
  'abandoned',
] as const;

const WIDE_ARRAY_FIELDS = ['population', 'jobs', 'facilityId'] as const;

export interface SaveGame {
  version: number;
  width: number;
  height: number;
  arrays: Record<(typeof ARRAY_FIELDS)[number], string>;
  wideArrays: Record<(typeof WIDE_ARRAY_FIELDS)[number], string>;
  facilities: Facility[];
  funds: number;
  simDay: number;
  taxRates: { residential: number; commercial: number; industrial: number };
  bonds: Bond[];
  nextBondId: number;
  camera: Camera;
  disastersEnabled: boolean;
  savedAt: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface SaveMeta {
  funds: number;
  simDay: number;
  taxRates: { residential: number; commercial: number; industrial: number };
  bonds: Bond[];
  nextBondId: number;
  camera: Camera;
  disastersEnabled: boolean;
}

export function serializeCity(map: CityMap, meta: SaveMeta): SaveGame {
  const arrays = {} as SaveGame['arrays'];
  for (const field of ARRAY_FIELDS) {
    arrays[field] = bytesToBase64(map[field]);
  }
  const wideArrays = {} as SaveGame['wideArrays'];
  for (const field of WIDE_ARRAY_FIELDS) {
    const src = map[field];
    wideArrays[field] = bytesToBase64(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
  }

  return {
    version: SAVE_VERSION,
    width: map.width,
    height: map.height,
    arrays,
    wideArrays,
    facilities: [...map.facilities.values()],
    funds: meta.funds,
    simDay: meta.simDay,
    taxRates: meta.taxRates,
    bonds: meta.bonds,
    nextBondId: meta.nextBondId,
    camera: meta.camera,
    disastersEnabled: meta.disastersEnabled,
    savedAt: new Date().toISOString(),
  };
}

export function deserializeCity(save: SaveGame): { map: CityMap; meta: SaveMeta } {
  if (save.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${save.version}`);
  }
  const map = new CityMap(save.width, save.height);
  for (const field of ARRAY_FIELDS) {
    map[field].set(base64ToBytes(save.arrays[field]));
  }
  for (const field of WIDE_ARRAY_FIELDS) {
    const bytes = base64ToBytes(save.wideArrays[field]);
    const dst = map[field];
    new Uint8Array(dst.buffer, dst.byteOffset, dst.byteLength).set(bytes);
  }
  map.restoreFacilities(save.facilities);

  return {
    map,
    meta: {
      funds: save.funds,
      simDay: save.simDay,
      taxRates: save.taxRates,
      bonds: save.bonds,
      nextBondId: save.nextBondId,
      camera: save.camera,
      disastersEnabled: save.disastersEnabled ?? true,
    },
  };
}

const STORAGE_KEY = 'metrosim.save.v1';

export function saveToLocalStorage(map: CityMap, meta: SaveMeta): void {
  const save = serializeCity(map, meta);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function loadFromLocalStorage(): { map: CityMap; meta: SaveMeta } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return deserializeCity(JSON.parse(raw) as SaveGame);
  } catch (err) {
    console.error('Failed to load save game', err);
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function clearSavedGame(): void {
  localStorage.removeItem(STORAGE_KEY);
}
