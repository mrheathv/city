import { CityMap } from './grid';
import { MinHeap } from './heap';
import { NetworkFlag, ZoneType, zoneCategory } from './types';

export interface TrafficResult {
  avgCommuteDistance: number; // tiles, weighted by commuting population
  servedPopulation: number; // population that found a reachable job
  strandedPopulation: number; // population with no road-connected job at all
}

function findAdjacentRoad(map: CityMap, x: number, y: number): number {
  const neighbors: [number, number][] = [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];
  for (const [nx, ny] of neighbors) {
    if (!map.inBounds(nx, ny)) continue;
    const i = map.idx(nx, ny);
    if (map.networks[i] & NetworkFlag.Road) return i;
  }
  return -1;
}

/**
 * Runs a multi-source Dijkstra from every job-holding tile's road entry
 * point across the road network, so every road tile knows its distance to
 * the nearest job and the direction (parent pointer) to get there. Edge
 * weight includes the destination tile's current congestion, so heavily
 * loaded roads look "farther" — this is what lets congestion feed back
 * into commute time rather than just being a cosmetic overlay.
 *
 * Residential tiles then walk their nearest-job parent chain back to that
 * job, adding trip load to every road tile along the way. Running this once
 * per tick (rather than a full shortest-path search per residential tile)
 * keeps the cost roughly O((roads) log(roads)) regardless of population.
 */
export function updateTraffic(map: CityMap): TrafficResult {
  const width = map.width;
  const height = map.height;
  const n = width * height;

  // Congestion decays each tick rather than accumulating forever, so it
  // reflects roughly "current" load, smoothed to avoid single-tick spikes.
  for (let i = 0; i < n; i++) {
    map.traffic[i] = Math.round(map.traffic[i] * 0.55);
  }

  const dist = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  const heap = new MinHeap();

  for (let i = 0; i < n; i++) {
    const zone = map.zone[i] as ZoneType;
    if (zoneCategory(zone) === 'none') continue;
    if (map.jobs[i] <= 0) continue;
    const entry = findAdjacentRoad(map, i % width, (i / width) | 0);
    if (entry < 0) continue;
    if (dist[entry] !== 0) {
      dist[entry] = 0;
      heap.push(entry, 0);
    }
  }

  while (heap.size > 0) {
    const top = heap.pop()!;
    const u = top.node;
    if (visited[u]) continue;
    visited[u] = 1;
    const ux = u % width;
    const uy = (u / width) | 0;
    const neighbors: [number, number][] = [
      [ux, uy - 1],
      [ux + 1, uy],
      [ux, uy + 1],
      [ux - 1, uy],
    ];
    for (const [vx, vy] of neighbors) {
      if (!map.inBounds(vx, vy)) continue;
      const v = map.idx(vx, vy);
      if (!(map.networks[v] & NetworkFlag.Road)) continue;
      const weight = 1 + map.traffic[v] / 40;
      const nd = dist[u] + weight;
      if (nd < dist[v]) {
        dist[v] = nd;
        parent[v] = u;
        heap.push(v, nd);
      }
    }
  }

  let totalCommuteWeighted = 0;
  let servedPopulation = 0;
  let strandedPopulation = 0;

  for (let i = 0; i < n; i++) {
    const zone = map.zone[i] as ZoneType;
    if (zoneCategory(zone) !== 'residential') continue;
    const pop = map.population[i];
    if (pop <= 0) continue;

    const entry = findAdjacentRoad(map, i % width, (i / width) | 0);
    if (entry < 0 || !Number.isFinite(dist[entry])) {
      strandedPopulation += pop;
      continue;
    }

    servedPopulation += pop;
    totalCommuteWeighted += dist[entry] * pop;

    // Roughly half the population commutes to a job on a given day; scale
    // trip load down so a single household doesn't saturate a road tile.
    const trips = Math.max(1, Math.round(pop * 0.5 * 0.2));
    let node = entry;
    let guard = 0;
    while (node >= 0 && guard < width * height) {
      map.traffic[node] = Math.min(255, map.traffic[node] + trips);
      node = parent[node];
      guard++;
    }
  }

  const avgCommuteDistance = servedPopulation > 0 ? totalCommuteWeighted / servedPopulation : 0;

  return { avgCommuteDistance, servedPopulation, strandedPopulation };
}
