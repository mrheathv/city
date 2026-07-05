import { CityMap } from './grid';

export interface UtilitySource {
  tileIndices: number[];
  capacity: number;
}

/**
 * Flood-fills a conduit network into connected components, then allocates
 * each component's total source capacity to every demanding tile in it.
 * Allocation order is tile-index order, which is deterministic but not
 * "fair" — see SIMULATION.md for the brownout simplification this implies.
 *
 * A tile conducts if it's a power line/pipe tile, a source facility's
 * footprint, *or* a tile with its own demand (a zoned lot or civic
 * building). That last case is what lets power/water propagate building to
 * building without a dedicated line on every single tile — matching how
 * the classic game worked, where a powered building relays power to its
 * powered neighbors and you only need to actually run wire to bridge gaps
 * of vacant land. Connectivity here is purely topological (can current
 * physically reach this tile), independent of whether capacity actually
 * covers it — a shortfall causes some tiles in the component to go dark
 * during allocation below, not a break in the graph itself.
 */
export function computeUtilityCoverage(
  map: CityMap,
  conduitFlag: number,
  sources: UtilitySource[],
  demandAt: (tileIndex: number) => number,
): Uint8Array {
  const width = map.width;
  const height = map.height;
  const n = width * height;
  const covered = new Uint8Array(n);
  const conductive = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    if (map.networks[i] & conduitFlag) conductive[i] = 1;
    else if (demandAt(i) > 0) conductive[i] = 1;
  }
  for (const src of sources) {
    for (const ti of src.tileIndices) conductive[ti] = 1;
  }

  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);

  for (let startIdx = 0; startIdx < n; startIdx++) {
    if (!conductive[startIdx] || visited[startIdx]) continue;

    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = startIdx;
    visited[startIdx] = 1;
    const component: number[] = [];

    while (qHead < qTail) {
      const cur = queue[qHead++];
      component.push(cur);
      const x = cur % width;
      const y = (cur / width) | 0;
      if (x + 1 < width) {
        const ni = cur + 1;
        if (conductive[ni] && !visited[ni]) {
          visited[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (x - 1 >= 0) {
        const ni = cur - 1;
        if (conductive[ni] && !visited[ni]) {
          visited[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (y + 1 < height) {
        const ni = cur + width;
        if (conductive[ni] && !visited[ni]) {
          visited[ni] = 1;
          queue[qTail++] = ni;
        }
      }
      if (y - 1 >= 0) {
        const ni = cur - width;
        if (conductive[ni] && !visited[ni]) {
          visited[ni] = 1;
          queue[qTail++] = ni;
        }
      }
    }

    const compSet = new Set(component);
    let capacity = 0;
    for (const src of sources) {
      if (src.tileIndices.some((ti) => compSet.has(ti))) capacity += src.capacity;
    }
    if (capacity <= 0) continue;

    // Every demanding tile in the component is already a node in it (demand
    // tiles conduct too, per the doc comment above), so there's no separate
    // "find neighbors of the component" step needed anymore.
    let remaining = capacity;
    for (const pi of component) {
      const d = demandAt(pi);
      if (d <= 0) continue;
      if (remaining >= d) {
        covered[pi] = 1;
        remaining -= d;
      }
    }
  }

  return covered;
}
