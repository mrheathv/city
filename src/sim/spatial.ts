import { CityMap } from './grid';

/**
 * Adds a radially-decaying value (linear falloff from `peak` at the source
 * to 0 at `radius` tiles away) into `field`, measuring distance to the
 * nearest point of a `footprint`x`footprint` source square rather than just
 * its origin tile. Contributions from multiple sources are additive
 * (clamped to 255), modeling overlapping coverage/pollution stacking.
 */
export function accumulateRadialField(
  map: CityMap,
  field: Uint8Array,
  cx: number,
  cy: number,
  radius: number,
  footprint: number,
  peak = 255,
) {
  const r = radius;
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(map.width - 1, Math.ceil(cx + footprint + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(map.height - 1, Math.ceil(cy + footprint + r));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = Math.max(cx - x, 0, x - (cx + footprint - 1));
      const dy = Math.max(cy - y, 0, y - (cy + footprint - 1));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      const strength = Math.round(peak * (1 - dist / r));
      const i = map.idx(x, y);
      field[i] = Math.min(255, field[i] + strength);
    }
  }
}
