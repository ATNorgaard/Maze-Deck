import * as React from 'react';
import { ArchGlyph } from './ArchGlyph';
import { useDeckSkin } from './DeckSkin';
import type { CardBackMotif } from './DeckSkin';
import type { CardSize } from './types';

/* The field, one 24-unit tile per motif. Every tile is the same
   weight of line at about the same density, so a back reads as "a
   maze of something" from across the table whichever setting it is
   in:

   fret     the Greek-key labyrinth. The default, and the print deck.
   stair    steps climbing the diagonal — a tower's stairwell.
   branch   a forking trail — deep forest.
   dune     crest lines — desert.
   brick    running bond — undercity.
   crystal  a hexagonal lattice — ice, frozen pass.                  */
const FIELD: Record<CardBackMotif, string> = {
  fret: 'M0,24 V4 H20 V20 H8 V12 H16 V16 H12',
  stair: 'M0,24 H6 V18 H12 V12 H18 V6 H24 V0 M0,12 H3 V9 H6 V6 H9 V3 H12 V0',
  branch: 'M12,24 V13 M12,13 L4,3 M12,13 L20,5 M8,8 L11,4 M17,9 L21,9',
  dune: 'M0,18 Q6,10 12,18 T24,18 M0,8 Q6,2 12,8 T24,8',
  brick: 'M0,6 H24 M0,18 H24 M6,6 V18 M18,18 V24 M18,0 V6',
  crystal: 'M12,1 L21,6.5 V17.5 L12,23 L3,17.5 V6.5 Z M12,1 V12 L21,17.5 M12,12 L3,17.5',
};

/**
 * The labyrinth field. Category-neutral by construction: the motif
 * comes from the provider's skin, so every card in a run wears the
 * same one.
 */
function MazeField({ motif }: { motif: CardBackMotif }) {
  const id = React.useId().replace(/:/g, '');
  // The viewBox is the card's own 63:88 ratio, so the field always
  // tiles exactly 10 cells across whatever size the card renders at.
  // Without it the tile is a fixed 24px and the back visibly coarsens
  // as the card shrinks - the one thing a uniform back must never do.
  return (
    <svg className="md-card__maze" aria-hidden="true"
         viewBox="0 0 240 335" preserveAspectRatio="none">
      <defs>
        <pattern id={`md-maze-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d={FIELD[motif]}
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
 * from another breaks the game, not just the look. The motif is
 * safe for exactly that reason: it is read from the provider, so
 * it is the same on every card at once and has no per-card input.
 */
export function CardBack({ size, onSelect, className, style }: CardBackProps) {
  const interactive = Boolean(onSelect);
  const motif = useDeckSkin().motif ?? 'fret';
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
        <MazeField motif={motif} />
        <div className="md-card__vignette" />
        <div className="md-card__frame" />
        <ArchGlyph state="seal" className="md-card__seal" />
      </div>
    </article>
  );
}
