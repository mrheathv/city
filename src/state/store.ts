import { create } from 'zustand';
import { createCity, CityMap } from '../sim/grid';
import type { Camera } from '../render/camera';
import { clampZoom } from '../render/camera';
import type { ToolId, TileInfo } from '../sim/types';
import { applyTool } from '../sim/tools';
import { runSimTick } from '../sim/tick';
import type { SimSpeed } from '../sim/tick';

export const DEFAULT_MAP_SIZE = 48;

export interface GameState {
  map: CityMap;
  mapVersion: number;
  camera: Camera;
  tool: ToolId;
  hoverTile: { x: number; y: number } | null;
  selectedTile: { x: number; y: number } | null;
  selectedTileInfo: TileInfo | null;
  funds: number;
  simDay: number; // in-game days elapsed
  speed: SimSpeed;
  paused: boolean;
  population: number;
  jobs: number;
  taxRates: { residential: number; commercial: number; industrial: number };

  setCamera: (cam: Partial<Camera>) => void;
  setTool: (tool: ToolId) => void;
  setHoverTile: (t: { x: number; y: number } | null) => void;
  paintTile: (x: number, y: number) => void;
  selectTile: (x: number, y: number) => void;
  clearSelection: () => void;
  setSpeed: (s: SimSpeed) => void;
  togglePause: () => void;
  setTaxRate: (kind: 'residential' | 'commercial' | 'industrial', rate: number) => void;
  tick: () => void;
  bumpVersion: () => void;
  newCity: (width: number, height: number, seed: number) => void;
  loadCity: (map: CityMap, extra?: Partial<GameState>) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  map: createCity(DEFAULT_MAP_SIZE, DEFAULT_MAP_SIZE, Date.now() & 0xffffffff),
  mapVersion: 0,
  camera: { x: (DEFAULT_MAP_SIZE * 32) / 2, y: (DEFAULT_MAP_SIZE * 32) / 2, zoom: 1 },
  tool: 'select',
  hoverTile: null,
  selectedTile: null,
  selectedTileInfo: null,
  funds: 20000,
  simDay: 0,
  speed: 1,
  paused: false,
  population: 0,
  jobs: 0,
  taxRates: { residential: 9, commercial: 9, industrial: 9 },

  setCamera: (cam) =>
    set((s) => ({
      camera: {
        x: cam.x ?? s.camera.x,
        y: cam.y ?? s.camera.y,
        zoom: clampZoom(cam.zoom ?? s.camera.zoom),
      },
    })),

  setTool: (tool) => set({ tool }),

  setHoverTile: (t) => set({ hoverTile: t }),

  paintTile: (x, y) => {
    const { map, tool, funds } = get();
    if (!map.inBounds(x, y)) return;
    const result = applyTool(map, tool, x, y, funds);
    if (result.changed) {
      set((s) => ({ mapVersion: s.mapVersion + 1, funds: s.funds - result.cost }));
    }
  },

  selectTile: (x, y) => {
    const { map } = get();
    if (!map.inBounds(x, y)) {
      set({ selectedTile: null, selectedTileInfo: null });
      return;
    }
    set({ selectedTile: { x, y }, selectedTileInfo: map.getTile(x, y) });
  },

  clearSelection: () => set({ selectedTile: null, selectedTileInfo: null }),

  setSpeed: (speed) => set({ speed, paused: false }),

  togglePause: () => set((s) => ({ paused: !s.paused })),

  setTaxRate: (kind, rate) =>
    set((s) => ({ taxRates: { ...s.taxRates, [kind]: Math.max(0, Math.min(20, rate)) } })),

  tick: () => {
    const s = get();
    if (s.paused) return;
    const result = runSimTick(s.map, {
      funds: s.funds,
      taxRates: s.taxRates,
      simDay: s.simDay,
    });
    set({
      funds: result.funds,
      simDay: s.simDay + 1,
      population: result.population,
      jobs: result.jobs,
      mapVersion: s.mapVersion + 1,
      selectedTileInfo: s.selectedTile ? s.map.getTile(s.selectedTile.x, s.selectedTile.y) : null,
    });
  },

  bumpVersion: () => set((s) => ({ mapVersion: s.mapVersion + 1 })),

  newCity: (width, height, seed) => {
    const map = createCity(width, height, seed);
    set({
      map,
      mapVersion: 0,
      camera: { x: (width * 32) / 2, y: (height * 32) / 2, zoom: 1 },
      funds: 20000,
      simDay: 0,
      population: 0,
      jobs: 0,
      selectedTile: null,
      selectedTileInfo: null,
    });
  },

  loadCity: (map, extra) => {
    set({ map, mapVersion: 0, selectedTile: null, selectedTileInfo: null, ...extra });
  },
}));

if (import.meta.env.DEV) {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}
