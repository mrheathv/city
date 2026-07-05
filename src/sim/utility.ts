import { CityMap } from './grid';

export interface UtilitySource {
  tileIndices: number[];
  capacity: number;
}

/**
 * Flood-fills a conduit network (power lines or water pipes, plus any source
 * facility footprints, which also conduct) into connected components, then
 * allocates each component's total source capacity to demanding tiles that
 * touch the network. Allocation order is tile-index order, which is
 * deterministic but not "fair" — see SIMULATION.md for the brownout
 * simplification this implies.
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

    const candidates: number[] = [];
    const consideredSet = new Set<number>();
    for (const ci of component) {
      const cx = ci % width;
      const cy = (ci / width) | 0;
      const pts: [number, number][] = [
        [cx, cy],
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [px, py] of pts) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const pi = py * width + px;
        if (consideredSet.has(pi)) continue;
        consideredSet.add(pi);
        if (demandAt(pi) > 0) candidates.push(pi);
      }
    }

    let remaining = capacity;
    for (const pi of candidates) {
      const d = demandAt(pi);
      if (remaining >= d) {
        covered[pi] = 1;
        remaining -= d;
      }
    }
  }

  return covered;
}
