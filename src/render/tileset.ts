import { CityMap } from '../sim/grid';
import { NetworkFlag, Terrain, ZoneType, type Facility } from '../sim/types';
import { FACILITY_DEFS } from '../sim/facilities';

export type ViewMode = 'surface' | 'underground' | 'traffic';

/**
 * Procedural placeholder pixel-art tileset. Every draw call is keyed by the
 * same small set of semantic tile facts (terrain, zone, network bitmask,
 * development level) that a future sprite-sheet-backed Tileset would use to
 * pick a source rect — so this class can be swapped for an
 * `ImageTileset` later without touching simulation or renderer code, as long
 * as it implements the same `Tileset` interface.
 */
export interface Tileset {
  drawTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number): void;
  /** Underground layer: dims the surface and highlights the water pipe network, since pipes have no surface presence. */
  drawUndergroundTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number): void;
  /** Traffic layer: dims the surface and colors every road tile by its congestion level (green→yellow→red). */
  drawTrafficTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number): void;
  /**
   * Draws one facility at its own world position, sized to its full NxN
   * footprint. Called once per facility in a dedicated pass *after* the base
   * tile grid is fully drawn — drawing a multi-tile building inline in
   * per-tile draw calls doesn't work, because tiles iterated after the
   * facility's origin tile (to its right/below) paint their own background
   * back over the parts of the building that overflowed into their cell.
   */
  drawFacilityOverlay(
    ctx: CanvasRenderingContext2D,
    facility: Facility,
    sx: number,
    sy: number,
    size: number,
    view: ViewMode,
  ): void;
}

/** Green (clear) -> yellow (busy) -> red (gridlocked), across the full 0-255 congestion range. */
function congestionColor(traffic: number): string {
  const t = Math.max(0, Math.min(255, traffic)) / 255;
  if (t < 0.5) {
    const k = t / 0.5;
    const r = Math.round(74 + k * (250 - 74));
    const g = Math.round(222 + k * (204 - 222));
    const b = Math.round(128 + k * (21 - 128));
    return `rgb(${r},${g},${b})`;
  }
  const k = (t - 0.5) / 0.5;
  const r = Math.round(250 + k * (220 - 250));
  const g = Math.round(204 + k * (38 - 204));
  const b = Math.round(21 + k * (38 - 21));
  return `rgb(${r},${g},${b})`;
}

const ZONE_COLORS: Record<number, { base: string; dev: string }> = {
  [ZoneType.ResidentialLow]: { base: '#1f4d2c', dev: '#3fae56' },
  [ZoneType.ResidentialHigh]: { base: '#1f4d2c', dev: '#2e8c47' },
  [ZoneType.CommercialLow]: { base: '#173a52', dev: '#3b82c4' },
  [ZoneType.CommercialHigh]: { base: '#173a52', dev: '#2f6ba3' },
  [ZoneType.IndustrialLight]: { base: '#4d4519', dev: '#c4a83b' },
  [ZoneType.IndustrialHeavy]: { base: '#4d3519', dev: '#b8752f' },
};

function hashRand(x: number, y: number, salt = 0): number {
  let h = x * 374761393 + y * 668265263 + salt * 97531;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 1000) / 1000;
}

export class PlaceholderTileset implements Tileset {
  drawTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const i = map.idx(x, y);
    const terrain = map.terrain[i];
    const net = map.networks[i];
    const isBridge = terrain === Terrain.Water && (net & (NetworkFlag.Road | NetworkFlag.Rail)) !== 0;

    if (terrain === Terrain.Water && !isBridge) {
      this.drawWater(ctx, x, y, sx, sy, size);
      return;
    }

    if (isBridge) {
      // Water underneath, so the bridge still visibly spans it, plus a deck.
      this.drawWater(ctx, x, y, sx, sy, size);
      this.drawBridgeDeck(ctx, map, x, y, sx, sy, size);
    } else {
      this.drawLand(ctx, map, x, y, i, sx, sy, size);

      const zone = map.zone[i] as ZoneType;
      if (zone !== ZoneType.None) {
        this.drawZone(ctx, map, x, y, i, sx, sy, size, zone);
      }
    }

    if (net & NetworkFlag.Rail) this.drawRail(ctx, map, x, y, sx, sy, size);
    if (net & NetworkFlag.Road) this.drawRoad(ctx, map, x, y, sx, sy, size);
    if (net & NetworkFlag.PowerLine) this.drawPowerLine(ctx, map, x, y, sx, sy, size);

    if (map.disaster[i] === 1) this.drawFire(ctx, x, y, sx, sy, size);
  }

  drawUndergroundTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const i = map.idx(x, y);
    const isWater = map.terrain[i] === Terrain.Water;

    ctx.fillStyle = isWater ? '#0d1f2b' : '#1b1f24';
    ctx.fillRect(sx, sy, size, size);

    // Roads render as a faint outline only, for spatial reference — the
    // point of this view is the pipe network, not the street grid.
    if (map.networks[i] & NetworkFlag.Road) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.strokeRect(sx + size * 0.15, sy + size * 0.15, size * 0.7, size * 0.7);
    }

    if (map.networks[i] & NetworkFlag.WaterPipe) {
      this.drawPipe(ctx, map, x, y, sx, sy, size);
    }
  }

  drawTrafficTile(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const i = map.idx(x, y);
    const isWater = map.terrain[i] === Terrain.Water;

    ctx.fillStyle = isWater ? '#10161d' : '#1a1d1a';
    ctx.fillRect(sx, sy, size, size);

    if (map.networks[i] & NetworkFlag.Road) {
      const mask = this.roadNeighborMask(map, x, y);
      const color = congestionColor(map.traffic[i]);
      const cx = sx + size / 2;
      const cy = sy + size / 2;
      const half = size * 0.34;

      ctx.fillStyle = color;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      if (mask & 1 || mask === 0) ctx.fillRect(cx - half, sy, half * 2, cy - sy);
      if (mask & 2 || mask === 0) ctx.fillRect(cx, cy - half, sx + size - cx, half * 2);
      if (mask & 4 || mask === 0) ctx.fillRect(cx - half, cy, half * 2, sy + size - cy);
      if (mask & 8 || mask === 0) ctx.fillRect(sx, cy - half, cx - sx, half * 2);
    }
  }

  private pipeNeighborMask(map: CityMap, x: number, y: number): number {
    let mask = 0;
    const has = (nx: number, ny: number) =>
      map.inBounds(nx, ny) && (map.networks[map.idx(nx, ny)] & NetworkFlag.WaterPipe) !== 0;
    if (has(x, y - 1)) mask |= 1;
    if (has(x + 1, y)) mask |= 2;
    if (has(x, y + 1)) mask |= 4;
    if (has(x - 1, y)) mask |= 8;
    return mask;
  }

  private drawPipe(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const mask = this.pipeNeighborMask(map, x, y);
    const cx = sx + size / 2;
    const cy = sy + size / 2;

    ctx.strokeStyle = '#2fb6e0';
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.lineCap = 'round';

    // Spurs radiate from the center hub toward each connected neighbor; an
    // isolated pipe tile draws all four so it still reads as "a pipe" (same
    // convention drawRoad uses for isolated road tiles).
    if (mask & 1 || mask === 0) this.strokeSpur(ctx, cx, cy, cx, sy);
    if (mask & 2 || mask === 0) this.strokeSpur(ctx, cx, cy, sx + size, cy);
    if (mask & 4 || mask === 0) this.strokeSpur(ctx, cx, cy, cx, sy + size);
    if (mask & 8 || mask === 0) this.strokeSpur(ctx, cx, cy, sx, cy);

    ctx.fillStyle = '#8fe3ff';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  private strokeSpur(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number, size: number) {
    const flicker = hashRand(x, y, 3);
    ctx.fillStyle = `rgba(255,${100 + Math.round(flicker * 80)},0,0.85)`;
    const cx = sx + size / 2;
    const cy = sy + size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, sy + size * 0.1);
    ctx.quadraticCurveTo(sx + size * 0.85, cy, cx, sy + size * 0.9);
    ctx.quadraticCurveTo(sx + size * 0.15, cy, cx, sy + size * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,120,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.1, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number, size: number) {
    ctx.fillStyle = '#1a4d73';
    ctx.fillRect(sx, sy, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = Math.max(1, size * 0.04);
    const wobble = hashRand(x, y) * size * 0.3;
    ctx.beginPath();
    ctx.moveTo(sx, sy + size * 0.4 + wobble);
    ctx.quadraticCurveTo(sx + size * 0.5, sy + size * 0.3, sx + size, sy + size * 0.4 + wobble);
    ctx.stroke();
  }

  private drawBridgeDeck(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const deckFlag = NetworkFlag.Road | NetworkFlag.Rail;
    const has = (nx: number, ny: number) => map.inBounds(nx, ny) && (map.networks[map.idx(nx, ny)] & deckFlag) !== 0;
    const horiz = has(x - 1, y) || has(x + 1, y);
    const vert = has(x, y - 1) || has(x, y + 1);
    const isVertical = vert && !horiz;

    ctx.fillStyle = '#6b5c45';
    ctx.fillRect(sx, sy, size, size);

    // Railings along the two edges parallel to the direction of travel.
    ctx.strokeStyle = '#463a29';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    if (isVertical) {
      ctx.moveTo(sx + size * 0.08, sy);
      ctx.lineTo(sx + size * 0.08, sy + size);
      ctx.moveTo(sx + size * 0.92, sy);
      ctx.lineTo(sx + size * 0.92, sy + size);
    } else {
      ctx.moveTo(sx, sy + size * 0.08);
      ctx.lineTo(sx + size, sy + size * 0.08);
      ctx.moveTo(sx, sy + size * 0.92);
      ctx.lineTo(sx + size, sy + size * 0.92);
    }
    ctx.stroke();

    // Plank seams perpendicular to the direction of travel.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, size * 0.03);
    for (let t = 0.2; t < 1; t += 0.3) {
      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(sx + size * 0.12, sy + size * t);
        ctx.lineTo(sx + size * 0.88, sy + size * t);
      } else {
        ctx.moveTo(sx + size * t, sy + size * 0.12);
        ctx.lineTo(sx + size * t, sy + size * 0.88);
      }
      ctx.stroke();
    }
  }

  private drawLand(
    ctx: CanvasRenderingContext2D,
    map: CityMap,
    x: number,
    y: number,
    i: number,
    sx: number,
    sy: number,
    size: number,
  ) {
    const elev = map.elevation[i] / 255;
    // shade darker->lighter green with elevation
    const g = Math.round(70 + elev * 60);
    ctx.fillStyle = `rgb(${Math.round(40 + elev * 20)},${g + 40},${Math.round(45 + elev * 15)})`;
    ctx.fillRect(sx, sy, size, size);

    if (map.forest[i] === 1) {
      ctx.fillStyle = '#0f5c2e';
      const r = size * 0.22;
      const cx = sx + size * 0.5 + (hashRand(x, y, 1) - 0.5) * size * 0.2;
      const cy = sy + size * 0.5 + (hashRand(x, y, 2) - 0.5) * size * 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#123';
      ctx.fillRect(cx - size * 0.03, cy + r * 0.5, size * 0.06, size * 0.15);
    }
  }

  /** Lightens (amt > 0) or darkens (amt < 0) a "#rrggbb" color; amt is roughly -1..1. */
  private shade(hex: string, amt: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    const adj = (c: number) => {
      const t = amt >= 0 ? 255 - c : c;
      return Math.max(0, Math.min(255, Math.round(c + t * amt)));
    };
    return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
  }

  private drawZone(
    ctx: CanvasRenderingContext2D,
    map: CityMap,
    x: number,
    y: number,
    i: number,
    sx: number,
    sy: number,
    size: number,
    zone: ZoneType,
  ) {
    const level = map.developmentLevel[i];
    const abandoned = map.abandoned[i] === 1;

    if (level === 0) {
      // undeveloped zoned lot: translucent tint + dashed border, reading as a planned lot
      const colors = ZONE_COLORS[zone];
      ctx.fillStyle = colors.base + '99';
      ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.setLineDash([size * 0.1, size * 0.08]);
      ctx.strokeRect(sx + size * 0.08, sy + size * 0.08, size * 0.84, size * 0.84);
      ctx.setLineDash([]);
      return;
    }

    const seed = hashRand(x, y, 11);

    // Soft drop shadow first, so every building silhouette reads as
    // slightly raised off the ground regardless of its shape.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx + size * 0.52, sy + size * 0.84, size * 0.32, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (zone) {
      case ZoneType.ResidentialLow:
        this.drawHouse(ctx, sx, sy, size, level, abandoned, seed);
        break;
      case ZoneType.ResidentialHigh:
        this.drawApartmentTower(ctx, sx, sy, size, level, abandoned, seed);
        break;
      case ZoneType.CommercialLow:
        this.drawStorefront(ctx, sx, sy, size, level, abandoned, seed);
        break;
      case ZoneType.CommercialHigh:
        this.drawOfficeTower(ctx, sx, sy, size, level, abandoned, seed);
        break;
      case ZoneType.IndustrialLight:
        this.drawWarehouse(ctx, sx, sy, size, level, abandoned, seed);
        break;
      case ZoneType.IndustrialHeavy:
        this.drawFactory(ctx, sx, sy, size, level, abandoned, seed);
        break;
    }
  }

  private drawHouse(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, level: number, abandoned: boolean, seed: number) {
    const wall = abandoned ? '#5c5850' : this.shade(seed > 0.5 ? '#d9c9a3' : '#dfd0b8', (seed - 0.5) * 0.2);
    const roof = abandoned ? '#3a362f' : seed > 0.5 ? '#8a3f32' : '#4f5f6e';

    const bw = size * (level >= 2 ? 0.58 : 0.46);
    const bh = size * (level >= 2 ? 0.32 : 0.26);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.62 - bh / 2;
    const roofH = size * 0.2;

    if (level >= 2) {
      // small side extension, drawn first so the main house overlaps it
      ctx.fillStyle = this.shade(wall, -0.08);
      ctx.fillRect(bx + bw - size * 0.04, by + bh * 0.3, size * 0.2, bh * 0.7);
    }

    ctx.fillStyle = wall;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(bx - size * 0.05, by);
    ctx.lineTo(bx + bw / 2, by - roofH);
    ctx.lineTo(bx + bw + size * 0.05, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = abandoned ? '#1c1a17' : '#4a3626';
    const doorW = size * 0.09;
    const doorH = size * 0.13;
    ctx.fillRect(bx + bw * 0.5 - doorW / 2, by + bh - doorH, doorW, doorH);

    ctx.fillStyle = abandoned ? '#161616' : '#fde68a';
    const win = size * 0.07;
    ctx.fillRect(bx + bw * 0.16, by + bh * 0.32, win, win);
    ctx.fillRect(bx + bw * 0.84 - win, by + bh * 0.32, win, win);
  }

  private drawApartmentTower(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    level: number,
    abandoned: boolean,
    seed: number,
  ) {
    const wall = abandoned ? '#48473f' : this.shade(seed > 0.5 ? '#c9ad82' : '#b3aa98', (seed - 0.5) * 0.15);
    const floors = level + 1;
    const bw = size * 0.56;
    const bh = size * (0.3 + level * 0.17);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.88 - bh;

    ctx.fillStyle = wall;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = this.shade(wall, -0.3);
    ctx.fillRect(bx - size * 0.02, by - size * 0.035, bw + size * 0.04, size * 0.045);

    const cols = 3;
    const rowH = bh / floors;
    const winW = bw * 0.16;
    const winH = rowH * 0.5;
    ctx.fillStyle = abandoned ? '#151515' : '#a9d3e8';
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + bw * (0.15 + c * 0.32);
        const wy = by + rowH * r + rowH * 0.28;
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    if (level >= 3) {
      ctx.fillStyle = this.shade(wall, -0.15);
      ctx.fillRect(bx + bw * 0.6, by - size * 0.12, size * 0.14, size * 0.1);
    }
  }

  private drawStorefront(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    level: number,
    abandoned: boolean,
    seed: number,
  ) {
    const wall = abandoned ? '#454545' : this.shade('#8a8478', (seed - 0.5) * 0.15);
    const bw = size * (level >= 2 ? 0.72 : 0.6);
    const bh = size * (level >= 2 ? 0.34 : 0.24);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.86 - bh;

    ctx.fillStyle = wall;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = abandoned ? '#333' : seed > 0.5 ? '#b3413f' : '#2f6ba3';
    ctx.fillRect(bx - size * 0.02, by + bh * 0.15, bw + size * 0.04, size * 0.05);

    ctx.fillStyle = abandoned ? '#1a1a1a' : '#bfe3f5';
    ctx.fillRect(bx + size * 0.03, by + bh * 0.35, bw - size * 0.06, bh * 0.5);

    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, size * 0.015);
    const panes = 4;
    for (let p = 1; p < panes; p++) {
      const px = bx + size * 0.03 + ((bw - size * 0.06) * p) / panes;
      ctx.beginPath();
      ctx.moveTo(px, by + bh * 0.35);
      ctx.lineTo(px, by + bh * 0.85);
      ctx.stroke();
    }

    if (level >= 2) {
      ctx.fillStyle = abandoned ? '#151515' : '#fde68a';
      ctx.fillRect(bx + bw * 0.2, by + bh * 0.05, bw * 0.15, bh * 0.12);
      ctx.fillRect(bx + bw * 0.65, by + bh * 0.05, bw * 0.15, bh * 0.12);
    }
  }

  private drawOfficeTower(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    level: number,
    abandoned: boolean,
    seed: number,
  ) {
    const glass = abandoned ? '#333' : this.shade('#2f6ba3', (seed - 0.5) * 0.2);
    const bw = size * 0.5;
    const bh = size * (0.34 + level * 0.19);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.9 - bh;

    ctx.fillStyle = abandoned ? '#3a3a3a' : '#dfe6ea';
    ctx.fillRect(bx - size * 0.02, by, bw + size * 0.04, bh);

    ctx.fillStyle = glass;
    ctx.fillRect(bx, by + size * 0.02, bw, bh - size * 0.02);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    const cols = 3;
    for (let c = 1; c < cols; c++) {
      const cxLine = bx + (bw * c) / cols;
      ctx.beginPath();
      ctx.moveTo(cxLine, by);
      ctx.lineTo(cxLine, by + bh);
      ctx.stroke();
    }
    const rows = Math.max(2, level + 1);
    for (let r = 1; r < rows; r++) {
      const cyLine = by + (bh * r) / rows;
      ctx.beginPath();
      ctx.moveTo(bx, cyLine);
      ctx.lineTo(bx + bw, cyLine);
      ctx.stroke();
    }

    if (level >= 3) {
      ctx.strokeStyle = abandoned ? '#555' : '#ccc';
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, by - size * 0.14);
      ctx.stroke();
    }
  }

  private drawWarehouse(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    level: number,
    abandoned: boolean,
    seed: number,
  ) {
    const wall = abandoned ? '#3c3a34' : this.shade('#9a8f6e', (seed - 0.5) * 0.15);
    const bw = size * 0.78;
    const bh = size * (level >= 2 ? 0.36 : 0.26);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.88 - bh;

    ctx.fillStyle = wall;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = this.shade(wall, -0.2);
    ctx.fillRect(bx - size * 0.02, by - size * 0.03, bw + size * 0.04, size * 0.05);

    ctx.fillStyle = abandoned ? '#161616' : '#333';
    const dockW = bw * 0.18;
    ctx.fillRect(bx + bw * 0.15, by + bh - bh * 0.55, dockW, bh * 0.5);
    if (level >= 2) ctx.fillRect(bx + bw * 0.65, by + bh - bh * 0.55, dockW, bh * 0.5);

    ctx.fillStyle = abandoned ? '#111' : '#cfe0e8';
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(bx + bw * (0.1 + c * 0.3), by + bh * 0.12, size * 0.05, size * 0.05);
    }
  }

  private drawFactory(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    level: number,
    abandoned: boolean,
    seed: number,
  ) {
    const wall = abandoned ? '#3a3833' : this.shade('#8f7a4a', (seed - 0.5) * 0.15);
    const bw = size * 0.8;
    const bh = size * (0.3 + level * 0.14);
    const bx = sx + size / 2 - bw / 2;
    const by = sy + size * 0.9 - bh;

    ctx.fillStyle = wall;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = this.shade(wall, -0.12);
    const stripeW = size * 0.05;
    for (let sxi = bx; sxi < bx + bw; sxi += stripeW * 2) {
      ctx.fillRect(sxi, by, stripeW, bh);
    }

    ctx.fillStyle = abandoned ? '#222' : '#c99a2e';
    ctx.fillRect(bx, by + bh - size * 0.04, bw, size * 0.04);

    const stacks = level >= 3 ? 2 : 1;
    for (let s = 0; s < stacks; s++) {
      const scx = bx + bw * (stacks === 1 ? 0.5 : s === 0 ? 0.3 : 0.7);
      ctx.fillStyle = abandoned ? '#333' : '#5c5648';
      ctx.fillRect(scx - size * 0.04, by - size * 0.22, size * 0.08, size * 0.22);
      if (!abandoned && level >= 2) {
        ctx.fillStyle = 'rgba(180,180,180,0.5)';
        ctx.beginPath();
        ctx.arc(scx, by - size * 0.28, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private roadNeighborMask(map: CityMap, x: number, y: number): number {
    let mask = 0;
    const has = (nx: number, ny: number) =>
      map.inBounds(nx, ny) && (map.networks[map.idx(nx, ny)] & NetworkFlag.Road) !== 0;
    if (has(x, y - 1)) mask |= 1; // N
    if (has(x + 1, y)) mask |= 2; // E
    if (has(x, y + 1)) mask |= 4; // S
    if (has(x - 1, y)) mask |= 8; // W
    return mask;
  }

  private drawRoad(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const mask = this.roadNeighborMask(map, x, y);
    ctx.fillStyle = '#333338';
    const cx = sx + size / 2;
    const cy = sy + size / 2;
    const half = size * 0.32;
    // hub
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    // spurs toward connected neighbors (or all four ways for an isolated tile)
    if (mask & 1 || mask === 0) ctx.fillRect(cx - half, sy, half * 2, cy - sy);
    if (mask & 2 || mask === 0) ctx.fillRect(cx, cy - half, sx + size - cx, half * 2);
    if (mask & 4 || mask === 0) ctx.fillRect(cx - half, cy, half * 2, sy + size - cy);
    if (mask & 8 || mask === 0) ctx.fillRect(sx, cy - half, cx - sx, half * 2);

    // congestion tint
    const i = map.idx(x, y);
    const traffic = map.traffic[i];
    if (traffic > 60) {
      const alpha = Math.min(0.55, (traffic - 60) / 200);
      ctx.fillStyle = `rgba(220,50,40,${alpha})`;
      ctx.fillRect(sx, sy, size, size);
    }

    ctx.strokeStyle = '#e8d24a';
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.setLineDash([size * 0.12, size * 0.1]);
    if (mask & 1 || mask & 4 || mask === 0) {
      ctx.beginPath();
      ctx.moveTo(cx, sy);
      ctx.lineTo(cx, sy + size);
      ctx.stroke();
    }
    if (mask & 2 || mask & 8) {
      ctx.beginPath();
      ctx.moveTo(sx, cy);
      ctx.lineTo(sx + size, cy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawRail(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const has = (nx: number, ny: number) =>
      map.inBounds(nx, ny) && (map.networks[map.idx(nx, ny)] & NetworkFlag.Rail) !== 0;
    const horiz = has(x - 1, y) || has(x + 1, y);
    const vert = has(x, y - 1) || has(x, y + 1);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = Math.max(1, size * 0.06);
    const cx = sx + size / 2;
    const cy = sy + size / 2;
    if (horiz || !vert) {
      ctx.beginPath();
      ctx.moveTo(sx, cy);
      ctx.lineTo(sx + size, cy);
      ctx.stroke();
    }
    if (vert) {
      ctx.beginPath();
      ctx.moveTo(cx, sy);
      ctx.lineTo(cx, sy + size);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c9a876';
    ctx.lineWidth = Math.max(1, size * 0.02);
    for (let t = 0.2; t < 1; t += 0.25) {
      ctx.beginPath();
      if (horiz || !vert) {
        ctx.moveTo(sx + size * t, cy - size * 0.15);
        ctx.lineTo(sx + size * t, cy + size * 0.15);
      } else {
        ctx.moveTo(cx - size * 0.15, sy + size * t);
        ctx.lineTo(cx + size * 0.15, sy + size * t);
      }
      ctx.stroke();
    }
  }

  private drawPowerLine(ctx: CanvasRenderingContext2D, map: CityMap, x: number, y: number, sx: number, sy: number, size: number) {
    const has = (nx: number, ny: number) =>
      map.inBounds(nx, ny) && (map.networks[map.idx(nx, ny)] & NetworkFlag.PowerLine) !== 0;
    const cx = sx + size / 2;
    const cy = sy + size / 2;
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx, sy + size * 0.1);
    ctx.lineTo(cx, sy + size * 0.9);
    ctx.stroke();
    ctx.fillStyle = '#b3b3b3';
    ctx.fillRect(cx - size * 0.04, sy + size * 0.05, size * 0.08, size * 0.1);
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      if (has(x + dx, y + dy)) {
        ctx.beginPath();
        ctx.moveTo(cx, sy + size * 0.15);
        ctx.lineTo(cx + dx * size * 0.5, sy + size * 0.15 + dy * 0);
        ctx.lineTo(cx + dx * size, cy + dy * size * 0 + (dy !== 0 ? dy * size * 0.35 : 0));
        ctx.stroke();
      }
    }
  }

  private drawFacility(
    ctx: CanvasRenderingContext2D,
    type: string,
    sx: number,
    sy: number,
    size: number,
    footprint: number,
  ) {
    const w = size * footprint;
    const h = size * footprint;
    const palette: Record<string, string> = {
      power_coal: '#5a5a5a',
      power_solar: '#2b6cb0',
      water_pump: '#1c6e8c',
      water_tower: '#1c6e8c',
      police: '#2b4c9e',
      fire: '#b3352c',
      hospital: '#d94a6a',
      school: '#c98a1f',
      park: '#2f7a3d',
    };
    ctx.fillStyle = palette[type] ?? '#666';
    ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);

    // Vector-drawn icons rather than emoji glyphs: emoji rendering depends on
    // the host having emoji fonts installed, which isn't guaranteed across
    // every browser/OS this canvas might render on — a drawn shape always
    // looks the same everywhere and stays crisp at small tile sizes.
    const cx = sx + w / 2;
    const cy = sy + h / 2;
    const s = Math.min(w, h);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, s * 0.04);

    switch (type) {
      case 'power_coal':
        this.drawBoltIcon(ctx, cx, cy, s);
        break;
      case 'power_solar':
        this.drawSolarIcon(ctx, cx, cy, s);
        break;
      case 'water_pump':
      case 'water_tower':
        this.drawDropletIcon(ctx, cx, cy, s);
        break;
      case 'police':
        this.drawStarIcon(ctx, cx, cy, s);
        break;
      case 'fire':
        this.drawFlameIcon(ctx, cx, cy, s);
        break;
      case 'hospital':
        this.drawCrossIcon(ctx, cx, cy, s);
        break;
      case 'school':
        this.drawCapIcon(ctx, cx, cy, s);
        break;
      case 'park':
        this.drawTreeIcon(ctx, cx, cy, s);
        break;
    }
  }

  private drawBoltIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.06, cy - s * 0.22);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.02);
    ctx.lineTo(cx + s * 0.02, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.06, cy + s * 0.22);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.04);
    ctx.lineTo(cx, cy - s * 0.04);
    ctx.closePath();
    ctx.fill();
  }

  private drawSolarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    const gw = s * 0.36;
    const gh = s * 0.26;
    ctx.strokeRect(cx - gw / 2, cy - gh / 2, gw, gh);
    for (let i = 1; i < 3; i++) {
      const x = cx - gw / 2 + (gw * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x, cy - gh / 2);
      ctx.lineTo(x, cy + gh / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - gw / 2, cy);
    ctx.lineTo(cx + gw / 2, cy);
    ctx.stroke();
  }

  private drawDropletIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    const r = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.26);
    ctx.quadraticCurveTo(cx + r * 1.3, cy + r * 0.4, cx, cy + r * 1.1);
    ctx.quadraticCurveTo(cx - r * 1.3, cy + r * 0.4, cx, cy - s * 0.26);
    ctx.closePath();
    ctx.fill();
  }

  private drawStarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    const spikes = 5;
    const outerR = s * 0.24;
    const innerR = s * 0.1;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawFlameIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.fillStyle = '#ffdd66';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.26);
    ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.02, cx + s * 0.08, cy + s * 0.14);
    ctx.quadraticCurveTo(cx + s * 0.14, cy + s * 0.22, cx, cy + s * 0.26);
    ctx.quadraticCurveTo(cx - s * 0.14, cy + s * 0.22, cx - s * 0.08, cy + s * 0.14);
    ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.02, cx, cy - s * 0.26);
    ctx.closePath();
    ctx.fill();
  }

  private drawCrossIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    const armW = s * 0.12;
    const armL = s * 0.34;
    ctx.fillRect(cx - armW / 2, cy - armL / 2, armW, armL);
    ctx.fillRect(cx - armL / 2, cy - armW / 2, armL, armW);
  }

  private drawCapIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.16);
    ctx.lineTo(cx + s * 0.24, cy - s * 0.02);
    ctx.lineTo(cx, cy + s * 0.12);
    ctx.lineTo(cx - s * 0.24, cy - s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - s * 0.08, cy + s * 0.06, s * 0.16, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.16, cy - s * 0.02);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.14);
    ctx.stroke();
  }

  private drawTreeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.fillStyle = '#6fbf73';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.04, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3323';
    ctx.fillRect(cx - s * 0.03, cy + s * 0.1, s * 0.06, s * 0.14);
  }

  drawFacilityOverlay(
    ctx: CanvasRenderingContext2D,
    facility: Facility,
    sx: number,
    sy: number,
    size: number,
    view: ViewMode,
  ) {
    const def = FACILITY_DEFS[facility.type];
    const isWaterFacility = facility.type === 'water_pump' || facility.type === 'water_tower';

    if (view === 'surface' || (view === 'underground' && isWaterFacility)) {
      this.drawFacility(ctx, facility.type, sx, sy, size, def.size);
      return;
    }

    // Underground (non-water facility) and traffic views: the building
    // still occupies space, but isn't the point of that view — show a dim
    // placeholder so its footprint reads without competing for attention.
    const w = size * def.size;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(sx + 2, sy + 2, w - 4, w - 4);
  }
}
