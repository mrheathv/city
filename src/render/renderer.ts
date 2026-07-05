import { CityMap } from '../sim/grid';
import { BASE_TILE_SIZE, type Camera, visibleTileRange, worldToScreen } from './camera';
import type { Tileset, ViewMode } from './tileset';
import { FACILITY_DEFS } from '../sim/facilities';

export interface FootprintOverlay {
  x: number;
  y: number;
  size: number;
  valid: boolean;
}

export interface RenderOptions {
  showGrid?: boolean;
  hoverTile?: { x: number; y: number } | null;
  selectedTile?: { x: number; y: number } | null;
  underground?: boolean;
  trafficView?: boolean;
  /** Ghost outline of a facility's footprint at the hovered tile, green/red by validity. */
  footprintPreview?: FootprintOverlay | null;
  /** Brief red flash over a footprint whose placement was just rejected. */
  rejectedFootprint?: FootprintOverlay | null;
}

/**
 * Draws only the tiles currently within the viewport (+ a small pad), which
 * is what keeps pan/zoom smooth on large maps: cost scales with screen area,
 * not map size.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  map: CityMap,
  tileset: Tileset,
  camera: Camera,
  screenW: number,
  screenH: number,
  opts: RenderOptions = {},
) {
  ctx.save();
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, screenW, screenH);

  const { minX, minY, maxX, maxY } = visibleTileRange(camera, screenW, screenH, map.width, map.height);
  const size = BASE_TILE_SIZE * camera.zoom;

  const view: ViewMode = opts.underground ? 'underground' : opts.trafficView ? 'traffic' : 'surface';

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const screen = worldToScreen(camera, screenW, screenH, x * BASE_TILE_SIZE, y * BASE_TILE_SIZE);
      if (view === 'underground') {
        tileset.drawUndergroundTile(ctx, map, x, y, screen.x, screen.y, size);
      } else if (view === 'traffic') {
        tileset.drawTrafficTile(ctx, map, x, y, screen.x, screen.y, size);
      } else {
        tileset.drawTile(ctx, map, x, y, screen.x, screen.y, size);
      }
    }
  }

  if (opts.showGrid && size > 6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y = minY; y <= maxY + 1; y++) {
      const s = worldToScreen(camera, screenW, screenH, minX * BASE_TILE_SIZE, y * BASE_TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(screenW, s.y);
      ctx.stroke();
    }
    for (let x = minX; x <= maxX + 1; x++) {
      const s = worldToScreen(camera, screenW, screenH, x * BASE_TILE_SIZE, minY * BASE_TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, screenH);
      ctx.stroke();
    }
  }

  // Facilities are drawn once each, at their own world position, in a
  // dedicated pass — see the Tileset.drawFacilityOverlay doc comment for
  // why this can't happen inline in the per-tile draw calls above.
  const pad = 4; // footprints can be up to 4 tiles; give some margin before culling
  for (const facility of map.facilities.values()) {
    const def = FACILITY_DEFS[facility.type];
    if (facility.x + def.size < minX - pad || facility.x > maxX + pad) continue;
    if (facility.y + def.size < minY - pad || facility.y > maxY + pad) continue;
    const screen = worldToScreen(camera, screenW, screenH, facility.x * BASE_TILE_SIZE, facility.y * BASE_TILE_SIZE);
    tileset.drawFacilityOverlay(ctx, facility, screen.x, screen.y, size, view);
  }

  if (opts.hoverTile && map.inBounds(opts.hoverTile.x, opts.hoverTile.y)) {
    const s = worldToScreen(camera, screenW, screenH, opts.hoverTile.x * BASE_TILE_SIZE, opts.hoverTile.y * BASE_TILE_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, size - 2, size - 2);
  }

  if (opts.selectedTile && map.inBounds(opts.selectedTile.x, opts.selectedTile.y)) {
    const s = worldToScreen(
      camera,
      screenW,
      screenH,
      opts.selectedTile.x * BASE_TILE_SIZE,
      opts.selectedTile.y * BASE_TILE_SIZE,
    );
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(s.x + 1.5, s.y + 1.5, size - 3, size - 3);
  }

  if (opts.footprintPreview) {
    const { x, y, size: fSize, valid } = opts.footprintPreview;
    const s = worldToScreen(camera, screenW, screenH, x * BASE_TILE_SIZE, y * BASE_TILE_SIZE);
    const w = size * fSize;
    ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.3)';
    ctx.fillRect(s.x, s.y, w, w);
    ctx.strokeStyle = valid ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, w - 2, w - 2);
  }

  if (opts.rejectedFootprint) {
    const { x, y, size: fSize } = opts.rejectedFootprint;
    const s = worldToScreen(camera, screenW, screenH, x * BASE_TILE_SIZE, y * BASE_TILE_SIZE);
    const w = size * fSize;
    ctx.fillStyle = 'rgba(248, 113, 113, 0.45)';
    ctx.fillRect(s.x, s.y, w, w);
    ctx.strokeStyle = 'rgba(248, 113, 113, 1)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(s.x + 1.5, s.y + 1.5, w - 3, w - 3);
  }

  ctx.restore();
}
