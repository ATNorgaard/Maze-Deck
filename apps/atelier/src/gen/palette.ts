/* ============================================================
   BIOME PALETTES

   A palette in biomes.css is not seven free colours. It is a
   cast — the setting's light — applied to a fixed structure: an
   ink ramp, a parchment ramp, and seven category hues that may be
   TUNED within their family but never swapped (see the note at
   the top of apps/table/src/biomes.css). This generator takes the
   cast and does the arithmetic, then writes the CSS block in the
   exact shape the app expects.
   ============================================================ */

import { alpha, hslToHex, CAT_KEYS } from '../core/biomes';
import type { CatKey, LightKey, Palette, Ramp } from '../core/biomes';

export interface PaletteParams {
  /** The identifier the CSS is keyed by, e.g. `salt-marsh`. */
  id: string;
  name: string;
  blurb: string;
  /** Hue of the ink cast, 0–360. */
  hue: number;
  /** Saturation of the ink cast, 0–0.5. */
  sat: number;
  /** Hue and saturation of the parchment. */
  parchHue: number;
  parchSat: number;
  /** How far the category hues lean towards the cast, 0–1. */
  lean: number;
  /** Category saturation multiplier, 0.6–1.3. */
  chroma: number;
  /** Which category lights the room, and from where. */
  light: LightKey;
  lightFrom: 'above' | 'below' | 'horizon';
}

/* The canon in HSL, read off tokens.css. h, s, l of the 500 step. */
const CANON: Record<CatKey, [number, number, number]> = {
  path: [36, 0.73, 0.58],
  dead: [45, 0.02, 0.48],
  obst: [163, 0.37, 0.42],
  trap: [68, 0.48, 0.44],
  mons: [352, 0.54, 0.43],
  wand: [206, 0.25, 0.54],
  item: [287, 0.33, 0.46],
};

/** Maximum hue drift for a category. Enough to take a cast, not enough to leave its family. */
const MAX_LEAN = 14;

function shortest(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function rampFor(key: CatKey, p: PaletteParams): Ramp {
  const [h, s, l] = CANON[key];
  const achromatic = key === 'dead';
  const drift = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, shortest(h, p.hue) * p.lean * 0.3));
  const hh = h + drift;
  const ss = achromatic ? 0.03 + 0.03 * p.lean : Math.min(0.9, s * p.chroma);
  const c500 = hslToHex(hh, ss, l);
  return {
    500: c500,
    300: hslToHex(hh, Math.min(0.92, ss * 1.08), Math.min(0.86, l + 0.2)),
    700: hslToHex(hh, Math.min(0.92, ss * 1.1), Math.max(0.12, l - 0.2)),
    glow: alpha(c500, achromatic ? 0.28 : 0.38),
  };
}

export function buildPalette(p: PaletteParams): Palette {
  const inkL = [0.055, 0.085, 0.125, 0.18, 0.255] as const;
  const ink = inkL.map((l, i) => hslToHex(p.hue, p.sat * (1 - i * 0.06), l));
  const parchL = [0.9, 0.82, 0.7, 0.53] as const;
  const parchS = [1, 0.9, 0.7, 0.4] as const;
  const parch = parchL.map((l, i) => hslToHex(p.parchHue, p.parchSat * parchS[i], l));
  return {
    ink: { 900: ink[0], 800: ink[1], 700: ink[2], 600: ink[3], 500: ink[4] },
    parchment: { 100: parch[0], 200: parch[1], 300: parch[2], 400: parch[3] },
    cat: Object.fromEntries(CAT_KEYS.map((k) => [k, rampFor(k, p)])) as Record<CatKey, Ramp>,
  };
}

/** The palette as inline custom properties, to scope it on a preview. */
export function paletteVars(pal: Palette): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, c] of Object.entries(pal.ink)) v[`--md-ink-${k}`] = c;
  for (const [k, c] of Object.entries(pal.parchment)) v[`--md-parchment-${k}`] = c;
  for (const key of CAT_KEYS) {
    const r = pal.cat[key];
    v[`--md-cat-${key}-500`] = r[500];
    v[`--md-cat-${key}-300`] = r[300];
    v[`--md-cat-${key}-700`] = r[700];
    v[`--md-cat-${key}-glow`] = r.glow;
  }
  return v;
}

export function groundValue(pal: Palette, light: LightKey, from: PaletteParams['lightFrom']): string {
  const at = from === 'above' ? '50% 0%' : from === 'below' ? '50% 100%' : '50% 62%';
  const shape = from === 'horizon' ? 'ellipse 80% 30%' : 'ellipse 60% 45%';
  return `radial-gradient(${shape} at ${at}, ${alpha(pal.cat[light][500], 0.07)}, transparent 70%),\n    var(--md-ink-900)`;
}

/** The CSS block, in the shape of the ones in apps/table/src/biomes.css. */
export function paletteCss(p: PaletteParams, pal: Palette): string {
  const id = p.id || 'new-biome';
  const head = `/* ---------- ${p.name.toUpperCase()} — ${p.blurb} `;
  const lines: string[] = [
    `${head}${'-'.repeat(Math.max(3, 66 - head.length))} */`,
    `[data-biome="${id}"] .md-root,`,
    `.t-door[data-biome="${id}"] {`,
  ];
  // Darkest first, as biomes.css writes them. Object order would put 500 first.
  for (const k of ['900', '800', '700', '600', '500'] as const) lines.push(`  --md-ink-${k}: ${pal.ink[k]};`);
  lines.push('');
  for (const k of ['100', '200', '300', '400'] as const) lines.push(`  --md-parchment-${k}: ${pal.parchment[k]};`);
  for (const key of CAT_KEYS) {
    const r = pal.cat[key];
    lines.push('');
    lines.push(`  --md-cat-${key}-500: ${r[500]};`);
    lines.push(`  --md-cat-${key}-300: ${r[300]};`);
    lines.push(`  --md-cat-${key}-700: ${r[700]};`);
    lines.push(`  --md-cat-${key}-glow: ${r.glow};`);
  }
  lines.push('');
  lines.push(`  --t-biome-ground:`);
  lines.push(`    ${groundValue(pal, p.light, p.lightFrom)};`);
  lines.push('}');
  return lines.join('\n');
}

export const DEFAULT_PALETTE_PARAMS: PaletteParams = {
  id: 'salt-marsh',
  name: 'Salt marsh',
  blurb: 'grey water, reed light, mist',
  hue: 190,
  sat: 0.22,
  parchHue: 44,
  parchSat: 0.42,
  lean: 0.5,
  chroma: 0.95,
  light: 'obst',
  lightFrom: 'horizon',
};
