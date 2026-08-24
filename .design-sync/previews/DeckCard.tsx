import * as React from 'react';
import { DeckCard, CATEGORIES } from '@maze-deck/ui';

/** The seven states of the doorway, in deck order. */
export const AllSevenCategories = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', gap: 12 }}>
    {CATEGORIES.map((c) => (
      <DeckCard key={c.category} category={c.category} size="sm" />
    ))}
  </div>
);

/** The card that means progress — collect five and the party escapes. */
export const ClearPath = () => <DeckCard category="clear-path" />;

/** Three different ways to be stopped. */
export const TheBlockers = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <DeckCard category="dead-end" />
    <DeckCard category="obstacle" />
    <DeckCard category="trap" />
  </div>
);

/** Without the odds line, for use on a table surface. */
export const WithoutCount = () => <DeckCard category="monster" showCount={false} />;

/** Overridden copy — the deck reskinned for a different maze. */
export const CustomCopy = () => (
  <DeckCard
    category="wanderer"
    title="Ghost Duellist"
    eyebrow="Encounter"
    rule="Longs for a fair fight. Follows the party until offered one."
  />
);
