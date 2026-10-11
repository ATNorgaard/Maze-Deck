/* What names a vista: shared by the page (pixel.ts) and the worker that
   draws it (vista.worker.ts). */

import type { Category, Side } from '@maze-deck/art/paint';

/** Which picture: a side's design, at a size, with a card (or none yet) and a narration line's seed. */
export interface VistaSpec {
  setting: string;
  side: Side;
  W: number;
  H: number;
  card: Category | null;
  /** A narration line's seed, for its own variation; null is the design as approved. */
  seed: string | null;
}

export type ToVista = { id: number; spec: VistaSpec; t: number; buffer: ArrayBuffer };
export type FromVista = { id: number; ok: boolean; buffer: ArrayBuffer; message?: string };

export const specKey = (s: VistaSpec) => `${s.setting}|${s.side}|${s.W}x${s.H}|${s.card ?? 'none'}|${s.seed ?? ''}`;
