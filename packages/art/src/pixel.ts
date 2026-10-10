/* ============================================================
   The pixel style, as a pixel artist would draw it
   (docs/art-jobs.md, Job 0; the house style, AJ1).

   The scene model (scene.tsx) says what is where: a sky, a light,
   layers of land by depth, the card's subject. This draws it the way
   pixel art is drawn rather than snapping vectors to a grid:
   - every colour comes from the setting's own ramps (sky, land, light,
     and the rim a lit edge catches), and light moves along a ramp,
     never off it;
   - gradients are ramp steps with a 4 × 4 ordered dither between them;
   - the near land catches a rim of light along its top edge;
   - the life in the air is sprites, hand-drawn a few pixels at a time,
     with frames for whoever animates them (the world, later).

   The result is an indexed image (png.ts encodes it): small, crisp
   at any whole-number scale, and the same for the same seed.
   ============================================================ */

import { mix } from './biomes';
import type { BiomeId } from './biomes';
import type { IndexedImage } from './png';
import { int, range, rngFor } from './rng';

/* ---------------- each setting's look ---------------- */

export interface PixelRamp {
  /** The sky, from the top down to the horizon. */
  sky: readonly string[];
  /** The land, far to near. The nearest is the darkest. */
  land: readonly string[];
  /** The setting's light, faint to core. */
  light: readonly string[];
  /** What a lit edge catches. */
  rim: string;
}

export type SpriteKind = 'mote' | 'dust' | 'firefly' | 'flame' | 'drip' | 'snow' | 'sand' | 'rat';

export interface PixelLook {
  ramp: PixelRamp;
  /** What lives in the air, how many on a card back, and its colour. */
  air: { kind: SpriteKind; count: number; color: string };
  /** The sun or moon, where the setting has one. */
  disc?: string;
}

/**
 * The ramps, from docs/art-jobs.md: measured from each setting's
 * reference, then moved off any card family's colour that is not the
 * setting's own light (AJ4).
 */
export const LOOKS: Record<BiomeId, PixelLook> = {
  dungeon: {
    ramp: {
      sky: ['#0D0907', '#1C1411', '#241D25'],
      land: ['#6E5848', '#4A3B36', '#352215', '#1C1411'],
      light: ['#553620', '#804C25', '#B97337', '#E8A452', '#F6D58A'],
      rim: '#804C25',
    },
    air: { kind: 'dust', count: 22, color: '#B97337' },
  },
  tower: {
    ramp: {
      sky: ['#131620', '#1E1D2C', '#262638', '#3A394E'],
      land: ['#6D759C', '#55608A', '#3A394E', '#1E1D2C'],
      light: ['#3A394E', '#8A5E1E', '#E3A445', '#F2CB8A'],
      rim: '#9AA6C8',
    },
    air: { kind: 'mote', count: 16, color: '#F2CB8A' },
    disc: '#C9D6EA',
  },
  'deep-forest': {
    ramp: {
      sky: ['#04050C', '#070B14', '#0B121D', '#0E1C28', '#152A36'],
      land: ['#30606A', '#23404B', '#152A36', '#070B14'],
      light: ['#152A36', '#23404B', '#43917B', '#7FC0AC'],
      rim: '#43917B',
    },
    air: { kind: 'firefly', count: 26, color: '#F2CB8A' },
  },
  desert: {
    ramp: {
      sky: ['#F47F64', '#FD9557', '#FAA170', '#F9B67F', '#FDCA72', '#FACB8A'],
      land: ['#D98A55', '#B9733A', '#8E5530', '#4A2A18'],
      light: ['#FACB8A', '#FDCA72', '#FEFEDD'],
      rim: '#F8AF54',
    },
    air: { kind: 'sand', count: 26, color: '#FDCA72' },
    disc: '#FEFEDD',
  },
  undercity: {
    ramp: {
      sky: ['#030203', '#0B0310', '#100B23', '#191936'],
      land: ['#2E3B44', '#1E2A33', '#191936', '#0B0310'],
      light: ['#100B23', '#235347', '#43917B', '#7FC0AC', '#C8F0E2'],
      rim: '#43917B',
    },
    air: { kind: 'drip', count: 12, color: '#C8F0E2' },
  },
  'frozen-pass': {
    ramp: {
      sky: ['#2C5077', '#588FBC', '#84BDD8', '#A8E1F7', '#C8EAF6'],
      land: ['#E3F6FB', '#84BDD8', '#1E3A57', '#0B1520'],
      light: ['#A8E1F7', '#C8EAF6', '#E3F6FB', '#FCFEFE'],
      rim: '#FCFEFE',
    },
    air: { kind: 'snow', count: 44, color: '#FCFEFE' },
    disc: '#FCFEFE',
  },
};

/* ---------------- the sprites ----------------
   Rows of characters, one per pixel. `.` is empty and `a` is the air's
   own colour; any other letter is a colour of the sprite's own. `fps`
   0 is a still. Small on purpose: a firefly is one pixel and its halo. */

export interface SpriteDef {
  frames: readonly (readonly string[])[];
  colors: Readonly<Record<string, string>>;
  fps: number;
}

export const SPRITES: Readonly<Record<SpriteKind, SpriteDef>> = {
  mote: { frames: [['a']], colors: {}, fps: 0 },
  dust: { frames: [['a']], colors: {}, fps: 0 },
  snow: { frames: [['a']], colors: {}, fps: 0 },
  sand: { frames: [['aa']], colors: {}, fps: 0 },
  drip: { frames: [['b', 'a']], colors: { b: '#43917B' }, fps: 0 },
  firefly: {
    frames: [['.b.', 'bab', '.b.'], ['...', '.a.', '...'], ['...', '...', '...']],
    colors: { b: '#836D3A' },
    fps: 3,
  },
  flame: {
    frames: [['.c.', '.a.', '.b.'], ['c..', '.a.', '.b.'], ['..c', '.a.', '.b.']],
    colors: { b: '#E3A445', c: '#FFF1C4' },
    fps: 8,
  },
  rat: {
    frames: [['....aa.', 'aaaaaae', '..a.a..'], ['....aa.', 'aaaaaae', '...a.a.']],
    colors: { a: '#241D25', e: '#B97337' },
    fps: 4,
  },
};

/* ---------------- the grid ---------------- */

/** A 4 × 4 ordered dither: the threshold a step must clear at each pixel. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** A colour `t` (0..1) of the way along a ramp, dithered between steps. */
function step(ramp: readonly string[], t: number, b: number): string {
  const pos = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.floor(pos);
  return pos - i > b ? ramp[Math.min(i + 1, ramp.length - 1)]! : ramp[i]!;
}

type Shape =
  | { kind: 'poly'; pts: [number, number][] }
  | { kind: 'circle'; cx: number; cy: number; r: number };

/** Inside a shape: a circle, or a polygon by the even-odd rule. */
export function contains(s: Shape, x: number, y: number): boolean {
  if (s.kind === 'circle') return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
  let inside = false;
  const p = s.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!; const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** What the rasteriser reads from a scene (scene.tsx builds them). */
export interface PixelScene {
  W: number;
  H: number;
  light: { x: number; y: number; r: number };
  disc?: { cx: number; cy: number; r: number };
  layers: readonly {
    h: (u: number) => number;
    from: 'bottom' | 'top';
    depth: number;
    shapes?: readonly Shape[];
  }[];
  sprites: readonly { shapes: readonly Shape[]; color: string; opacity?: number; glow?: string }[];
}

export interface RasterOptions {
  /** Scene units per pixel. */
  px: number;
  seed: string;
  /** One depth alone (sky, far, near), for a back that tilts. Unset is the whole picture. */
  part?: 'sky' | 'far' | 'near';
  /** Sink every colour towards the ink, 0..0.8. */
  fade?: number;
  ink: string;
  /** The light's ramp: the setting's own for a back; the card's for a scene. */
  light?: readonly string[];
  /** Seconds, for sprite frames. */
  t?: number;
}

/** The scene as a pixel picture. */
export function rasterize(sc: PixelScene, look: PixelLook, o: RasterOptions): IndexedImage {
  const cols = Math.max(1, Math.ceil(sc.W / o.px));
  const rows = Math.max(1, Math.ceil(sc.H / o.px));
  const n = cols * rows;
  const { sky, land, rim } = look.ramp;
  const light = o.light && o.light.length ? o.light : look.ramp.light;
  const part = o.part;
  const color: string[] = new Array(n);
  const layerAt = new Int16Array(n).fill(-1);
  const front = new Uint8Array(n); // a subject or a sprite covers this pixel
  const glows = sc.sprites.map((sp) => (sp.glow ? boxOf(sp.shapes) : null));
  // A light in the picture comes from something: the sun or the moon,
  // where the setting has one, and the light's own place where it does not.
  const lamp = sc.disc ? { x: sc.disc.cx, y: sc.disc.cy, r: sc.light.r * 0.8 } : sc.light;

  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const p = cy * cols + cx;
      const x = (cx + 0.5) * o.px; const y = (cy + 0.5) * o.px;
      const u = x / sc.W; const v = y / sc.H;
      const b = BAYER[(cy & 3) * 4 + (cx & 3)]!;

      // The sky, stepping down its ramp to the horizon.
      let c = step(sky, v / 0.8, b);
      // The light: rings of its own ramp, dithered at each edge.
      const d = Math.hypot(x - lamp.x, y - lamp.y) / lamp.r;
      const fall = Math.max(0, 1 - d);
      const q = fall * fall * light.length * 1.5 + (b - 0.5) * 0.9;
      const li = Math.floor(q);
      if (li >= 1) c = light[Math.min(li - 1, light.length - 1)]!;
      if (sc.disc && Math.hypot(x - sc.disc.cx, y - sc.disc.cy) <= sc.disc.r + (b - 0.5) * o.px) {
        c = look.disc ?? light[light.length - 1]!;
      }

      if (part !== 'sky') {
        sc.layers.forEach((l, i) => {
          let inside = l.from === 'bottom' ? v >= 1 - l.h(u) : v <= l.h(u);
          if (!inside && l.shapes) for (const s of l.shapes) if (contains(s, x, y)) { inside = true; break; }
          if (inside) layerAt[p] = i;
        });
        const L = layerAt[p]!;
        if (L >= 0) {
          const depth = sc.layers[L]!.depth;
          c = land[Math.min(land.length - 1, Math.floor(depth * (land.length - 1) + 1e-6))]!;
        }
        // The card's subject, in front of everything; a glow is a dithered halo.
        sc.sprites.forEach((sp, si) => {
          let hit = false;
          for (const s of sp.shapes) if (contains(s, x, y)) { hit = true; break; }
          if (hit) {
            if (sp.opacity === undefined || sp.opacity >= 1 || b < sp.opacity) { c = sp.color; front[p] = 1; }
          } else if (glows[si]) {
            const box = glows[si]!;
            const dd = Math.hypot(x - box.cx, y - box.cy) / (box.r * 1.4);
            if (dd < 1 && 1 - dd > b + 0.25) c = light[Math.min(1, light.length - 1)]!;
          }
        });
      }
      color[p] = c;
    }
  }

  // A lit edge: the near land catches the rim colour along its top.
  if (part !== 'sky') {
    for (let p = cols; p < n; p += 1) {
      const L = layerAt[p]!;
      if (L < 0 || front[p]) continue;
      const l = sc.layers[L]!;
      if (l.from !== 'bottom' || l.depth < 0.5) continue;
      if (layerAt[p - cols]! < L) color[p] = rim;
    }
  }

  // What lives in the air, stamped by seed, in front of the land.
  const air = look.air;
  const def = SPRITES[air.kind];
  const airOn = part === undefined || part === 'near';
  if (airOn) {
    const r = rngFor(o.seed, `air:${air.kind}`);
    const count = Math.round(air.count * Math.sqrt((cols * rows) / (96 * 134)));
    for (let i = 0; i < count; i += 1) {
      const sx = int(r, 0, cols - 1); const sy = int(r, 0, Math.floor(rows * 0.92));
      const phase = range(r, 0, 10);
      const frame = def.frames[def.fps ? Math.floor((o.t ?? 0) * def.fps + phase) % def.frames.length : 0]!;
      frame.forEach((line, fy) => {
        for (let fx = 0; fx < line.length; fx += 1) {
          const key = line[fx]!;
          if (key === '.') continue;
          const xx = sx + fx - (line.length >> 1); const yy = sy + fy - (frame.length >> 1);
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const p = yy * cols + xx;
          color[p] = key === 'a' && !def.colors.a ? air.color : def.colors[key] ?? air.color;
          front[p] = 1;
        }
      });
    }
  }

  // Indices, with the fade mixed into the palette rather than laid over it.
  const palette: string[] = [];
  const index = new Map<string, number>();
  const see = part === 'far' || part === 'near';
  if (see) palette.push('#000000');
  const idx = (c: string): number => {
    let i = index.get(c);
    if (i === undefined) {
      i = palette.length;
      palette.push(o.fade ? mix(c, o.ink, o.fade) : c);
      index.set(c, i);
    }
    return i;
  };
  const data = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    if (see) {
      const L = layerAt[p]!;
      const depth = L >= 0 ? sc.layers[L]!.depth : -1;
      const keep = part === 'far' ? L >= 0 && depth < 0.6 && !front[p] : (L >= 0 && depth >= 0.6) || front[p] === 1;
      if (!keep) continue; // index 0: see-through
    }
    data[p] = idx(color[p]!);
  }
  return see ? { w: cols, h: rows, data, palette, transparent: 0 } : { w: cols, h: rows, data, palette };
}

function boxOf(shapes: readonly Shape[]): { cx: number; cy: number; r: number } {
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  for (const s of shapes) {
    const pts = s.kind === 'circle' ? [[s.cx - s.r, s.cy - s.r], [s.cx + s.r, s.cy + s.r]] : s.pts;
    for (const [x, y] of pts) { x1 = Math.min(x1, x!); y1 = Math.min(y1, y!); x2 = Math.max(x2, x!); y2 = Math.max(y2, y!); }
  }
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r: Math.max(x2 - x1, y2 - y1) / 2 };
}

/** RGBA bytes, for a canvas or a WebGL texture. The see-through index is clear. */
export function toRgba(img: IndexedImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.w * img.h * 4);
  const pal = img.palette.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let p = 0; p < img.data.length; p += 1) {
    const i = img.data[p]!;
    if (i === img.transparent) continue;
    const c = pal[i]!;
    out[p * 4] = c[0]!; out[p * 4 + 1] = c[1]!; out[p * 4 + 2] = c[2]!; out[p * 4 + 3] = 255;
  }
  return out;
}
