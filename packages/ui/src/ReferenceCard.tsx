import * as React from 'react';
import { CATEGORIES, DECK_TOTAL, MAZE_DC, RIVER_WIDTH } from './types';
import type { CardSize } from './types';

export interface ReferenceCardProps {
  /**
   * Which reference to print.
   * `loop` is the turn structure and the standing rules;
   * `deck` is the card index with copy counts.
   * @default "loop"
   */
  variant?: 'loop' | 'deck';
  /** Difficulty shown on the loop card's badge. @default 13 */
  dc?: number;
  /** Override the heading. */
  title?: string;
  /** Replace the rule lines entirely (loop variant only). */
  entries?: React.ReactNode[];
  /** Override this card's scale independently of the provider. */
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}

const LOOP_ENTRIES: React.ReactNode[] = [
  <><strong>River.</strong> {RIVER_WIDTH} cards, face-down. Refill on every pick.</>,
  <><strong>Turn.</strong> Act first, reveal second — never the reverse.</>,
  <><strong>Three blockers</strong> in the river: clear all, add a Monster.</>,
  <><strong>Reshuffle.</strong> New cards enter the discard first.</>,
  <><strong>Lockout.</strong> End of round, roll d6: that action is off next round.</>,
  <><strong>Scaling.</strong> Under 5 players, cut actions to party size.</>,
];

/**
 * A GM reference card. Not part of the shuffled deck — it sits
 * face-up on the table for the whole session.
 */
export function ReferenceCard({
  variant = 'loop',
  dc = MAZE_DC,
  title,
  entries,
  size,
  className,
  style,
}: ReferenceCardProps) {
  const isLoop = variant === 'loop';
  const lines: React.ReactNode[] = entries
    ?? (isLoop
      ? LOOP_ENTRIES
      : CATEGORIES.map((c) => (
          <><strong>{c.title}</strong> ×{c.copies} — {c.rule}</>
        )));

  return (
    <article
      className={['md-card', 'md-card--ref', 'md-cat-path', className].filter(Boolean).join(' ')}
      data-size={size}
      data-variant={variant}
      style={style}
    >
      <div className="md-card__trim">
        <div className="md-card__light" />
        <div className="md-card__frame" />
        <div className="md-card__safe">
          <h2 className="md-ref__title">{title ?? (isLoop ? 'The Loop' : 'The Deck')}</h2>
          <div className="md-ref__badge">{isLoop ? `Maze DC ${dc}` : `${DECK_TOTAL} cards`}</div>
          <ul className="md-ref__list">
            {lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      </div>
    </article>
  );
}
