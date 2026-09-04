/* ============================================================
   The biomes.

   One file per setting. Adding one is: a file here, a line in
   BIOMES, and a palette block in biomes.css keyed by its id. The
   engine, the wire, the campaign schema and every screen already
   handle "some biome" — nothing else needs to know a new one
   exists.
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
import type { Biome, BiomeId } from './types';

export type { Biome, BiomeId, CardWording } from './types';

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
const SKINS = new Map<BiomeId, DeckSkin>();

export function skinOf(biome: Biome): DeckSkin {
  const cached = SKINS.get(biome.id);
  if (cached) return cached;

  const skin: DeckSkin = { motif: biome.motif };
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
  SKINS.set(biome.id, skin);
  return skin;
}

/** The setting's name for a card, for prose outside the card itself. */
export function cardName(biome: Biome, category: CardCategory): string {
  return biome.cards?.[category]?.title ?? getCategory(category).title;
}
