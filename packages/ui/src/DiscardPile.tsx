import * as React from 'react';
import { DeckCard } from './DeckCard';
import type { CardCategory, CardSize } from './types';

export interface DiscardPileProps {
  /** Cards in the discard pile. */
  count: number;
  /** Top card, shown face-up. Omit to show an empty outline. */
  top?: CardCategory;
  /** Caption under the stack. @default "Discard" */
  label?: string;
  /** Override scale independently of the provider. */
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The discard pile, top card face-up.
 *
 * Cards forged by Forge a Path enter HERE rather than the deck —
 * a delayed reward that stops the action being spammed, so the
 * pile is worth showing rather than hiding in a counter.
 */
export function DiscardPile({ count, top, label = 'Discard', size, className, style }: DiscardPileProps) {
  return (
    <div className={['md-pile', className].filter(Boolean).join(' ')} style={style}>
      <div className="md-pile__stack" data-depth={count > 0 ? 1 : 0}>
        {top ? (
          <DeckCard category={top} size={size} showCount={false} />
        ) : (
          <div className="md-pile__empty">Empty</div>
        )}
      </div>
      <p className="md-pile__count">{count}</p>
      <p className="md-pile__label">{label}</p>
    </div>
  );
}
