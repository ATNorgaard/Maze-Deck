import * as React from 'react';
import { CardBack } from './CardBack';
import type { CardSize } from './types';

export interface DeckPileProps {
  /** Cards remaining in the draw pile. */
  count: number;
  /** Caption under the stack. @default "Deck" */
  label?: string;
  /** Called when the pile is drawn from. */
  onDraw?: () => void;
  /** Override scale independently of the provider. */
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The draw pile.
 *
 * Depth is drawn with two offset shadows rather than real stacked
 * cards — a 28-card pile should not cost 28 DOM nodes, and the
 * top card is the only one anyone can interact with anyway.
 */
export function DeckPile({ count, label = 'Deck', onDraw, size, className, style }: DeckPileProps) {
  const empty = count <= 0;
  return (
    <div className={['md-pile', className].filter(Boolean).join(' ')} data-size={size} style={style}>
      <div className="md-pile__stack" data-depth={empty ? 0 : Math.min(count, 3)}>
        {empty ? (
          <div className="md-pile__empty">Reshuffle discard</div>
        ) : (
          <>
            {count > 2 ? <div className="md-pile__shadow md-pile__shadow--2" /> : null}
            {count > 1 ? <div className="md-pile__shadow md-pile__shadow--1" /> : null}
            <CardBack size={size} onSelect={onDraw} />
          </>
        )}
      </div>
      <p className="md-pile__count">{count}</p>
      <p className="md-pile__label">{label}</p>
    </div>
  );
}
