import { CityMap } from '../sim/grid';
import { NetworkFlag } from '../sim/types';
import { BASE_TILE_SIZE, type Camera, worldToScreen } from './camera';

/**
 * Purely cosmetic "cars" that animate along road tiles. This is not part of
 * the simulation — no trip data is tracked or persisted — it's a visual
 * layer driven by each tile's existing `traffic` congestion value: busier
 * tiles spawn cars more often and those cars move slower, so the map reads
 * as "busy" without the cost/complexity of simulating individual vehicle
 * trips end to end (that's what the traffic Dijkstra in `sim/traffic.ts`
 * already does in aggregate for congestion and commute time).
 */
interface Particle {
  x: number; // tile-space float (integer part = tile, fractional = progress across it)
  y: number;
  dx: number; // current heading, one of -1/0/1
  dy: number;
  speed: number; // tiles per second, free-flow
  color: string;
  dead: boolean;
}

const MAX_PARTICLES = 220;
const MIN_TRAFFIC_TO_SPAWN = 10; // out of 255 — don't clutter near-empty roads
const SPAWN_RATE_AT_MAX_CONGESTION = 0.9; // spawn chance per tile per second at traffic=255
const BASE_SPEED = 2.2; // tiles/sec at zero congestion
const MIN_SPEED_FACTOR = 0.25; // speed multiplier at traffic=255, so jams visibly crawl
const CAR_COLORS = ['#f5d76e', '#e2e2e2', '#8fc4e8', '#e88f8f'];

type Dir = [number, number];
const DIRS: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function isRoad(map: CityMap, x: number, y: number): boolean {
  return map.inBounds(x, y) && (map.networks[map.idx(x, y)] & NetworkFlag.Road) !== 0;
}

/** Road directions leaving (x,y), excluding an immediate U-turn unless it's the only option. */
function roadDirections(map: CityMap, x: number, y: number, fromDx: number, fromDy: number): Dir[] {
  const forward = DIRS.filter(([dx, dy]) => !(dx === -fromDx && dy === -fromDy) && isRoad(map, x + dx, y + dy));
  if (forward.length > 0) return forward;
  return isRoad(map, x - fromDx, y - fromDy) ? [[-fromDx, -fromDy]] : [];
}

export class TrafficParticleSystem {
  private particles: Particle[] = [];

  update(map: CityMap, dt: number, minX: number, minY: number, maxX: number, maxY: number) {
    for (const p of this.particles) {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      const traffic = map.inBounds(tx, ty) ? map.traffic[map.idx(tx, ty)] : 255;
      const speedFactor = 1 - (traffic / 255) * (1 - MIN_SPEED_FACTOR);

      p.x += p.dx * p.speed * speedFactor * dt;
      p.y += p.dy * p.speed * speedFactor * dt;

      const nx = Math.floor(p.x);
      const ny = Math.floor(p.y);
      if (nx !== tx || ny !== ty) {
        const options = roadDirections(map, nx, ny, p.dx, p.dy);
        if (options.length === 0) {
          p.dead = true;
        } else {
          const straight = options.find(([dx, dy]) => dx === p.dx && dy === p.dy);
          const [dx, dy] = straight ?? options[(Math.random() * options.length) | 0];
          p.dx = dx;
          p.dy = dy;
        }
      }
    }

    this.particles = this.particles.filter(
      (p) => !p.dead && p.x >= minX - 2 && p.x <= maxX + 2 && p.y >= minY - 2 && p.y <= maxY + 2,
    );

    if (this.particles.length >= MAX_PARTICLES) return;

    outer: for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.particles.length >= MAX_PARTICLES) break outer;
        const i = map.idx(x, y);
        if (!(map.networks[i] & NetworkFlag.Road)) continue;
        const traffic = map.traffic[i];
        if (traffic < MIN_TRAFFIC_TO_SPAWN) continue;
        const chance = (traffic / 255) * SPAWN_RATE_AT_MAX_CONGESTION * dt;
        if (Math.random() >= chance) continue;
        const options = roadDirections(map, x, y, 0, 0);
        if (options.length === 0) continue;
        const [dx, dy] = options[(Math.random() * options.length) | 0];
        this.particles.push({
          x: x + 0.5,
          y: y + 0.5,
          dx,
          dy,
          speed: BASE_SPEED * (0.85 + Math.random() * 0.3),
          color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
          dead: false,
        });
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, screenW: number, screenH: number) {
    const size = BASE_TILE_SIZE * camera.zoom;
    if (size < 10) return; // too zoomed out to read as cars; skip entirely
    const carLength = size * 0.4;
    const carWidth = size * 0.22;

    for (const p of this.particles) {
      const screen = worldToScreen(camera, screenW, screenH, p.x * BASE_TILE_SIZE, p.y * BASE_TILE_SIZE);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(Math.atan2(p.dy, p.dx));
      ctx.fillStyle = p.color;
      ctx.fillRect(-carLength / 2, -carWidth / 2, carLength, carWidth);
      ctx.restore();
    }
  }
}
