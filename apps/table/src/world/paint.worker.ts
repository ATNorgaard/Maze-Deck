/* ============================================================
   The world's design, drawn off the main thread (world/World.tsx).

   A design works out its picture a dozen times a second: the pixels
   its lights touch, then its sprites, particles and haze. On a phone
   that was most of what the world cost the page, so it is done here,
   and the page is handed the finished picture to upload to the GPU.

   The page asks for a build (a setting's side, at a size), then for
   frames, one at a time, lending a buffer each time; the picture comes
   back in it.
   ============================================================ */

import { designFor, isSettingId } from '@maze-deck/art/paint';
import type { Made, Side } from '@maze-deck/art/paint';

export type ToPainter =
  | { type: 'build'; build: number; setting: string; side: Side; W: number; H: number; gutter: boolean }
  | { type: 'frame'; build: number; t: number; gutter: number; buffer: ArrayBuffer };

export type FromPainter =
  | { type: 'built'; build: number }
  /** The buffer lent, with the picture in it; `painted` is false when it was for an older build. */
  | { type: 'frame'; build: number; painted: boolean; buffer: ArrayBuffer }
  | { type: 'failed'; build: number; message: string };

/** A flame's gutter, 0..0.6, for light j: two flickers, one quick. */
const gutterOf = (t: number, j: number) =>
  0.35 * (0.5 + 0.5 * Math.sin(t * 6.1 + j * 1.7) * Math.sin(t * 2.3 + j))
  + 0.25 * (0.5 + 0.5 * Math.sin(t * 15.7 + j * 2.9));

interface Built {
  build: number;
  made: Made;
  W: number;
  H: number;
  /** How hard the setting's own lights gutter now: its Edge.gutter times the threat. */
  g: { amount: number };
}

let latest = 0;
let current: Built | null = null;

const post = (m: FromPainter, transfer: Transferable[] = []) => self.postMessage(m, { transfer });

function build(m: Extract<ToPainter, { type: 'build' }>): void {
  latest = m.build;
  if (!isSettingId(m.setting)) {
    post({ type: 'failed', build: m.build, message: `No designs for ${m.setting}` });
    return;
  }
  designFor(m.setting, m.side).then((d) => {
    if (m.build !== latest) return;
    const made = d.world(m.W, m.H);
    made.p.prepare();
    const g = { amount: 0 };
    // Where the setting burns flames, its flickering lights gutter as the dark comes.
    if (m.gutter) {
      made.p.fields.forEach((F, j) => {
        const k = F.k;
        F.k = (t: number) => (g.amount > 0 ? k(t) * (1 - g.amount * gutterOf(t, j)) : k(t));
      });
    }
    current = { build: m.build, made, W: m.W, H: m.H, g };
    post({ type: 'built', build: m.build });
  }, (e: unknown) => {
    post({ type: 'failed', build: m.build, message: e instanceof Error ? e.message : String(e) });
  });
}

function frame(m: Extract<ToPainter, { type: 'frame' }>): void {
  const c = current;
  if (!c || c.build !== m.build || m.buffer.byteLength !== c.W * c.H * 4) {
    post({ type: 'frame', build: m.build, painted: false, buffer: m.buffer }, [m.buffer]);
    return;
  }
  const img = { width: c.W, height: c.H, data: new Uint8ClampedArray(m.buffer) };
  c.g.amount = m.gutter;
  c.made.p.resolve(m.t, img);
  c.made.over?.(img, m.t);
  post({ type: 'frame', build: m.build, painted: true, buffer: m.buffer }, [m.buffer]);
}

self.onmessage = (e: MessageEvent<ToPainter>) => {
  if (e.data.type === 'build') build(e.data);
  else frame(e.data);
};
