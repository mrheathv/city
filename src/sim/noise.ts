// Small dependency-free value-noise generator used for terrain generation
// (elevation, water bodies, forest placement). Not cryptographic — just needs
// to be deterministic given a seed so maps can be regenerated/saved by seed.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Precomputed pseudo-random gradient lattice for 2D value noise. */
export class ValueNoise2D {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    this.perm = perm;
  }

  private hash(x: number, y: number): number {
    const p = this.perm;
    return p[(p[x & 255] + y) & 255] / 255;
  }

  private smooth(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /** Sample noise in [0, 1] at continuous coordinates. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const xf = x - x0;
    const yf = y - y0;

    const v00 = this.hash(x0, y0);
    const v10 = this.hash(x0 + 1, y0);
    const v01 = this.hash(x0, y0 + 1);
    const v11 = this.hash(x0 + 1, y0 + 1);

    const sx = this.smooth(xf);
    const sy = this.smooth(yf);

    const top = v00 + (v10 - v00) * sx;
    const bottom = v01 + (v11 - v01) * sx;
    return top + (bottom - top) * sy;
  }

  /** Fractal Brownian Motion: layered octaves for more natural terrain. */
  fbm(x: number, y: number, octaves = 4, persistence = 0.5, scale = 1): number {
    let total = 0;
    let amplitude = 1;
    let maxAmplitude = 0;
    let freq = scale;
    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * freq, y * freq) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      freq *= 2;
    }
    return total / maxAmplitude;
  }
}
