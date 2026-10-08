import * as React from 'react';
import type { CardCategory } from './types';

/* ============================================================
   DECK SKIN
   How a host reskins the deck without the library knowing why.

   A card's printed copy and the card back's field pattern are the
   two things a setting changes — a Clear Path in a forest is a
   game trail, and the back of a card in a frozen pass is ice, not
   a Greek fret. The mechanics, the palette ramps, the geometry
   and the shape codes never move.

   Deliberately NOT a theme system: the library does not know what
   a "biome" is. It knows that a provider may hand it overrides,
   and every card underneath reads them. Colour is left to CSS —
   the tokens are custom properties precisely so a host can scope
   a different palette with one selector.
   ============================================================ */

/** Overrides for one category's printed copy. Anything omitted keeps the canon. */
export interface CardCopy {
  /** The name the setting gives the card. */
  title?: string;
  /** The letterspaced kicker. Hosts usually put the canonical name here. */
  eyebrow?: string;
  /** The one-line mechanic, reworded for the setting. */
  rule?: string;
  /** The phrase inside `rule` to tint. Omit to tint nothing. */
  emphasis?: string;
}

/**
 * The field pattern on the card back.
 *
 * Every card in a run wears the SAME motif — it is set once on the
 * provider, never per card — so it carries no category information
 * and cannot break the face-down river.
 */
export type CardBackMotif = 'fret' | 'stair' | 'branch' | 'dune' | 'brick' | 'crystal';

export interface DeckSkin {
  copy?: Partial<Record<CardCategory, CardCopy>>;
  motif?: CardBackMotif;
  /**
   * A picture for the card back's field, as a URL. When set it
   * stands in for the motif's maze; the vignette, frame and seal
   * still draw over it. Like the motif it is set once on the
   * provider, so it is the same on every card and says nothing
   * about any one of them.
   */
  backArt?: string;
  /**
   * The same picture as layers, back to front, as URLs — for a host
   * that moves them against each other in depth. When set they stand
   * in for `backArt`, each as a `.md-card__art` carrying `data-depth`
   * (0 for the farthest); the library itself never moves them. Set
   * once on the provider like the rest, so every back is the same.
   */
  backLayers?: string[];
}

const DeckSkinContext = React.createContext<DeckSkin>({});

/**
 * Nested providers inherit: the board wraps its action bar in a
 * second provider for scale alone, and that must not strip the
 * skin off the cards inside it.
 */
export function DeckSkinProvider({ skin, children }: { skin: DeckSkin; children?: React.ReactNode }) {
  const parent = React.useContext(DeckSkinContext);
  const value = React.useMemo<DeckSkin>(() => {
    const merged: DeckSkin = {};
    const copy = skin.copy ?? parent.copy;
    const motif = skin.motif ?? parent.motif;
    const backArt = skin.backArt ?? parent.backArt;
    const backLayers = skin.backLayers ?? parent.backLayers;
    if (copy) merged.copy = copy;
    if (motif) merged.motif = motif;
    if (backArt) merged.backArt = backArt;
    if (backLayers) merged.backLayers = backLayers;
    return merged;
  }, [skin.copy, skin.motif, skin.backArt, skin.backLayers, parent.copy, parent.motif, parent.backArt, parent.backLayers]);
  return <DeckSkinContext.Provider value={value}>{children}</DeckSkinContext.Provider>;
}

export function useDeckSkin(): DeckSkin {
  return React.useContext(DeckSkinContext);
}

/** The copy a card should print for its category, skin applied. */
export function useCardCopy(category: CardCategory): CardCopy {
  return useDeckSkin().copy?.[category] ?? {};
}
