/* ============================================================
   Seeded randomness.

   The generator's whole state is one integer and it lives inside
   the game state, which is what makes a run reproducible: the
   same seed and the same actions always produce the same game.
   Bugs arrive with a seed attached, and tests never flake.

   Never call Math.random anywhere in this package.
   ============================================================ */

/** The generator's entire state. Serialisable on purpose. */
export interface RngState {
  s: number;
}

/** Turn any string into a well-mixed 32-bit seed. */
export function seedFrom(seed: string): RngState {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // A zero state would stick, so nudge it off.
  return { s: h === 0 ? 0x9e3779b9 : h };
}

/**
 * mulberry32. Advances the state and returns a float in [0, 1).
 * Mutates `rng` — every caller is expected to be working on a
 * state it already cloned.
 */
export function next(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, max). */
export function int(rng: RngState, max: number): number {
  return Math.floor(next(rng) * max);
}

/** A single die. `d(rng, 20)` is a d20 — the result is 1..20. */
export function d(rng: RngState, sides: number): number {
  return int(rng, sides) + 1;
}

/** Fisher-Yates, in place. */
export function shuffle<T>(rng: RngState, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = int(rng, i + 1);
    const a = list[i] as T;
    const b = list[j] as T;
    list[i] = b;
    list[j] = a;
  }
  return list;
}
