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
import type { Tables } from '../tables';

export type BiomeId =
  | 'dungeon'
  | 'tower'
  | 'deep-forest'
  | 'desert'
  | 'undercity'
  | 'frozen-pass';

/** One card's printed copy in this setting. The mechanic is unchanged. */
export interface CardWording {
  /** The name the setting gives it. Short — it is set in engraved capitals. */
  title: string;
  /** The one-line rule, reworded. Must still say exactly what the card does. */
  rule: string;
  /** The phrase inside `rule` the card tints. */
  emphasis: string;
}

export interface Biome {
  id: BiomeId;
  name: string;
  /** One line under the picker: what the place is, and what a card means in it. */
  flavour: string;
  /** The field on the card back. Same on every card in the run. */
  motif: CardBackMotif;
  /**
   * The cards' copy. `null` keeps the canonical wording — the
   * dungeon is the printed deck, so it does not reword anything.
   */
  cards: Record<CardCategory, CardWording> | null;
  /** This setting's own scenario tables. All original writing. */
  tables: Tables;
}
