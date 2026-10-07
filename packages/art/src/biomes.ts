/* ============================================================
   What the atelier knows about a biome.

   The table app owns the biomes as content (copy, tables,
   palette in biomes.css). The atelier does not duplicate any of
   that. It adds only the DRAWING vocabulary a setting implies —
   what the horizon is made of, what drifts in the air, where the
   light comes from — and reads the real palette off the CSS at
   runtime, so a token edited in biomes.css shows up here on the
   next render.
   ============================================================ */

import type { CardBackMotif } from '@maze-deck/ui';

export type BiomeId = 'dungeon' | 'tower' | 'deep-forest' | 'desert' | 'undercity' | 'frozen-pass';

/** The horizon. Each is a family of height functions in scene.tsx. */
export type Terrain = 'pillars' | 'stairs' | 'trees' | 'dunes' | 'vaults' | 'peaks';

/** What is in the air. */
export type Particle = 'dust' | 'embers' | 'motes' | 'sand' | 'drips' | 'snow';

/** The category token that lights a room in this setting. */
export type LightKey = 'path' | 'obst' | 'wand' | 'item' | 'trap';

export interface BiomeVocab {
  id: BiomeId;
  name: string;
  motif: CardBackMotif;
  terrain: Terrain;
  particle: Particle;
  light: LightKey;
  /** A sun or a moon in the sky, if the setting has a sky. */
  disc?: 'sun' | 'moon';
  blurb: string;
}

export const BIOMES: readonly BiomeVocab[] = [
  { id: 'dungeon', name: 'Dungeon', motif: 'fret', terrain: 'pillars', particle: 'dust', light: 'path',
    blurb: 'Cut stone, torchlight, a corridor of pillars.' },
  { id: 'tower', name: 'Tower', motif: 'stair', terrain: 'stairs', particle: 'motes', light: 'path',
    blurb: 'Dry stone and candle brass. Everything climbs.' },
  { id: 'deep-forest', name: 'Deep forest', motif: 'branch', terrain: 'trees', particle: 'motes', light: 'obst',
    blurb: 'Green-black under the canopy, sun in shafts.' },
  { id: 'desert', name: 'Desert', motif: 'dune', terrain: 'dunes', particle: 'sand', light: 'path', disc: 'sun',
    blurb: 'Umber dunes, heat off the horizon.' },
  { id: 'undercity', name: 'Undercity', motif: 'brick', terrain: 'vaults', particle: 'drips', light: 'obst',
    blurb: 'Brick vaults, standing water, verdigris.' },
  { id: 'frozen-pass', name: 'Frozen pass', motif: 'crystal', terrain: 'peaks', particle: 'snow', light: 'wand', disc: 'moon',
    blurb: 'Blue-black ice, a whiteout between peaks.' },
];

export const DEFAULT_BIOME: BiomeId = 'dungeon';

export function isBiomeId(x: unknown): x is BiomeId {
  return BIOMES.some((b) => b.id === x);
}

export function vocabOf(id: BiomeId): BiomeVocab {
  return BIOMES.find((b) => b.id === id) ?? BIOMES[0];
}

/* ---------- the palette, read from the CSS ------------------- */

export const CAT_KEYS = ['path', 'dead', 'obst', 'trap', 'mons', 'wand', 'item'] as const;
export type CatKey = (typeof CAT_KEYS)[number];

export interface Ramp { 500: string; 300: string; 700: string; glow: string }

export interface Palette {
  ink: { 900: string; 800: string; 700: string; 600: string; 500: string };
  parchment: { 100: string; 200: string; 300: string; 400: string };
  cat: Record<CatKey, Ramp>;
}

/**
 * Read every token the generators need off an `.md-root` that is
 * sitting under the right `data-biome`. The values are the declared
 * strings — hex for the ramps, rgba() for the glows — which is what
 * a standalone SVG export needs, since it cannot carry a var().
 */
export function readPalette(root: Element): Palette {
  const cs = getComputedStyle(root);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const ramp = (k: CatKey): Ramp => ({
    500: v(`--md-cat-${k}-500`), 300: v(`--md-cat-${k}-300`),
    700: v(`--md-cat-${k}-700`), glow: v(`--md-cat-${k}-glow`),
  });
  return {
    ink: { 900: v('--md-ink-900'), 800: v('--md-ink-800'), 700: v('--md-ink-700'), 600: v('--md-ink-600'), 500: v('--md-ink-500') },
    parchment: { 100: v('--md-parchment-100'), 200: v('--md-parchment-200'), 300: v('--md-parchment-300'), 400: v('--md-parchment-400') },
    cat: Object.fromEntries(CAT_KEYS.map((k) => [k, ramp(k)])) as Record<CatKey, Ramp>,
  };
}

/** The dungeon as tokens.css declares it — a fallback before the CSS has been read. */
export const FALLBACK_PALETTE: Palette = {
  ink: { 900: '#0A0F12', 800: '#10181C', 700: '#182429', 600: '#22323A', 500: '#33474F' },
  parchment: { 100: '#F2EBDA', 200: '#E4D9BF', 300: '#C9BC9C', 400: '#9B8F74' },
  cat: {
    path: { 500: '#E3A445', 300: '#F2CB8A', 700: '#8A5E1E', glow: 'rgba(227,164,69,0.40)' },
    dead: { 500: '#7C7B78', 300: '#B2B1AD', 700: '#45443F', glow: 'rgba(124,123,120,0.28)' },
    obst: { 500: '#43917B', 300: '#7FC0AC', 700: '#235347', glow: 'rgba(67,145,123,0.38)' },
    trap: { 500: '#97A63A', 300: '#C7D477', 700: '#4E5718', glow: 'rgba(151,166,58,0.36)' },
    mons: { 500: '#A93343', 300: '#D9707C', 700: '#66161F', glow: 'rgba(169,51,67,0.42)' },
    wand: { 500: '#6B8CA6', 300: '#A6C0D4', 700: '#34495C', glow: 'rgba(107,140,166,0.34)' },
    item: { 500: '#8B4F9C', 300: '#C08FCE', 700: '#4E2359', glow: 'rgba(139,79,156,0.38)' },
  },
};

/* ---------- colour arithmetic -------------------------------- */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Linear mix of two hex colours, t in 0..1 towards `b`. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** `rgba(r,g,b,a)` from a hex colour. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')})`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
