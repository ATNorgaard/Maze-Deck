/* ============================================================
   The settings' pictures, as the author approved them.

   Each setting's designs were drawn on the review page
   (docs/art-directions/) with a small pixel painter of their own,
   px.js, and approved as drawn (docs/settings-build.md). They live
   here now, one module per setting, and the game loads a setting's
   module only when it is played: fourteen settings are some 18,000
   lines, and a crossing needs one of them.

   A design paints three pictures: the card back, the vista with the
   card just turned in it, and the world behind the table. Each is a
   Painter (ramps and values per pixel, lights as fields weighed per
   frame) plus `over`, which draws sprites and particles on the
   snapped picture. The game resolves them on a canvas (the back, the
   vista) or on the GPU (the world).
   ============================================================ */

import PX from './px.js';

export { PX };

export type Side = 'inside' | 'outside';

export type SettingId =
  | 'dungeon' | 'tower' | 'deep-forest' | 'desert' | 'undercity' | 'frozen-pass'
  | 'kings-road' | 'mire' | 'high-road' | 'drowned-coast' | 'barrow-moor' | 'ember-hold' | 'underdark' | 'sunken-jungle';

/**
 * The sides each setting has (AJ7, AJ8), the default first: the outside
 * where there is one (settings-build.md, S2).
 */
export const SIDES: Record<SettingId, readonly Side[]> = {
  dungeon: ['inside'],
  tower: ['inside'],
  'deep-forest': ['outside', 'inside'],
  desert: ['outside', 'inside'],
  undercity: ['outside', 'inside'],
  'frozen-pass': ['outside', 'inside'],
  'kings-road': ['outside'],
  mire: ['outside'],
  'high-road': ['outside', 'inside'],
  'drowned-coast': ['outside', 'inside'],
  'barrow-moor': ['outside', 'inside'],
  'ember-hold': ['outside', 'inside'],
  underdark: ['inside'],
  'sunken-jungle': ['outside', 'inside'],
};

/** A side the setting has: the one asked for if it exists, else its default. */
export function sideOf(setting: SettingId, wanted?: Side | null): Side {
  const sides = SIDES[setting];
  return wanted && sides.includes(wanted) ? wanted : sides[0]!;
}

/** Anything with the shape of an ImageData: a canvas's, or a plain one in Node. */
export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** What the game reads off a painter (px.js has the rest). */
export interface Painter {
  w: number;
  h: number;
  names: string[];
  /** Each ramp as RGB triples, darkest first. */
  cols: number[][][];
  /** Per pixel: the ramp, the value along it, the layer. */
  r: Uint8Array;
  v: Float32Array;
  z: Uint8Array;
  /** Lights kept to be weighed every frame: their reach, and their strength at time t. */
  fields: { f: Float32Array; k: (t: number) => number }[];
  /** Coloured light, blended over the snapped colour in dithered fifths. */
  tints: { f: Float32Array; c: number[]; k: ((t: number) => number) | null }[];
  emit: Uint8Array;
  dither: number;
  ri(name: string): number;
  /**
   * Sorts out once which pixels any light touches, and works out the
   * rest for good; every resolve after redraws only the lit ones. The
   * first resolve does it if nothing has.
   */
  prepare(): Painter;
  resolve(t: number, img: ImageLike): ImageLike;
}

export interface Made {
  p: Painter;
  over?: (img: ImageLike, t: number) => void;
}

/** What a design can put in its vista: the five cards it was drawn for, or nothing yet. */
export type Subject = 'monster' | 'obstacle' | 'wanderer' | 'item' | 'clear-path' | 'none';

export interface Design {
  id: string;
  setting: SettingId;
  side?: Side;
  /** Set aside by the author: kept in its file, never shown. */
  dropped?: boolean;
  key: string;
  name: string;
  title: string;
  pitch: string;
  notes: string[][];
  palette: string[];
  back(W: number, H: number): Made;
  vista(W: number, H: number, subject: Subject): Made;
  world(W: number, H: number): Made;
}

type Module = { default: Design[] };
/** The settings are plain JS from the review page; their shapes are this file's word for them. */
const load = (p: Promise<unknown>) => p as Promise<Module>;
const LOADERS: Record<SettingId, () => Promise<Module>> = {
  dungeon: () => load(import('./settings/dungeon.js')),
  tower: () => load(import('./settings/tower.js')),
  'deep-forest': () => load(import('./settings/deep-forest.js')),
  desert: () => load(import('./settings/desert.js')),
  undercity: () => load(import('./settings/undercity.js')),
  'frozen-pass': () => load(import('./settings/frozen-pass.js')),
  'kings-road': () => load(import('./settings/kings-road.js')),
  mire: () => load(import('./settings/mire.js')),
  'high-road': () => load(import('./settings/high-road.js')),
  'drowned-coast': () => load(import('./settings/drowned-coast.js')),
  'barrow-moor': () => load(import('./settings/barrow-moor.js')),
  'ember-hold': () => load(import('./settings/ember-hold.js')),
  underdark: () => load(import('./settings/underdark.js')),
  'sunken-jungle': () => load(import('./settings/sunken-jungle.js')),
};

export const SETTING_IDS = Object.keys(SIDES) as SettingId[];

export function isSettingId(id: unknown): id is SettingId {
  return typeof id === 'string' && id in SIDES;
}

const loaded = new Map<SettingId, Promise<Design[]>>();

/** Every design a setting has, picked or not. Loaded once. */
export function designsOf(setting: SettingId): Promise<Design[]> {
  let p = loaded.get(setting);
  if (!p) {
    p = LOADERS[setting]().then((m) => m.default);
    loaded.set(setting, p);
  }
  return p;
}

/** The design the game plays for a setting's side. */
export async function designFor(setting: SettingId, side: Side): Promise<Design> {
  const all = await designsOf(setting);
  const want = sideOf(setting, side);
  const d = all.find((x) => x.side === want && !x.dropped);
  if (!d) throw new Error(`No ${want} design for ${setting}`);
  return d;
}

/** The card's own families, and the expansions' (drawn as an Obstacle in their colours). */
export type Category = 'clear-path' | 'obstacle' | 'wanderer' | 'item' | 'monster' | 'dead-end' | 'trap';

/**
 * A vista for any card. The designs draw the five canonical cards; a Dead
 * End and a Trap are drawn as the way blocked, in their own family's
 * colours, the Obstacle's ramp and light swapped for theirs.
 */
export function vistaOf(design: Design, W: number, H: number, category: Category | null): Made {
  if (category === 'dead-end' || category === 'trap') {
    const made = design.vista(W, H, 'obstacle');
    recolour(made.p, 'obst', category === 'dead-end' ? 'dead' : 'trap');
    return made;
  }
  return design.vista(W, H, category ?? 'none');
}

/** Swap one card family's ramp and coloured light for another's, after a picture is painted. */
function recolour(p: Painter, from: string, to: string): void {
  const card = PX.CARD as Record<string, string[]>;
  const src = card[from]!; const dst = card[to]!;
  const rgb = dst.map((h) => PX.hexRgb(h));
  const i = p.names.indexOf(from);
  if (i >= 0) p.cols[i] = rgb;
  for (const t of p.tints) {
    const k = src.findIndex((h) => { const c = PX.hexRgb(h); return c[0] === t.c[0] && c[1] === t.c[1] && c[2] === t.c[2]; });
    if (k >= 0) t.c = rgb[k]!;
  }
}

/** A blank picture to resolve into, without a canvas. */
export function imageOf(width: number, height: number): ImageLike {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
