export const BASE_TILE_SIZE = 32; // px at zoom = 1

export interface Camera {
  x: number; // world px focused at screen center
  y: number;
  zoom: number; // 0.25 - 3
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function screenToWorld(
  cam: Camera,
  screenW: number,
  screenH: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: cam.x + (sx - screenW / 2) / cam.zoom,
    y: cam.y + (sy - screenH / 2) / cam.zoom,
  };
}

export function worldToScreen(
  cam: Camera,
  screenW: number,
  screenH: number,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return {
    x: (wx - cam.x) * cam.zoom + screenW / 2,
    y: (wy - cam.y) * cam.zoom + screenH / 2,
  };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  return { x: Math.floor(wx / BASE_TILE_SIZE), y: Math.floor(wy / BASE_TILE_SIZE) };
}

/** Returns a new camera zoomed to `newZoom` while keeping the world point under (sx, sy) fixed on screen. */
export function zoomAt(
  cam: Camera,
  screenW: number,
  screenH: number,
  sx: number,
  sy: number,
  newZoom: number,
): Camera {
  const clamped = clampZoom(newZoom);
  const worldAtCursor = screenToWorld(cam, screenW, screenH, sx, sy);
  return {
    zoom: clamped,
    x: worldAtCursor.x - (sx - screenW / 2) / clamped,
    y: worldAtCursor.y - (sy - screenH / 2) / clamped,
  };
}

/** Keeps the camera from panning far past the map edges, with a small margin of slack. */
export function clampCameraToMap(cam: Camera, mapWidth: number, mapHeight: number): Camera {
  const margin = BASE_TILE_SIZE * 8;
  const worldW = mapWidth * BASE_TILE_SIZE;
  const worldH = mapHeight * BASE_TILE_SIZE;
  return {
    ...cam,
    x: Math.max(-margin, Math.min(worldW + margin, cam.x)),
    y: Math.max(-margin, Math.min(worldH + margin, cam.y)),
  };
}

/** Returns the inclusive tile range currently visible on screen, clamped to map bounds. */
export function visibleTileRange(
  cam: Camera,
  screenW: number,
  screenH: number,
  mapWidth: number,
  mapHeight: number,
) {
  const topLeft = screenToWorld(cam, screenW, screenH, 0, 0);
  const bottomRight = screenToWorld(cam, screenW, screenH, screenW, screenH);
  const pad = 2;
  const minX = Math.max(0, Math.floor(topLeft.x / BASE_TILE_SIZE) - pad);
  const minY = Math.max(0, Math.floor(topLeft.y / BASE_TILE_SIZE) - pad);
  const maxX = Math.min(mapWidth - 1, Math.ceil(bottomRight.x / BASE_TILE_SIZE) + pad);
  const maxY = Math.min(mapHeight - 1, Math.ceil(bottomRight.y / BASE_TILE_SIZE) + pad);
  return { minX, minY, maxX, maxY };
}
