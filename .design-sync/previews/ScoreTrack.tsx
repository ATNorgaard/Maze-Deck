import * as React from 'react';
import { ScoreTrack } from '@maze-deck/ui';

/** Both tracks as they sit on the table: progress and threat. */
export const ProgressAndThreat = () => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <ScoreTrack value={3} />
    <ScoreTrack value={1} variant="threat" />
  </div>
);

/** The whole escape run, pip by pip. */
export const EscapeProgression = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {[0, 2, 4, 5].map((v) => <ScoreTrack key={v} value={v} />)}
  </div>
);

/** One more Monster and the party is in a fight. */
export const OneStrikeFromTrouble = () => <ScoreTrack value={1} variant="threat" />;

/** A custom target for a longer maze. */
export const LongerMaze = () => <ScoreTrack value={4} total={8} label="Escape" />;
