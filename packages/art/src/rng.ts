/* ============================================================
   Seeded randomness.

   Every generator in the atelier is a pure function of its
   parameters and a seed string, so a piece of artwork can be
   reproduced from its recipe alone. Nothing here touches
   Math.random.
   ============================================================ */

export type Rng = () => number;

/** FNV-1a over the seed text, so any string is a usable seed. */
export function hashSeed(input: string | number): number {
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for pictures. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A generator for one purpose. The salt keeps the streams apart:
 * changing the number of particles must not reshuffle the hills.
 */
export function rngFor(seed: string | number, salt = ''): Rng {
  return mulberry32(hashSeed(`${seed}::${salt}`));
}

export const range = (r: Rng, a: number, b: number): number => a + (b - a) * r();
export const int = (r: Rng, a: number, b: number): number => Math.floor(range(r, a, b + 1));
export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Smooth 1-D value noise in 0..1, periodic every `points` units. */
export function valueNoise1d(r: Rng, points = 64): (x: number) => number {
  const lattice = Array.from({ length: points }, () => r());
  const at = (i: number) => lattice[((i % points) + points) % points];
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f);
    const a = at(i);
    return a + (at(i + 1) - a) * t;
  };
}

/** Fractional Brownian motion over value noise. Still 0..1. */
export function fbm1d(r: Rng, octaves = 3, lacunarity = 2, gain = 0.5): (x: number) => number {
  const layers = Array.from({ length: octaves }, () => valueNoise1d(r));
  return (x: number) => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (const n of layers) {
      sum += amp * n(x * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}

/** A fresh random seed word, for the dice button. */
export function seedWord(): string {
  const a = ['ash', 'brass', 'cold', 'deep', 'ember', 'fret', 'grey', 'hollow', 'iron', 'lantern', 'moss', 'north', 'old', 'pale', 'quiet', 'rust', 'salt', 'thorn', 'under', 'vault', 'wax', 'yew'];
  const b = ['door', 'stair', 'trail', 'dune', 'brick', 'shard', 'pillar', 'gate', 'well', 'cairn', 'arch', 'lamp', 'key', 'road', 'river'];
  const r = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  return `${pick(r, a)}-${pick(r, b)}-${int(r, 10, 99)}`;
}
