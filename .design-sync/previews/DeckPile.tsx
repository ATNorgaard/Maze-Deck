import * as React from 'react';
import { DeckPile } from '@maze-deck/ui';

/** A full draw pile at the start of a run. */
export const FullDeck = () => <DeckPile count={22} />;

/** Running down — the reshuffle is coming. */
export const RunningLow = () => (
  <div style={{ display: 'flex', gap: 24 }}>
    <DeckPile count={9} />
    <DeckPile count={2} />
    <DeckPile count={1} />
  </div>
);

/** Exhausted. Shuffle the discard — new cards enter there first. */
export const Exhausted = () => <DeckPile count={0} />;
