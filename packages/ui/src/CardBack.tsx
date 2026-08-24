import * as React from 'react';
import { ArchGlyph } from './ArchGlyph';
import type { CardSize } from './types';

/** Greek-fret labyrinth field. Category-neutral by construction. */
function MazeField() {
  const id = React.useId().replace(/:/g, '');
  // The viewBox is the card's own 63:88 ratio, so the fret always
  // tiles exactly 10 cells across whatever size the card renders at.
  // Without it the tile is a fixed 24px and the back visibly coarsens
  // as the card shrinks - the one thing a uniform back must never do.
  return (
    <svg className="md-card__maze" aria-hidden="true"
         viewBox="0 0 240 335" preserveAspectRatio="none">
      <defs>
        <pattern id={`md-maze-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0,24 V4 H20 V20 H8 V12 H16 V16 H12"
                fill="none" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="240" height="335" fill={`url(#md-maze-${id})`} />
    </svg>
  );
}

export interface CardBackProps {
  /** Override this card's scale independently of the provider. */
  size?: CardSize;
  /** Renders hover/focus affordances and makes the card activatable. */
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The uniform card back. Identical for every card in the deck.
 *
 * The river is dealt face-down, so this must carry NO category
 * information of any kind — anything that distinguishes one back
 * from another breaks the game, not just the look.
 */
export function CardBack({ size, onSelect, className, style }: CardBackProps) {
  const interactive = Boolean(onSelect);
  return (
    <article
      className={['md-card', 'md-card--back', 'md-cat-path', className].filter(Boolean).join(' ')}
      data-size={size}
      data-interactive={interactive || undefined}
      style={style}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? 'Face-down card' : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); }
            }
          : undefined
      }
    >
      <div className="md-card__trim">
        <MazeField />
        <div className="md-card__vignette" />
        <div className="md-card__frame" />
        <ArchGlyph state="seal" className="md-card__seal" />
      </div>
    </article>
  );
}
