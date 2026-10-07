/* ============================================================
   CARD BACK TILES

   The card back is one 24-unit tile repeated ten across the card
   (packages/ui/src/CardBack.tsx, FIELD). This generator turns out
   new tiles that obey the same contract: a single stroked path,
   one line weight, seamless on all four edges.

   Seamlessness comes for free from generating the maze on a
   TORUS — the cell grid wraps, so a wall or a passage that leaves
   the right edge is the same one that enters on the left. Every
   segment is drawn shifted by half a cell so nothing sits exactly
   on the tile boundary, and any segment that crosses the boundary
   is emitted again shifted by a tile, which the pattern clips.
   ============================================================ */

import { int, rngFor } from '../core/rng';
import type { Rng } from '../core/rng';
import type { Style } from '../core/style';

export type TileMode = 'walls' | 'passages' | 'spiral';

export const TILE_MODES: readonly { id: TileMode; name: string; blurb: string }[] = [
  { id: 'walls', name: 'Walls', blurb: 'The walls of a maze that wraps at every edge.' },
  { id: 'passages', name: 'Passages', blurb: 'The ways through it — a branching tree.' },
  { id: 'spiral', name: 'Fret', blurb: 'A square spiral, the Greek key the print deck wears.' },
];

export interface TileParams {
  mode: TileMode;
  /** Cells across the tile, 3–8. */
  cells: number;
  /** Line-weight multiplier, 0.5–2. */
  weight: number;
  seed: string;
  style: Style;
}

export interface TileLayer {
  d: string;
  strokeWidth: number;
  opacity: number;
  /** Translate, for the engraving's ghost line. */
  shift?: number;
}

export interface Tile {
  size: 24;
  /** The main path — what goes into FIELD. */
  d: string;
  layers: TileLayer[];
  linecap: 'square' | 'round' | 'butt';
  /** Pixel styles want crisp edges and no anti-aliasing. */
  crisp: boolean;
}

type Seg = [number, number, number, number];

const fmt = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

/** Path text for segments, with wrapped copies for any that leave the tile. */
function segmentsToPath(segs: Seg[], size: number): string {
  const parts: string[] = [];
  for (const [x1, y1, x2, y2] of segs) {
    const dxs = [0];
    const dys = [0];
    if (Math.min(x1, x2) < 0) dxs.push(size);
    if (Math.max(x1, x2) > size) dxs.push(-size);
    if (Math.min(y1, y2) < 0) dys.push(size);
    if (Math.max(y1, y2) > size) dys.push(-size);
    for (const dx of dxs) for (const dy of dys) {
      parts.push(`M${fmt(x1 + dx)},${fmt(y1 + dy)} L${fmt(x2 + dx)},${fmt(y2 + dy)}`);
    }
  }
  return parts.join(' ');
}

/** A perfect maze on an n×n torus. Returns which cells connect east and south. */
function torusMaze(n: number, r: Rng): { east: boolean[]; south: boolean[] } {
  const N = n * n;
  const east = new Array<boolean>(N).fill(false);
  const south = new Array<boolean>(N).fill(false);
  const seen = new Array<boolean>(N).fill(false);
  const idx = (x: number, y: number) => (((y % n) + n) % n) * n + (((x % n) + n) % n);
  const stack: number[] = [int(r, 0, N - 1)];
  seen[stack[0]] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % n;
    const cy = Math.floor(cur / n);
    const options: { to: number; dir: 0 | 1 | 2 | 3 }[] = [];
    const cand: [number, 0 | 1 | 2 | 3][] = [
      [idx(cx + 1, cy), 0], [idx(cx, cy + 1), 1], [idx(cx - 1, cy), 2], [idx(cx, cy - 1), 3],
    ];
    for (const [to, dir] of cand) if (!seen[to]) options.push({ to, dir });
    if (!options.length) { stack.pop(); continue; }
    const { to, dir } = options[Math.floor(r() * options.length)];
    if (dir === 0) east[cur] = true;
    else if (dir === 1) south[cur] = true;
    else if (dir === 2) east[to] = true;
    else south[to] = true;
    seen[to] = true;
    stack.push(to);
  }
  return { east, south };
}

function wallSegments(n: number, r: Rng, size: number): Seg[] {
  const { east, south } = torusMaze(n, r);
  const s = size / n;
  const off = s / 2;
  const segs: Seg[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (!east[i]) segs.push([(x + 1) * s - off, y * s - off, (x + 1) * s - off, (y + 1) * s - off]);
    if (!south[i]) segs.push([x * s - off, (y + 1) * s - off, (x + 1) * s - off, (y + 1) * s - off]);
  }
  return segs;
}

function passageSegments(n: number, r: Rng, size: number): Seg[] {
  const { east, south } = torusMaze(n, r);
  const s = size / n;
  const segs: Seg[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    const cx = (x + 0.5) * s;
    const cy = (y + 0.5) * s;
    if (east[i]) segs.push([cx, cy, cx + s, cy]);
    if (south[i]) segs.push([cx, cy, cx, cy + s]);
  }
  return segs;
}

/** A square spiral from a corner inward, rotated by the seed. */
function spiralSegments(n: number, r: Rng, size: number): Seg[] {
  const g = size / n;
  let l = 0, t = g, rt = size - g, b = size - g;
  let x = 0, y = size;
  const pts: [number, number][] = [[x, y]];
  const push = (nx: number, ny: number) => { x = nx; y = ny; pts.push([x, y]); };
  for (let guard = 0; guard < 40 && t < b && l < rt; guard++) {
    push(x, t);
    push(rt, y);
    push(x, b);
    l += 2 * g;
    if (l >= rt) break;
    push(l, y);
    t += 2 * g;
    rt -= 2 * g;
    b -= 2 * g;
  }
  const turns = int(r, 0, 3);
  const c = size / 2;
  const rot = ([px, py]: [number, number]): [number, number] => {
    let qx = px, qy = py;
    for (let k = 0; k < turns; k++) [qx, qy] = [2 * c - qy, qx];
    return [qx, qy];
  };
  const rp = pts.map(rot);
  const segs: Seg[] = [];
  for (let i = 1; i < rp.length; i++) segs.push([rp[i - 1][0], rp[i - 1][1], rp[i][0], rp[i][1]]);
  return segs;
}

export function generateTile(p: TileParams): Tile {
  const size = 24 as const;
  const n = Math.max(3, Math.min(8, Math.round(p.cells)));
  const r = rngFor(p.seed, `tile:${p.mode}:${n}`);
  let segs =
    p.mode === 'walls' ? wallSegments(n, r, size)
    : p.mode === 'passages' ? passageSegments(n, r, size)
    : spiralSegments(n, r, size);

  const cell = size / n;
  const w = p.weight;

  if (p.style === 'pixel') {
    // Snap to the integer grid and draw square-capped strokes a
    // whole number of units wide, so the tile rasterises as pixels.
    const q = Math.max(1, Math.round((cell / 3) * w));
    segs = segs.map(([a, b, c, d]) => [Math.round(a), Math.round(b), Math.round(c), Math.round(d)]);
    const d = segmentsToPath(segs, size);
    return { size, d, layers: [{ d, strokeWidth: q, opacity: 1 }], linecap: 'square', crisp: true };
  }

  const d = segmentsToPath(segs, size);
  if (p.style === 'line') {
    return { size, d, layers: [{ d, strokeWidth: 0.8 * w, opacity: 1 }], linecap: 'butt', crisp: false };
  }
  if (p.style === 'engraving') {
    return {
      size, d, linecap: 'square', crisp: false,
      layers: [
        { d, strokeWidth: 1.0 * w, opacity: 1 },
        { d, strokeWidth: 0.55 * w, opacity: 0.4, shift: 0.9 },
      ],
    };
  }
  return { size, d, layers: [{ d, strokeWidth: 1.5 * w, opacity: 1 }], linecap: 'square', crisp: false };
}

/** The line to paste into `FIELD` in packages/ui/src/CardBack.tsx. */
export function tileFieldLine(name: string, tile: Tile): string {
  return `  ${name}: '${tile.d}',`;
}
