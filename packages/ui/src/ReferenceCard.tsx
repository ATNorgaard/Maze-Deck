import * as React from 'react';
import {
  CANONICAL_CATEGORIES, DECK_TOTAL, ENCOUNTER_AT, ESCAPE_TARGET,
  MAZE_DC, OBSTACLE_JAM, RIVER_WIDTH,
} from './types';
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
  <><strong>Turn.</strong> Act first, commit to a path second — never the reverse.</>,
  <><strong>Goal.</strong> {ESCAPE_TARGET} Clear Paths and the party is through.</>,
  <><strong>Obstacles stay.</strong> {OBSTACLE_JAM} at once: discard them all, a Monster follows.</>,
  <><strong>Monsters.</strong> One strike each. At {ENCOUNTER_AT} the party is found.</>,
  <><strong>The card is never named.</strong> Describe the scene instead.</>,
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
      : CANONICAL_CATEGORIES.map((c) => (
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
