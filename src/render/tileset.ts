import { CityMap } from '../sim/grid';
import { NetworkFlag, Terrain, ZoneType, zoneCategory } from '../sim/types';
import { FACILITY_DEFS } from '../sim/facilities';

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

    if (terrain === Terrain.Water) {
      this.drawWater(ctx, x, y, sx, sy, size);
      return;
    }

    this.drawLand(ctx, map, x, y, i, sx, sy, size);

    const zone = map.zone[i] as ZoneType;
    if (zone !== ZoneType.None) {
      this.drawZone(ctx, map, x, y, i, sx, sy, size, zone);
    }

    const net = map.networks[i];
    if (net & NetworkFlag.Rail) this.drawRail(ctx, map, x, y, sx, sy, size);
    if (net & NetworkFlag.Road) this.drawRoad(ctx, map, x, y, sx, sy, size);
    if (net & NetworkFlag.PowerLine) this.drawPowerLine(ctx, map, x, y, sx, sy, size);

    if (map.facilityId[i] > 0) {
      const facility = map.facilities.get(map.facilityId[i]);
      if (facility && facility.x === x && facility.y === y) {
        this.drawFacility(ctx, facility.type, sx, sy, size, FACILITY_DEFS[facility.type].size);
      }
    }

    if (map.disaster[i] === 1) this.drawFire(ctx, x, y, sx, sy, size);
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

  private drawZone(
    ctx: CanvasRenderingContext2D,
    map: CityMap,
    _x: number,
    _y: number,
    i: number,
    sx: number,
    sy: number,
    size: number,
    zone: ZoneType,
  ) {
    const colors = ZONE_COLORS[zone];
    const level = map.developmentLevel[i];
    const abandoned = map.abandoned[i] === 1;

    if (level === 0) {
      // undeveloped zoned lot: translucent tint + dashed border
      ctx.fillStyle = colors.base + '99';
      ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
      return;
    }

    const cat = zoneCategory(zone);
    const height = Math.min(size * 0.85, size * 0.25 * (level + 1));
    const bw = size * 0.7;
    const bx = sx + (size - bw) / 2;
    const by = sy + size - height - size * 0.08;

    ctx.fillStyle = abandoned ? '#3a3a3a' : colors.dev;
    ctx.fillRect(bx, by, bw, height);

    // windows
    ctx.fillStyle = abandoned ? '#222' : cat === 'industrial' ? '#2a2a2a' : '#fef08a';
    const rows = Math.max(1, Math.floor(height / (size * 0.16)));
    const cols = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + bw * (0.15 + c * 0.3);
        const wy = by + size * 0.08 + r * size * 0.16;
        if (wy < by + height - size * 0.05) {
          ctx.fillRect(wx, wy, size * 0.08, size * 0.08);
        }
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

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(h * 0.4)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons: Record<string, string> = {
      power_coal: '⚡',
      power_solar: '☀',
      water_pump: '💧',
      water_tower: '💧',
      police: '★',
      fire: '🔥',
      hospital: '+',
      school: '🎓',
      park: '🌳',
    };
    ctx.fillText(icons[type] ?? '?', sx + w / 2, sy + h / 2);
  }
}
