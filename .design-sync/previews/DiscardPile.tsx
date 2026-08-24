import * as React from 'react';
import { DiscardPile } from '@maze-deck/ui';

/** An Item was taken and the card went straight to the discard. */
export const TopCardItem = () => <DiscardPile count={7} top="item" />;

/** A Monster was beaten; it leaves the deck for good. */
export const TopCardMonster = () => <DiscardPile count={12} top="monster" />;

/** Nothing discarded yet. */
export const Empty = () => <DiscardPile count={0} />;

/** Forge a Path just fed two Clear Paths in here — a delayed reward. */
export const AfterForgeAPath = () => (
  <div style={{ display: 'flex', gap: 24 }}>
    <DiscardPile count={4} top="clear-path" />
    <DiscardPile count={6} top="clear-path" />
  </div>
);
