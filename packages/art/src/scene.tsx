/* ============================================================
   SCENES

   What stands in the doorway. Every card in the deck is the same
   arch (packages/ui/src/ArchGlyph.tsx), so a card illustration
   here is a view THROUGH that arch into the setting: a sky lit by
   the category's own colour, a horizon built from what the biome
   is made of, and the card's subject in the foreground.

   The scene is a model, not a drawing — stacked height functions
   and a few shapes — and the style is a renderer over it. The
   pixel renderer samples the model on a grid; the others turn it
   into polygons. Same picture, four hands.
   ============================================================ */

import type { ReactNode } from 'react';
import type { CardCategory } from '@maze-deck/ui';
import { alpha, mix } from './biomes';
import type { BiomeVocab, CatKey, Palette, Terrain } from './biomes';
import { fbm1d, int, pick, range, rngFor } from './rng';
import type { Rng } from './rng';
import type { Style } from './style';

/**
 * `arch` is the doorway on the card face, on the glyph's grid. `wide`
 * is a landscape panel. `back` is the whole card back — the same
 * 63:88 field the maze tiles over, so a setting can wear its horizon
 * behind the seal instead of a fret. `vista` is a landscape of any
 * aspect (`aspect`), composed for the space it fills: the table's
 * picture of the scene the GM is reading out. It is cropped from the
 * top, never the bottom, so the subject's floor is always in it.
 */
export type Frame = 'arch' | 'wide' | 'back' | 'vista';

export interface SceneParams {
  category: CardCategory;
  frame: Frame;
  seed: string;
  style: Style;
  /** Pixel size in scene units, 1.5–4. */
  px: number;
  /** Terrain amplitude, 0.4–1.4. */
  relief: number;
  /** How much the far layers lighten, 0–1. */
  haze: number;
  /** Draw the arch band around the opening. */
  band: boolean;
  /** Draw the card's subject in front. Off for a card back, which must say nothing. */
  subject: boolean;
  /** Sink the whole picture towards the ink, 0–0.8. */
  fade: number;
  /** `vista` only: width over height, 1.2–12. */
  aspect?: number;
  /** One depth of the picture alone (see ScenePart). Unset draws it whole. */
  part?: ScenePart;
}

/**
 * One depth of a picture, for a card back drawn in layers that move
 * against each other as the card tilts (docs/overhaul.md, phase 6).
 * `sky` is opaque: the sky, its light and its disc. `far` and `near`
 * are the terrain either side of depth 0.6 on a transparent ground,
 * with the fade mixed into their colours rather than laid over them,
 * so it does not fill the gaps between them. The three stacked are the
 * whole picture. Only the `flat` style draws parts; the others draw the
 * whole picture whatever `part` says.
 */
export type ScenePart = 'sky' | 'far' | 'near';

export const SCENE_PARTS: readonly ScenePart[] = ['sky', 'far', 'near'];

export const DEFAULT_SCENE: Omit<SceneParams, 'seed' | 'style'> = {
  category: 'clear-path', frame: 'arch', px: 2, relief: 1, haze: 0.6, band: true, subject: true, fade: 0,
};

export const SCENE_CATEGORIES: readonly CardCategory[] = [
  'clear-path', 'obstacle', 'wanderer', 'item', 'monster', 'dead-end', 'trap',
];

export const CAT_KEY: Record<CardCategory, CatKey> = {
  'clear-path': 'path', 'dead-end': 'dead', obstacle: 'obst', trap: 'trap',
  monster: 'mons', wanderer: 'wand', item: 'item',
};

/* The arch, from ArchGlyph: a 120×140 grid. */
const BAND = 'M16,132 L16,70 A44,44 0 0 1 104,70 L104,132 L92,132 L92,70 A32,32 0 0 0 28,70 L28,132 Z';
const OPENING = 'M28,132 L28,70 A32,32 0 0 1 92,70 L92,132 Z';
const ARCH_X = 28, ARCH_Y = 38, ARCH_W = 64, ARCH_H = 94;

/* ---------- the model ------------------------------------------- */

type Shape =
  | { kind: 'poly'; pts: [number, number][] }
  | { kind: 'circle'; cx: number; cy: number; r: number };

interface Layer {
  /** Height as a fraction of H, from the named edge, over u = x / W. */
  h: (u: number) => number;
  from: 'bottom' | 'top';
  color: string;
  /** 0 far, 1 near. Sets the hatch density. */
  depth: number;
  /**
   * Things standing on the height line that a height line cannot say:
   * anything with an overhang, like a canopy above a trunk. Same
   * colour as the layer, drawn with it.
   */
  shapes?: Shape[];
}

const rectShape = (x1: number, y1: number, x2: number, y2: number): Shape =>
  ({ kind: 'poly', pts: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] });

/* ---------- trees ------------------------------------------------
   A conifer is a trunk and three tiers, each a triangle wider than
   the one above and overlapping it. A broadleaf is a trunk with a
   cluster of rounds. Width and height are the tree's box; the
   trunk stands on `y0`.                                            */

function conifer(out: Shape[], cx: number, y0: number, w: number, h: number): void {
  out.push(rectShape(cx - 0.045 * w, y0 - 0.34 * h, cx + 0.045 * w, y0));
  const tiers: [number, number, number][] = [[0.5, 0.2, 0.62], [0.38, 0.44, 0.83], [0.26, 0.66, 1]];
  for (const [hw, b, t] of tiers) {
    out.push({ kind: 'poly', pts: [[cx - hw * w, y0 - b * h], [cx + hw * w, y0 - b * h], [cx, y0 - t * h]] });
  }
}

function broadleaf(out: Shape[], cx: number, y0: number, w: number, h: number): void {
  out.push(rectShape(cx - 0.05 * w, y0 - 0.58 * h, cx + 0.05 * w, y0));
  out.push({ kind: 'circle', cx, cy: y0 - 0.68 * h, r: 0.42 * w });
  out.push({ kind: 'circle', cx: cx - 0.26 * w, cy: y0 - 0.56 * h, r: 0.27 * w });
  out.push({ kind: 'circle', cx: cx + 0.27 * w, cy: y0 - 0.6 * h, r: 0.29 * w });
  out.push({ kind: 'circle', cx: cx + 0.04 * w, cy: y0 - 0.86 * h, r: 0.24 * w });
}

interface Sprite {
  shapes: Shape[];
  color: string;
  opacity?: number;
  /** A radial glow behind it, in this colour. */
  glow?: string;
}

interface Scene {
  W: number;
  H: number;
  skyTop: string;
  skyBottom: string;
  light: { x: number; y: number; r: number; color: string; glow: string };
  disc?: { cx: number; cy: number; r: number; color: string };
  layers: Layer[];
  sprites: Sprite[];
  floor: number;
}

const frac = (t: number) => t - Math.floor(t);

function terrain(kind: Terrain, r: Rng, k: number, W: number, H: number, colors: [string, string, string], dark: string, water: string): Layer[] {
  // A landscape repeats its features across its width, so a wider vista
  // gets more of them — by the square root of the extra width, not in
  // proportion: a 6:1 forest drawn at the `wide` frame's density grew
  // ~150 trees and ~600 shapes, which cost a slow phone most of a second
  // on every reveal (docs/overhaul.md, world/2). Fewer, larger features
  // read better across a whole screen anyway. The `wide` frame (240 x
  // 140) is the unit, and comes out exactly as before.
  const wide = W / H > 1;
  const stretch = wide ? 2.2 * Math.sqrt(Math.max(1, (W / H) / (240 / 140))) : 1;
  const [far, mid, near] = colors;

  switch (kind) {
    case 'trees': {
      // Standing trees, not a sawtooth: each layer is a low bank of
      // undergrowth with trunks and canopies drawn on it, so the gaps
      // between trees show the layer behind, and the trees overhang.
      const mk = (base: number, ht: number, count: number, depth: number, color: string, wide: number): Layer => {
        const n = Math.max(2, Math.round(count * stretch));
        const slot = W / n;
        const y0 = H * (1 - base);
        const shapes: Shape[] = [];
        for (let i = 0; i < n; i++) {
          const cx = (i + 0.5) * slot + range(r, -0.3, 0.3) * slot;
          const h = H * ht * k * range(r, 0.62, 1);
          const w = slot * wide * range(r, 0.8, 1.2);
          if (r() < 0.72) conifer(shapes, cx, y0, w, h);
          else broadleaf(shapes, cx, y0, w * 0.9, h * 0.85);
        }
        const bump = fbm1d(r, 2, 2, 0.5);
        const off = range(r, 0, 20);
        return { from: 'bottom', color, depth, shapes, h: (u) => base + 0.035 * bump(u * 5 * stretch + off) };
      };
      return [mk(0.46, 0.55, 9, 0, far, 1.15), mk(0.28, 0.6, 6, 0.5, mid, 1.2), mk(0.1, 0.66, 4, 1, near, 1.3)];
    }
    case 'dunes': {
      const mk = (base: number, amp: number, f: number, depth: number, color: string): Layer => {
        const p1 = r() * 6.28, p2 = r() * 6.28;
        return {
          from: 'bottom', color, depth,
          h: (u) => {
            const s = 0.5 + 0.5 * Math.sin(u * f * stretch * 6.283 + p1) + 0.18 * Math.sin(u * f * stretch * 14.5 + p2);
            return base + amp * k * s;
          },
        };
      };
      return [mk(0.42, 0.22, 0.9, 0, far), mk(0.26, 0.2, 1.3, 0.5, mid), mk(0.1, 0.14, 1.9, 1, near)];
    }
    case 'peaks': {
      const mk = (base: number, amp: number, scale: number, depth: number, color: string): Layer => {
        const n = fbm1d(r, 3, 2.1, 0.5);
        const off = range(r, 0, 40);
        return {
          from: 'bottom', color, depth,
          h: (u) => {
            const v = n(u * scale * stretch + off);
            const ridge = Math.pow(1 - Math.abs(2 * v - 1), 1.5);
            return base + amp * k * ridge;
          },
        };
      };
      return [mk(0.44, 0.46, 2.4, 0, far), mk(0.26, 0.38, 3.2, 0.5, mid), mk(0.1, 0.22, 4.5, 1, near)];
    }
    case 'pillars': {
      const mk = (base: number, tall: number, n: number, w: number, depth: number, color: string): Layer => {
        const ph = r();
        const cnt = Math.round(n * stretch);
        return {
          from: 'bottom', color, depth,
          h: (u) => (frac(u * cnt + ph) < w ? base + tall * k : base),
        };
      };
      return [
        mk(0.48, 0.55, 3, 0.16, 0, far),
        mk(0.3, 0.75, 2, 0.18, 0.5, mid),
        { from: 'bottom', color: near, depth: 1, h: (u) => (u < 0.08 || u > 0.92 ? 1 : 0.12) },
        { from: 'top', color: dark, depth: 1, h: () => 0.07 },
      ];
    }
    case 'stairs': {
      const mk = (base: number, rise: number, steps: number, depth: number, color: string, dir: number): Layer => ({
        from: 'bottom', color, depth,
        h: (u) => {
          const uu = dir > 0 ? u : 1 - u;
          return base + rise * k * (Math.floor(uu * steps * stretch) / (steps * stretch));
        },
      });
      const d1 = pick(r, [1, -1]);
      return [
        mk(0.46, 0.44, 7, 0, far, d1),
        mk(0.28, 0.42, 9, 0.5, mid, -d1),
        mk(0.1, 0.24, 5, 1, near, d1),
        { from: 'top', color: dark, depth: 1, h: (u) => 0.2 - 0.15 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))) },
      ];
    }
    case 'vaults': {
      const rubble = fbm1d(r, 2, 2, 0.5);
      const off = range(r, 0, 30);
      const ph = r();
      const arches = (n: number, base: number, dip: number, color: string, depth: number): Layer => ({
        from: 'top', color, depth,
        h: (u) => {
          const f = frac(u * n * stretch + ph);
          return base - dip * k * Math.sqrt(Math.max(0, 1 - Math.pow(2 * f - 1, 2)));
        },
      });
      return [
        arches(1, 0.6, 0.46, far, 0),
        arches(2, 0.42, 0.32, mid, 0.5),
        { from: 'bottom', color: near, depth: 0.7, h: (u) => 0.05 + 0.12 * k * rubble(u * 6 * stretch + off) },
        { from: 'bottom', color: water, depth: 0.9, h: () => 0.09 },
      ];
    }
  }
}

function focal(category: CardCategory, W: number, H: number, floor: number, pal: Palette, r: Rng): Sprite[] {
  const c = pal.cat[CAT_KEY[category]];
  const s = Math.min(W, H) / 64;
  const cx = W / 2;
  const fy = floor;
  const rect = (x1: number, y1: number, x2: number, y2: number): Shape => ({ kind: 'poly', pts: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] });
  const tri = (x: number, base: number, w: number, h: number): Shape => ({ kind: 'poly', pts: [[x - w / 2, base], [x + w / 2, base], [x, base - h]] });

  switch (category) {
    case 'clear-path': {
      const w = 8 * s, top = fy - 18 * s;
      const pts: [number, number][] = [[cx - w, fy], [cx - w, top]];
      for (let i = 1; i < 12; i++) {
        const a = Math.PI - (Math.PI * i) / 12;
        pts.push([cx + w * Math.cos(a), top - w * Math.sin(a)]);
      }
      pts.push([cx + w, top], [cx + w, fy]);
      return [
        { shapes: [{ kind: 'poly', pts: [[cx - 3 * s, fy], [cx + 3 * s, fy], [cx + 18 * s, H], [cx - 18 * s, H]] }], color: c[500], opacity: 0.55 },
        { shapes: [{ kind: 'poly', pts }], color: c[300], glow: c[500] },
      ];
    }
    case 'obstacle': {
      const a = range(r, -0.2, 0.2);
      const beam = (cy: number, len: number, th: number, ang: number): Shape => {
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const nx = -dy * th, ny = dx * th;
        return { kind: 'poly', pts: [
          [cx - dx * len + nx, cy - dy * len + ny], [cx + dx * len + nx, cy + dy * len + ny],
          [cx + dx * len - nx, cy + dy * len - ny], [cx - dx * len - nx, cy - dy * len - ny],
        ] };
      };
      return [
        { shapes: [beam(fy - 14 * s, 20 * s, 1.6 * s, -a * 0.6)], color: c[700] },
        { shapes: [beam(fy - 8 * s, 23 * s, 2 * s, a), rect(cx - 12 * s, fy - 8 * s, cx - 10 * s, fy), rect(cx + 9 * s, fy - 8 * s, cx + 11 * s, fy)], color: c[500] },
      ];
    }
    case 'dead-end': {
      const mortar: Shape[] = [];
      const rows = 6, bh = (26 * s) / rows;
      for (let i = 1; i < rows; i++) mortar.push(rect(cx - 22 * s, fy - i * bh - 0.4 * s, cx + 22 * s, fy - i * bh + 0.4 * s));
      for (let i = 0; i < rows; i++) {
        const y1 = fy - (i + 1) * bh, y2 = fy - i * bh;
        for (let j = 0; j < 5; j++) {
          const x = cx - 22 * s + (j + (i % 2 ? 0.5 : 0)) * 9 * s;
          if (x > cx - 22 * s && x < cx + 22 * s) mortar.push(rect(x - 0.4 * s, y1, x + 0.4 * s, y2));
        }
      }
      return [
        { shapes: [rect(cx - 22 * s, fy - 26 * s, cx + 22 * s, fy)], color: c[500] },
        { shapes: mortar, color: pal.ink[900] },
      ];
    }
    case 'trap': {
      const n = int(r, 4, 6);
      const spikes: Shape[] = [];
      for (let i = 0; i < n; i++) spikes.push(tri(cx + (i - (n - 1) / 2) * 7 * s, fy, 4.5 * s, range(r, 9, 13) * s));
      return [
        { shapes: [rect(cx - (n / 2) * 7 * s - 2 * s, fy - 1.5 * s, cx + (n / 2) * 7 * s + 2 * s, fy)], color: c[700] },
        { shapes: spikes, color: c[300] },
      ];
    }
    case 'monster': {
      const e = 2.2 * s;
      return [
        { shapes: [{ kind: 'poly', pts: [[cx - 17 * s, fy], [cx - 15 * s, fy - 20 * s], [cx - 7 * s, fy - 29 * s], [cx + 7 * s, fy - 29 * s], [cx + 16 * s, fy - 19 * s], [cx + 17 * s, fy]] }], color: pal.ink[900] },
        { shapes: [{ kind: 'circle', cx: cx - 5 * s, cy: fy - 19 * s, r: e }, { kind: 'circle', cx: cx + 5 * s, cy: fy - 19 * s, r: e }], color: c[300], glow: c[500] },
      ];
    }
    case 'wanderer': {
      return [
        { shapes: [rect(cx + 8.5 * s, fy - 33 * s, cx + 9.5 * s, fy)], color: c[700] },
        { shapes: [{ kind: 'poly', pts: [[cx - 4 * s, fy - 20 * s], [cx + 4 * s, fy - 20 * s], [cx + 7 * s, fy], [cx - 7 * s, fy]] }], color: c[500] },
        { shapes: [{ kind: 'circle', cx, cy: fy - 25 * s, r: 3.2 * s }], color: c[300] },
      ];
    }
    case 'item': {
      const gy = fy - 13 * s, g = 5 * s;
      const ray = (ang: number): Shape => {
        const dx = Math.cos(ang), dy = Math.sin(ang);
        return { kind: 'poly', pts: [[cx + dx * (g + 1.5 * s) - dy * 0.5 * s, gy + dy * (g + 1.5 * s) + dx * 0.5 * s], [cx + dx * (g + 6 * s), gy + dy * (g + 6 * s)], [cx + dx * (g + 1.5 * s) + dy * 0.5 * s, gy + dy * (g + 1.5 * s) - dx * 0.5 * s]] };
      };
      return [
        { shapes: [rect(cx - 4 * s, fy - 4 * s, cx + 4 * s, fy)], color: c[700] },
        { shapes: [ray(-Math.PI / 2), ray(Math.PI), ray(0), ray(Math.PI / 2)], color: c[500], opacity: 0.7 },
        { shapes: [{ kind: 'poly', pts: [[cx, gy - g], [cx + g, gy], [cx, gy + g], [cx - g, gy]] }], color: c[300], glow: c[500] },
      ];
    }
  }
}

export function buildScene(p: SceneParams, pal: Palette, vocab: BiomeVocab): Scene {
  const W = p.frame === 'arch' ? ARCH_W
    : p.frame === 'vista' ? Math.round(140 * Math.max(1.2, Math.min(12, p.aspect ?? 4)))
    : 240;
  const H = p.frame === 'arch' ? ARCH_H : p.frame === 'back' ? 335 : 140;
  const r = rngFor(p.seed, `scene:${vocab.id}:${p.frame}`);
  const c = pal.cat[CAT_KEY[p.category]];
  const far = mix(pal.ink[700], pal.ink[500], p.haze * 0.6);
  const mid = mix(pal.ink[800], pal.ink[700], p.haze * 0.6);
  const near = pal.ink[900];
  const water = mix(pal.ink[700], pal.cat.wand[500], 0.18);
  const layers = terrain(vocab.terrain, r, p.relief, W, H, [far, mid, near], pal.ink[900], water);
  const floor = H * 0.88;
  const disc =
    vocab.disc === 'sun' ? { cx: W * range(r, 0.6, 0.8), cy: H * range(r, 0.2, 0.3), r: Math.min(W, H) * 0.09, color: mix(pal.cat.path[300], pal.parchment[100], 0.3) }
    : vocab.disc === 'moon' ? { cx: W * range(r, 0.2, 0.4), cy: H * range(r, 0.16, 0.26), r: Math.min(W, H) * 0.07, color: pal.parchment[200] }
    : undefined;
  return {
    W, H,
    skyTop: pal.ink[500],
    skyBottom: pal.ink[700],
    light: { x: W / 2, y: H * 0.12, r: Math.max(W, H) * 0.55, color: c[500], glow: c.glow },
    disc,
    layers,
    sprites: p.subject ? focal(p.category, W, H, floor, pal, rngFor(p.seed, `focal:${p.category}`)) : [],
    floor,
  };
}

/* ---------- geometry ------------------------------------------- */

const f2 = (n: number) => String(Math.round(n * 100) / 100);

function layerPath(l: Layer, W: number, H: number): string {
  const N = Math.max(48, Math.round(W * 2));
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = u * W;
    const y = l.from === 'bottom' ? H * (1 - l.h(u)) : H * l.h(u);
    pts.push(`${f2(x)},${f2(y)}`);
  }
  const edge = l.from === 'bottom' ? H : 0;
  return `M0,${edge} L${pts.join(' L')} L${W},${edge} Z`;
}

function shapePath(s: Shape): string {
  if (s.kind === 'circle') {
    return `M${f2(s.cx - s.r)},${f2(s.cy)} a${f2(s.r)},${f2(s.r)} 0 1 0 ${f2(2 * s.r)},0 a${f2(s.r)},${f2(s.r)} 0 1 0 ${f2(-2 * s.r)},0`;
  }
  return `M${s.pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' L')} Z`;
}

function contains(s: Shape, x: number, y: number): boolean {
  if (s.kind === 'circle') return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
  let inside = false;
  const p = s.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function spriteBox(sp: Sprite): { cx: number; cy: number; r: number } {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const s of sp.shapes) {
    const pts = s.kind === 'circle' ? [[s.cx - s.r, s.cy - s.r], [s.cx + s.r, s.cy + s.r]] : s.pts;
    for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  }
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r: Math.max(x2 - x1, y2 - y1) };
}

/* ---------- renderers ------------------------------------------ */

function renderFlat(sc: Scene, id: string, ground = true): ReactNode {
  return (
    <>
      <defs>
        {ground ? (
          <>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sc.skyTop} />
              <stop offset="1" stopColor={sc.skyBottom} />
            </linearGradient>
            <radialGradient id={`${id}-light`} cx={sc.light.x} cy={sc.light.y} r={sc.light.r} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={sc.light.color} stopOpacity="0.55" />
              <stop offset="0.5" stopColor={sc.light.color} stopOpacity="0.14" />
              <stop offset="1" stopColor={sc.light.color} stopOpacity="0" />
            </radialGradient>
          </>
        ) : null}
        {sc.sprites.map((sp, i) => sp.glow ? (
          <radialGradient key={i} id={`${id}-glow${i}`}>
            <stop offset="0" stopColor={sp.glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={sp.glow} stopOpacity="0" />
          </radialGradient>
        ) : null)}
      </defs>
      {ground ? <rect width={sc.W} height={sc.H} fill={`url(#${id}-sky)`} /> : null}
      {ground ? <rect width={sc.W} height={sc.H} fill={`url(#${id}-light)`} /> : null}
      {ground && sc.disc ? <circle cx={sc.disc.cx} cy={sc.disc.cy} r={sc.disc.r} fill={sc.disc.color} opacity="0.5" /> : null}
      {sc.layers.map((l, i) => (
        <g key={i} fill={l.color}>
          <path d={layerPath(l, sc.W, sc.H)} />
          {l.shapes?.map((s, j) => <path key={j} d={shapePath(s)} />)}
        </g>
      ))}
      {sc.sprites.map((sp, i) => {
        const b = spriteBox(sp);
        return (
          <g key={i} opacity={sp.opacity ?? 1}>
            {sp.glow ? <circle cx={b.cx} cy={b.cy} r={b.r * 1.3} fill={`url(#${id}-glow${i})`} /> : null}
            {sp.shapes.map((s, j) => <path key={j} d={shapePath(s)} fill={sp.color} />)}
          </g>
        );
      })}
    </>
  );
}

function renderLine(sc: Scene, pal: Palette): ReactNode {
  const lw = Math.min(sc.W, sc.H) / 64;
  const ink = pal.parchment[300];
  return (
    <>
      <rect width={sc.W} height={sc.H} fill={pal.ink[900]} />
      <g fill="none" stroke={sc.light.color} strokeWidth={lw * 0.7}>
        {[0.28, 0.5, 0.72].map((k, i) => (
          <ellipse key={i} cx={sc.light.x} cy={sc.light.y} rx={sc.light.r * k} ry={sc.light.r * k * 0.7} opacity={0.3 - i * 0.08} />
        ))}
      </g>
      {sc.disc ? <circle cx={sc.disc.cx} cy={sc.disc.cy} r={sc.disc.r} fill="none" stroke={ink} strokeWidth={lw * 0.8} /> : null}
      {sc.layers.map((l, i) => (
        <g key={i} fill={pal.ink[900]} stroke={ink} strokeWidth={lw * (0.7 + l.depth * 0.5)} strokeLinejoin="round">
          <path d={layerPath(l, sc.W, sc.H)} />
          {l.shapes?.map((s, j) => <path key={j} d={shapePath(s)} />)}
        </g>
      ))}
      {sc.sprites.map((sp, i) => (
        <g key={i} opacity={sp.opacity ?? 1}>
          {sp.shapes.map((s, j) => (
            <path key={j} d={shapePath(s)} fill={pal.ink[900]} stroke={sp.color === pal.ink[900] ? ink : sp.color} strokeWidth={lw * 1.1} strokeLinejoin="round" />
          ))}
        </g>
      ))}
    </>
  );
}

function renderEngraving(sc: Scene, pal: Palette, id: string): ReactNode {
  const u = Math.min(sc.W, sc.H) / 64;
  const hatch = (key: string, spacing: number, angle: number, color: string, op: number) => (
    <pattern key={key} id={`${id}-${key}`} width={spacing} height={spacing} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <line x1="0" y1="0" x2="0" y2={spacing} stroke={color} strokeWidth={0.45 * u} opacity={op} />
    </pattern>
  );
  return (
    <>
      <defs>
        {hatch('sky', 2.6 * u, 0, pal.parchment[400], 0.7)}
        {sc.layers.map((l, i) => hatch(`l${i}`, (1.5 + l.depth * 3.2) * u, i % 2 ? -42 : 42, pal.parchment[400], 0.75 - l.depth * 0.35))}
        <radialGradient id={`${id}-lm`} cx={sc.light.x} cy={sc.light.y} r={sc.light.r * 1.1} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={`${id}-lmask`}><rect width={sc.W} height={sc.H} fill={`url(#${id}-lm)`} /></mask>
      </defs>
      <rect width={sc.W} height={sc.H} fill={pal.ink[900]} />
      <rect width={sc.W} height={sc.H} fill={`url(#${id}-sky)`} mask={`url(#${id}-lmask)`} />
      <rect width={sc.W} height={sc.H} fill={sc.light.color} opacity="0.12" mask={`url(#${id}-lmask)`} />
      {sc.disc ? <circle cx={sc.disc.cx} cy={sc.disc.cy} r={sc.disc.r} fill={pal.ink[900]} stroke={pal.parchment[300]} strokeWidth={0.5 * u} /> : null}
      {sc.layers.map((l, i) => {
        const ds = [layerPath(l, sc.W, sc.H), ...(l.shapes ?? []).map(shapePath)];
        return (
          <g key={i}>
            {ds.map((d, j) => (
              <g key={j}>
                <path d={d} fill={pal.ink[900]} />
                <path d={d} fill={`url(#${id}-l${i})`} />
                <path d={d} fill="none" stroke={pal.parchment[400]} strokeWidth={0.4 * u} opacity="0.6" />
              </g>
            ))}
          </g>
        );
      })}
      {sc.sprites.map((sp, i) => (
        <g key={i} opacity={sp.opacity ?? 1}>
          {sp.shapes.map((s, j) => (
            <path key={j} d={shapePath(s)} fill={sp.color} stroke={sp.color === pal.ink[900] ? pal.parchment[400] : pal.parchment[200]} strokeWidth={0.4 * u} strokeOpacity="0.7" />
          ))}
        </g>
      ))}
    </>
  );
}

const BAYER = [[0, 0.5], [0.75, 0.25]];

function renderPixel(sc: Scene, px: number, pal: Palette): ReactNode {
  const cols = Math.ceil(sc.W / px);
  const rows = Math.ceil(sc.H / px);
  const bands = [0, 1 / 3, 2 / 3, 1].map((t) => mix(sc.skyTop, sc.skyBottom, t));
  const lightTint = [0, 0.14, 0.3, 0.5].map((t) => bands.map((b) => mix(b, sc.light.color, t)));
  const rects: ReactNode[] = [];

  const sample = (cx: number, cy: number, bayer: number): string => {
    const x = (cx + 0.5) * px, y = (cy + 0.5) * px;
    const u = x / sc.W, v = y / sc.H;
    // Sky: four bands, dithered at the seams.
    const band = Math.max(0, Math.min(3, Math.floor(v * 3 + (bayer - 0.5) * 0.8 + 0.5)));
    const d = Math.hypot(x - sc.light.x, y - sc.light.y) / sc.light.r + (bayer - 0.5) * 0.22;
    const lvl = d < 0.3 ? 3 : d < 0.55 ? 2 : d < 0.82 ? 1 : 0;
    let color = lightTint[lvl][band];
    if (sc.disc && (x - sc.disc.cx) ** 2 + (y - sc.disc.cy) ** 2 <= sc.disc.r ** 2) color = mix(color, sc.disc.color, 0.6);
    for (const l of sc.layers) {
      let inside = l.from === 'bottom' ? v >= 1 - l.h(u) : v <= l.h(u);
      if (!inside && l.shapes) {
        for (const s of l.shapes) if (contains(s, x, y)) { inside = true; break; }
      }
      if (inside) color = l.color;
    }
    for (const sp of sc.sprites) {
      for (const s of sp.shapes) {
        if (contains(s, x, y)) {
          color = sp.opacity !== undefined && sp.opacity < 1 ? mix(color, sp.color, sp.opacity) : sp.color;
          break;
        }
      }
    }
    return color;
  };

  for (let cy = 0; cy < rows; cy++) {
    let runStart = 0;
    let runColor = sample(0, cy, BAYER[cy % 2][0]);
    for (let cx = 1; cx <= cols; cx++) {
      const c = cx < cols ? sample(cx, cy, BAYER[cy % 2][cx % 2]) : '';
      if (c !== runColor) {
        rects.push(<rect key={`${cy}-${runStart}`} x={runStart * px} y={cy * px} width={(cx - runStart) * px} height={px} fill={runColor} />);
        runStart = cx;
        runColor = c;
      }
    }
  }
  return (
    <g shapeRendering="crispEdges">
      <rect width={sc.W} height={sc.H} fill={pal.ink[900]} />
      {rects}
    </g>
  );
}

/* ---------- the picture ---------------------------------------- */

/**
 * One depth of a flat picture (see ScenePart). The terrain carries the
 * fade in its own colours, since a rect laid over a transparent layer
 * would fill it.
 */
function renderFlatPart(sc: Scene, id: string, part: ScenePart, fade: number, ink: string): ReactNode {
  if (part === 'sky') return renderFlat({ ...sc, layers: [], sprites: [] }, id);
  const sink = (c: string) => (fade > 0 ? mix(c, ink, fade) : c);
  const layers = sc.layers
    .filter((l) => (part === 'far' ? l.depth < 0.6 : l.depth >= 0.6))
    .map((l) => ({ ...l, color: sink(l.color) }));
  const sprites = part === 'near' ? sc.sprites.map((sp) => ({ ...sp, color: sink(sp.color) })) : [];
  return renderFlat({ ...sc, layers, sprites }, id, false);
}

export function SceneArt({ p, pal, vocab, id }: { p: SceneParams; pal: Palette; vocab: BiomeVocab; id: string }) {
  const sc = buildScene(p, pal, vocab);
  const part = p.style === 'flat' ? p.part : undefined;
  const body =
    p.style === 'pixel' ? renderPixel(sc, p.px, pal)
    : p.style === 'line' ? renderLine(sc, pal)
    : p.style === 'engraving' ? renderEngraving(sc, pal, id)
    : part ? renderFlatPart(sc, id, part, p.fade, pal.ink[900])
    : renderFlat(sc, id);
  const bandColor = pal.cat[CAT_KEY[p.category]][300];
  // A part off the sky is see-through, and carries its fade in its colours.
  const fade = p.fade > 0 && (!part || part === 'sky')
    ? <rect width={sc.W} height={sc.H} fill={pal.ink[900]} opacity={p.fade} />
    : null;

  if (p.frame === 'back') {
    return (
      <svg viewBox={`0 0 ${sc.W} ${sc.H}`} preserveAspectRatio="xMidYMid slice">
        {body}
        {fade}
      </svg>
    );
  }
  if (p.frame === 'vista') {
    return (
      <svg viewBox={`0 0 ${sc.W} ${sc.H}`} preserveAspectRatio="xMidYMax slice">
        {body}
        {fade}
      </svg>
    );
  }
  if (p.frame === 'wide') {
    return (
      <svg viewBox={`0 0 ${sc.W} ${sc.H}`}>
        <defs><clipPath id={`${id}-clip`}><rect width={sc.W} height={sc.H} rx="6" /></clipPath></defs>
        <g clipPath={`url(#${id}-clip)`}>{body}{fade}</g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 140">
      <defs><clipPath id={`${id}-clip`}><path d={OPENING} /></clipPath></defs>
      {p.band ? (
        p.style === 'line'
          ? <path d={BAND} fill="none" stroke={bandColor} strokeWidth="1.2" />
          : <path d={BAND} fill={bandColor} opacity={p.style === 'engraving' ? 0.8 : 1} />
      ) : null}
      <g clipPath={`url(#${id}-clip)`}>
        <g transform={`translate(${ARCH_X},${ARCH_Y})`}>{body}{fade}</g>
      </g>
    </svg>
  );
}

/** Light colour with the category's own alpha, for hosts that want the glow. */
export function sceneGlow(p: SceneParams, pal: Palette): string {
  return alpha(pal.cat[CAT_KEY[p.category]][500], 0.4);
}
