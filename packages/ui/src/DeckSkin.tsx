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
    if (copy) merged.copy = copy;
    if (motif) merged.motif = motif;
    return merged;
  }, [skin.copy, skin.motif, parent.copy, parent.motif]);
  return <DeckSkinContext.Provider value={value}>{children}</DeckSkinContext.Provider>;
}

export function useDeckSkin(): DeckSkin {
  return React.useContext(DeckSkinContext);
}

/** The copy a card should print for its category, skin applied. */
export function useCardCopy(category: CardCategory): CardCopy {
  return useDeckSkin().copy?.[category] ?? {};
}
