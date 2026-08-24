import * as React from 'react';
import { MazeDeckProvider, DeckCard, ScoreTrack, ActionBar } from '@maze-deck/ui';

/**
 * The root wrapper. REQUIRED — every token lives on `.md-root`,
 * so anything rendered outside it resolves no custom properties
 * and paints as unstyled boxes. It does not throw; it just looks
 * wrong, which is the harder failure to notice.
 */
export const TheWrapper = () => (
  <MazeDeckProvider style={{ padding: 20 }}>
    <DeckCard category="clear-path" />
  </MazeDeckProvider>
);

/**
 * One prop rescales the whole system. Every dimension, type size
 * and hairline derives from a single unit, so the card stays in
 * proportion rather than just changing box size.
 */
export const SizeSteps = () => (
  <MazeDeckProvider style={{ padding: 20 }}>
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <DeckCard category="monster" size="sm" />
      <DeckCard category="monster" size="md" />
      <DeckCard category="monster" size="lg" />
    </div>
  </MazeDeckProvider>
);

/** Trim and safe-zone guides, for proofing a print run. */
export const WithPrintGuides = () => (
  <MazeDeckProvider guides style={{ padding: 20 }}>
    <div style={{ display: 'flex', gap: 14 }}>
      <DeckCard category="trap" />
      <DeckCard category="item" />
    </div>
  </MazeDeckProvider>
);

/** A table surface: the wrapper hosting several play components. */
export const ATableSurface = () => (
  <MazeDeckProvider size="sm" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <ScoreTrack value={3} />
      <ScoreTrack value={1} variant="threat" />
    </div>
    <ActionBar locked={['boost-morale']} />
  </MazeDeckProvider>
);
