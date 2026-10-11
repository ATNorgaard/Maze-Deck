/* ============================================================
   The vistas, drawn off the main thread (components/pixel.ts).

   Every narration line draws its card's picture its own way
   (`vistaOf` with the line's seed), so a picture is built when its card
   turns: 8 to 40 ms, four times that on a phone, which on the page
   would stall the card's flip. Here it costs the page nothing. The
   page asks for a picture at a moment, lending a buffer; the picture
   comes back in it. Built pictures are kept, most recently used last.
   ============================================================ */

import { designFor, isSettingId, vistaOf } from '@maze-deck/art/paint';
import type { Made } from '@maze-deck/art/paint';
import { specKey } from './vistaSpec';
import type { FromVista, ToVista, VistaSpec } from './vistaSpec';

/** A picture holds a few arrays its size per light: a handful are kept. */
const KEEP = 8;
const built = new Map<string, Promise<Made>>();

function madeFor(spec: VistaSpec): Promise<Made> {
  const key = specKey(spec);
  let made = built.get(key);
  if (made) {
    built.delete(key);
  } else {
    if (!isSettingId(spec.setting)) return Promise.reject(new Error(`No designs for ${spec.setting}`));
    made = designFor(spec.setting, spec.side).then((d) => {
      const m = vistaOf(d, spec.W, spec.H, spec.card, spec.seed);
      m.p.prepare();
      return m;
    });
  }
  built.set(key, made);
  while (built.size > KEEP) built.delete(built.keys().next().value!);
  return made;
}

const post = (m: FromVista) => self.postMessage(m, { transfer: [m.buffer] });

self.onmessage = (e: MessageEvent<ToVista>) => {
  const { id, spec, t, buffer } = e.data;
  madeFor(spec).then((made) => {
    if (buffer.byteLength !== spec.W * spec.H * 4) throw new Error('A buffer of the wrong size');
    const img = { width: spec.W, height: spec.H, data: new Uint8ClampedArray(buffer) };
    made.p.resolve(t, img);
    made.over?.(img, t);
    post({ id, ok: true, buffer });
  }).catch((err: unknown) => {
    built.delete(specKey(spec));
    post({ id, ok: false, buffer, message: err instanceof Error ? err.message : String(err) });
  });
};
