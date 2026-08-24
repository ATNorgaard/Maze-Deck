import * as React from 'react';
import { AbilityCard, ABILITIES } from '@maze-deck/ui';

/** All five abilities — the party's full toolkit. */
export const AllFiveAbilities = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', gap: 12 }}>
    {ABILITIES.map((a) => <AbilityCard key={a.ability} ability={a.ability} size="sm" />)}
  </div>
);

/** One card, close up. */
export const ForgeAPath = () => <AbilityCard ability="forge-a-path" />;

/** Locked by the end-of-round d6 — greyed in place, never removed. */
export const LockedByD6 = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <AbilityCard ability="scout-ahead" />
    <AbilityCard ability="scout-ahead" locked />
  </div>
);

/** A deeper maze: one number moves every check on every card. */
export const HarderMaze = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <AbilityCard ability="careful-consideration" dc={17} />
    <AbilityCard ability="boost-morale" dc={17} />
  </div>
);

/** Without the rationale footnote, for a tighter table layout. */
export const WithoutRationale = () => (
  <AbilityCard ability="its-elementary" showRationale={false} />
);
