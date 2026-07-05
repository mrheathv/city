import { CityMap } from '../sim/grid';
import { BASE_TILE_SIZE, type Camera, visibleTileRange, worldToScreen } from './camera';
import type { Tileset } from './tileset';

export interface RenderOptions {
  showGrid?: boolean;
  hoverTile?: { x: number; y: number } | null;
  selectedTile?: { x: number; y: number } | null;
  underground?: boolean;
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

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const screen = worldToScreen(camera, screenW, screenH, x * BASE_TILE_SIZE, y * BASE_TILE_SIZE);
      if (opts.underground) {
        tileset.drawUndergroundTile(ctx, map, x, y, screen.x, screen.y, size);
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

  ctx.restore();
}
