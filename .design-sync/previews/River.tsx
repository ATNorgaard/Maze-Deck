import * as React from 'react';
import { River } from '@maze-deck/ui';

/** The start of a turn: three paths, none of them known yet. */
export const AllFaceDown = () => (
  <River slots={[
    { category: 'clear-path', faceDown: true },
    { category: 'monster', faceDown: true },
    { category: 'item', faceDown: true },
  ]} />
);

/**
 * Mid-run. An Obstacle has stuck in the left slot and will stay
 * there until a check resolves it; the centre is still unknown.
 */
export const OneBlockerStuck = () => (
  <River slots={[
    { category: 'obstacle' },
    { category: 'clear-path', faceDown: true },
    { category: 'wanderer', faceDown: true },
  ]} />
);

/** Careful Consideration revealed two before anyone committed. */
export const TwoRevealed = () => (
  <River slots={[
    { category: 'trap' },
    { category: 'clear-path' },
    { category: 'item', faceDown: true },
  ]} />
);

/** Three blockers: clear all, add a Monster. The river warns first. */
export const FullyBlocked = () => (
  <River slots={[
    { category: 'dead-end' },
    { category: 'obstacle' },
    { category: 'trap' },
  ]} />
);

/** A slot waiting on a refill — the row holds its width. */
export const AwaitingRefill = () => (
  <River slots={[
    { category: 'clear-path', faceDown: true },
    { category: null },
    { category: 'monster', faceDown: true },
  ]} />
);
