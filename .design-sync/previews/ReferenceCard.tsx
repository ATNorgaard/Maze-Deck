import * as React from 'react';
import { ReferenceCard } from '@maze-deck/ui';

/** Both GM references as they sit on the table together. */
export const BothReferences = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <ReferenceCard variant="loop" />
    <ReferenceCard variant="deck" />
  </div>
);

/** The turn structure and the standing rules. */
export const TheLoop = () => <ReferenceCard variant="loop" />;

/** The card index, with copy counts. */
export const TheDeck = () => <ReferenceCard variant="deck" />;

/** Scaled for a higher-level party. */
export const HarderMaze = () => <ReferenceCard variant="loop" dc={17} />;
