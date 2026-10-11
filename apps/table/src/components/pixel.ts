/* ============================================================
   The settings' pictures in the game: loading a side's design, and
   keeping what it has built.

   A design (packages/art/src/paint) builds a picture once, which costs
   10 to 40 ms, and then redraws it at any moment for well under one.
   So pictures are built once per size and card and kept here, shared
   by every vista, landmark and thumbnail that shows them; the vista
   builds the cards not yet turned while the page is idle, so a card
   turning never waits for its picture.
   ============================================================ */

import * as React from 'react';
import { designFor, isSettingId, vistaOf } from '@maze-deck/art';
import type { Category, Design, Made, Side } from '@maze-deck/art';

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

/** Every card a vista can show, and the place at rest. */
export const VISTA_CARDS: readonly (Category | null)[] = [
  null, 'clear-path', 'obstacle', 'wanderer', 'item', 'monster', 'dead-end', 'trap',
];

/**
 * Built vistas, most recently used last. A vista holds a few arrays the
 * size of the picture per light, a few MB at the board's size, so only
 * the cards of about one size are kept.
 */
const built = new Map<string, Made>();
const KEEP = 10;

const keyOf = (d: Design, W: number, H: number, c: Category | null) => `${d.id}|${W}x${H}|${c ?? 'none'}`;

export function vistaMade(d: Design, W: number, H: number, c: Category | null): Made {
  const key = keyOf(d, W, H, c);
  let made = built.get(key);
  if (made) {
    built.delete(key);
  } else {
    made = vistaOf(d, W, H, c);
    made.p.prepare();
  }
  built.set(key, made);
  while (built.size > KEEP) built.delete(built.keys().next().value!);
  return made;
}

export const isBuilt = (d: Design, W: number, H: number, c: Category | null) => built.has(keyOf(d, W, H, c));

/** Draw a picture at a moment into an ImageData-shaped buffer. */
export function drawAt(made: Made, t: number, img: ImageData): void {
  made.p.resolve(t, img);
  made.over?.(img, t);
}

/**
 * A still of a vista, cropped, as a PNG data URL: the storyboard's
 * thumbnails and the route's landmarks. Kept for the page's life; a
 * crossing shows a handful.
 */
const stills = new Map<string, string>();

export interface Crop { x: number; y: number; w: number; h: number }

export function stillOf(d: Design, W: number, H: number, c: Category | null, t: number, crop?: Crop): string {
  const r = crop ?? { x: 0, y: 0, w: W, h: H };
  const key = `${keyOf(d, W, H, c)}|${t}|${r.x},${r.y},${r.w},${r.h}`;
  let url = stills.get(key);
  if (url) return url;
  const canvas = document.createElement('canvas');
  canvas.width = r.w;
  canvas.height = r.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(W, H);
  drawAt(vistaOf(d, W, H, c), t, img);
  ctx.putImageData(img, -r.x, -r.y, r.x, r.y, r.w, r.h);
  url = canvas.toDataURL('image/png');
  stills.set(key, url);
  return url;
}

/** Run jobs one at a time when the page is idle, until cancelled. */
export function whenIdle(jobs: (() => void)[]): () => void {
  const idle = 'requestIdleCallback' in window;
  let i = 0;
  let handle = 0;
  const next = () => {
    if (i >= jobs.length) return;
    handle = idle ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 200);
  };
  const run = () => {
    jobs[i]?.();
    i += 1;
    next();
  };
  next();
  return () => {
    i = jobs.length;
    if (idle) window.cancelIdleCallback(handle); else window.clearTimeout(handle);
  };
}
