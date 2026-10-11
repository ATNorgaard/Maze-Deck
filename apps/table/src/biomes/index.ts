/* ============================================================
   The biomes.

   One file per setting. Adding one is: a file here, a line in
   BIOMES, a palette block in biomes.css keyed by its id, its designs
   in @maze-deck/art (paint/settings) with their baked art (scripts/
   bake-backs.mjs), its sound bed (stage/bed.ts) and its dark
   (world/World.tsx). The engine, the wire and the campaign schema
   already handle "some biome".
   ============================================================ */

import { getCategory } from '@maze-deck/ui';
import type { DeckSkin } from '@maze-deck/ui';
import type { CardCategory } from '@maze-deck/rules';
import { DUNGEON } from './dungeon';
import { TOWER } from './tower';
import { DEEP_FOREST } from './deep-forest';
import { DESERT } from './desert';
import { UNDERCITY } from './undercity';
import { FROZEN_PASS } from './frozen-pass';
import { SIDES, sideOf } from '@maze-deck/art';
import type { SettingId, Side } from '@maze-deck/art';
import type { Biome, BiomeId, SideArt } from './types';

export type { Biome, BiomeId, CardWording, SideArt } from './types';
export type { Side } from '@maze-deck/art';

/** In picker order. The dungeon first because it is the printed deck. */
export const BIOMES: readonly Biome[] = [
  DUNGEON, TOWER, DEEP_FOREST, DESERT, UNDERCITY, FROZEN_PASS,
];

export const DEFAULT_BIOME: BiomeId = 'dungeon';

export function isBiomeId(id: unknown): id is BiomeId {
  return typeof id === 'string' && BIOMES.some((b) => b.id === id);
}

/**
 * Look a biome up, tolerantly.
 *
 * A run created before biomes existed carries no id, and a room on
 * the server may outlive a biome that is later renamed. Both fall
 * back to the dungeon rather than to a blank screen.
 */
export function biomeOf(id: string | null | undefined): Biome {
  return BIOMES.find((b) => b.id === id) ?? DUNGEON;
}

/**
 * What the component library is handed.
 *
 * The eyebrow keeps the CANONICAL name — a card titled "Game Trail"
 * still says "Clear Path" above it in small capitals. That is what
 * keeps the log, the reference card and the rules text legible
 * against a reskinned river: the mechanic never loses its name, it
 * only gains a local one.
 */
const SKINS = new Map<string, DeckSkin>();

/** The sides a setting has, its default first (AJ7). */
export function sidesOf(biome: Biome): readonly Side[] {
  return SIDES[biome.id as SettingId];
}

/** A side the setting has: the one asked for where it exists, else its default. */
export function sideFor(biome: Biome, wanted?: string | null): Side {
  return sideOf(biome.id as SettingId, wanted === 'inside' || wanted === 'outside' ? wanted : null);
}

/** One side's pictures. */
export function artOf(biome: Biome, side?: string | null): SideArt | undefined {
  return biome.art[sideFor(biome, side)];
}

export function skinOf(biome: Biome, side?: string | null): DeckSkin {
  const key = `${biome.id}:${sideFor(biome, side)}`;
  const cached = SKINS.get(key);
  if (cached) return cached;

  const skin: DeckSkin = { motif: biome.motif };
  // The side's back, the whole card: the designs are painted, so they do
  // not part into depth layers (docs/settings-build.md, S5).
  const art = artOf(biome, side);
  if (art) skin.backArt = art.back;
  if (biome.cards) {
    const copy: NonNullable<DeckSkin['copy']> = {};
    for (const key of Object.keys(biome.cards) as CardCategory[]) {
      const w = biome.cards[key];
      copy[key] = {
        title: w.title,
        eyebrow: getCategory(key).title,
        rule: w.rule,
        emphasis: w.emphasis,
      };
    }
    skin.copy = copy;
  }
  SKINS.set(key, skin);
  return skin;
}

/** The setting's name for a card, for prose outside the card itself. */
export function cardName(biome: Biome, category: CardCategory): string {
  return biome.cards?.[category]?.title ?? getCategory(category).title;
}
