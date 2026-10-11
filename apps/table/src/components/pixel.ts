/* ============================================================
   The settings' pictures in the game: loading a side's design, and
   asking for its vistas.

   A vista is built in a worker (vista.worker.ts), one for the page,
   shared by every vista, landmark and thumbnail: each narration line
   draws its card's picture its own way, so a picture is built when its
   card turns, and building costs 8 to 40 ms that the page should not
   spend in the middle of the card's flip. The page asks for a picture
   at a moment and puts what comes back on a canvas.
   ============================================================ */

import * as React from 'react';
import { designFor, isSettingId } from '@maze-deck/art';
import type { Design, Side } from '@maze-deck/art';
import { specKey } from './vistaSpec';
import type { FromVista, ToVista, VistaSpec } from './vistaSpec';

export type { VistaSpec } from './vistaSpec';
export { specKey };

/** The design a setting plays on a side, or null while it loads (or for a setting with none). */
export function useDesign(setting: string, side: Side): Design | null {
  const [design, setDesign] = React.useState<Design | null>(null);
  React.useEffect(() => {
    if (!isSettingId(setting)) { setDesign(null); return undefined; }
    let live = true;
    designFor(setting, side).then(
      (d) => { if (live) setDesign(d); },
      (e: unknown) => { console.error(e); },
    );
    return () => { live = false; };
  }, [setting, side]);
  // A design from another setting or side is stale: show nothing rather than the wrong place.
  return design && design.setting === setting && design.side === side ? design : null;
}

/** A narration line's seed: the setting and the entry, so the same line always comes with the same picture. */
export const seedOf = (setting: string, entryId: string) => `${setting}:${entryId}`;

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (m: FromVista) => void>();
/** Buffers back from the worker, by size, to lend again. */
const spare = new Map<number, ArrayBuffer[]>();

function vistas(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./vista.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<FromVista>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.(e.data);
    };
  }
  return worker;
}

/**
 * The picture `spec` names, at moment `t`: RGBA, top row first, or null
 * if it could not be drawn. Lent: hand it back with `recycle` once it is
 * on a canvas.
 */
export function drawVista(spec: VistaSpec, t: number): Promise<Uint8ClampedArray<ArrayBuffer> | null> {
  const size = spec.W * spec.H * 4;
  const buffer = spare.get(size)?.pop() ?? new ArrayBuffer(size);
  const id = nextId;
  nextId += 1;
  return new Promise((resolve) => {
    waiting.set(id, (m) => {
      if (!m.ok) {
        console.error(m.message);
        recycle(m.buffer);
        resolve(null);
      } else {
        resolve(new Uint8ClampedArray(m.buffer));
      }
    });
    const msg: ToVista = { id, spec, t, buffer };
    vistas().postMessage(msg, [buffer]);
  });
}

export function recycle(buffer: ArrayBuffer): void {
  const list = spare.get(buffer.byteLength) ?? [];
  if (list.length < 4) list.push(buffer);
  spare.set(buffer.byteLength, list);
}

export interface Crop { x: number; y: number; w: number; h: number }

/**
 * A still of a vista, cropped, as a PNG data URL: the storyboard's
 * thumbnails and the route's landmarks. Kept for the page's life; a
 * crossing shows a handful.
 */
const stills = new Map<string, Promise<string>>();

function stillOf(spec: VistaSpec, t: number, crop?: Crop): Promise<string> {
  const r = crop ?? { x: 0, y: 0, w: spec.W, h: spec.H };
  const key = `${specKey(spec)}|${t}|${r.x},${r.y},${r.w},${r.h}`;
  let url = stills.get(key);
  if (!url) {
    url = drawVista(spec, t).then((px) => {
      if (!px) return '';
      const canvas = document.createElement('canvas');
      canvas.width = r.w;
      canvas.height = r.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.putImageData(new ImageData(px, spec.W, spec.H), -r.x, -r.y, r.x, r.y, r.w, r.h);
      recycle(px.buffer);
      return canvas.toDataURL('image/png');
    });
    stills.set(key, url);
  }
  return url;
}

/** A still, once the worker has drawn it: its URL, or null until then. */
export function useStill(spec: VistaSpec | null, t: number, crop?: Crop): string | null {
  const key = spec ? `${specKey(spec)}|${t}|${crop ? `${crop.x},${crop.y},${crop.w},${crop.h}` : ''}` : '';
  const [url, setUrl] = React.useState<{ key: string; url: string } | null>(null);
  React.useEffect(() => {
    if (!spec) return undefined;
    let live = true;
    void stillOf(spec, t, crop).then((u) => { if (live && u) setUrl({ key, url: u }); });
    return () => { live = false; };
    // `key` stands for the spec, the moment and the crop.
  }, [key]);
  return url && url.key === key ? url.url : null;
}
