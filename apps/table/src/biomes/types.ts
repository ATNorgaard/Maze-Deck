/* ============================================================
   What a biome is.

   A maze is a way from A to B, and A and B can be anywhere: a
   dungeon, a tower, a forest, a desert, the sewers under a city,
   a mountain pass in a whiteout. The rules do not change between
   them — a Clear Path is a Clear Path — but everything the table
   SEES does: what the cards are called, what colour the light is,
   what is on the back of a card, and what the GM is handed to
   narrate when one is turned over.

   So a biome is content, not mechanics. The engine carries its id
   and never reads it. See docs/DECISIONS.md.
   ============================================================ */

import type { CardBackMotif } from '@maze-deck/ui';
import type { CardCategory } from '@maze-deck/rules';
import type { Side } from '@maze-deck/art';
import type { Tables } from '../tables';

export type BiomeId =
  | 'dungeon'
  | 'tower'
  | 'deep-forest'
  | 'desert'
  | 'undercity'
  | 'frozen-pass'
  | 'kings-road'
  | 'mire'
  | 'high-road'
  | 'drowned-coast'
  | 'barrow-moor'
  | 'ember-hold'
  | 'underdark'
  | 'sunken-jungle';

/** One card's printed copy in this setting. The mechanic is unchanged. */
export interface CardWording {
  /** The name the setting gives it. Short — it is set in engraved capitals. */
  title: string;
  /** The one-line rule, reworded. Must still say exactly what the card does. */
  rule: string;
  /** The phrase inside `rule` the card tints. */
  emphasis: string;
}

/** One side's pictures, as URLs. */
export interface SideArt {
  /** The card back, 96 x 134. */
  back: string;
  /** The world as one still frame, 320 x 200. */
  still: string;
}

export interface Biome {
  id: BiomeId;
  name: string;
  /** One line under the picker: what the place is, and what a card means in it. */
  flavour: string;
  /** The field on the card back. Same on every card in the run. */
  motif: CardBackMotif;
  /**
   * The card family whose colour lights the place (AJ4): only Clear
   * Path gold, Obstacle teal and Wanderer blue light a setting. The
   * world's gold of getting through is this colour.
   */
  light: 'path' | 'obst' | 'wand';
  /**
   * A second family the place may show as weather (AJ4, amended): a night
   * sky, a storm sea. It may fill up to 15% of a picture where any other
   * family keeps under 5% (check-art.cjs). Most settings have none.
   */
  weather?: 'path' | 'obst' | 'wand';
  /**
   * Each side's pictures (AJ7), baked from its design by
   * scripts/bake-backs.mjs: the deck's back for that side, and the
   * world's still frame for when the world is off. The sides a setting
   * has are `SIDES` in @maze-deck/art.
   */
  art: Partial<Record<Side, SideArt>>;
  /**
   * The cards' copy. `null` keeps the canonical wording — the
   * dungeon is the printed deck, so it does not reword anything.
   */
  cards: Record<CardCategory, CardWording> | null;
  /** This setting's own scenario tables. All original writing. */
  tables: Tables;
}
