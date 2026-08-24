import * as React from 'react';
import { CardBack } from '@maze-deck/ui';

/** The uniform back. Every card in the deck shows exactly this. */
export const TheBack = () => <CardBack />;

/**
 * Three backs side by side — the river as it is actually dealt.
 * They must be indistinguishable; anything that tells one from
 * another breaks the game, not just the look.
 */
export const DealtFaceDown = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <CardBack /><CardBack /><CardBack />
  </div>
);

/** The same back at all three scales — the fret density must not drift. */
export const AcrossScales = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <CardBack size="sm" /><CardBack size="md" /><CardBack size="lg" />
  </div>
);
