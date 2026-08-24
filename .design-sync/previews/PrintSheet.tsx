import * as React from 'react';
import { MazeDeckProvider, PrintSheet, DeckCard, CardBack, AbilityCard, CATEGORIES } from '@maze-deck/ui';

/* An A4 sheet is 282mm tall at print scale, which overflows a preview
   card. These render at `sm` so the whole 2 x 3 layout is visible -
   the layout is the point of this component, not print fidelity. */
const Sheet = ({ children }: { children: React.ReactNode }) => (
  <MazeDeckProvider size="sm" style={{ background: 'transparent' }}>{children}</MazeDeckProvider>
);

/**
 * One A4 sheet of deck faces, 2 x 3, gutterless.
 * Three 69mm columns do not fit A4 once printer margins are
 * taken, which is why the grid is 2-up rather than 3-up.
 */
export const DeckFaces = () => (
  <Sheet><PrintSheet label="Deck faces — sheet 1">
    {CATEGORIES.slice(0, 6).map((c) => <DeckCard key={c.category} category={c.category} />)}
  </PrintSheet></Sheet>
);

/** A sheet of backs. Printed separately, then sleeved. */
export const CardBacks = () => (
  <Sheet><PrintSheet label="Card backs">
    {Array.from({ length: 6 }, (_, i) => <CardBack key={i} />)}
  </PrintSheet></Sheet>
);

/** The abilities sheet. */
export const Abilities = () => (
  <Sheet><PrintSheet label="Abilities">
    <AbilityCard ability="forge-a-path" />
    <AbilityCard ability="scout-ahead" />
    <AbilityCard ability="its-elementary" />
    <AbilityCard ability="careful-consideration" />
    <AbilityCard ability="boost-morale" />
  </PrintSheet></Sheet>
);
