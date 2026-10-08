import * as React from 'react';
import { DeckCard, MazeDeckProvider, getCategory } from '@maze-deck/ui';
import type { CardCategory, CardSize } from '@maze-deck/ui';
import { MOTION, reducedMotion } from '../stage/motion';

interface Props {
  /** Cards drawn off the deck, in the order they were drawn. */
  cards: CardCategory[];
  size: CardSize;
  /** The deck pile, which they rise from. */
  deckRef: React.RefObject<HTMLElement>;
  /** A card already chosen (It's Elementary's first step), or null. */
  selected: number | null;
  /** What choosing a card does, for its accessible name. */
  verb: string;
  onPick: (index: number, el: HTMLElement) => void;
}

/**
 * Cards drawn off the deck for a decision — Scout Ahead's three, It's
 * Elementary's two — fanned over the river, which steps back while
 * they are up.
 *
 * They rise from the deck pile: each card is measured where it lands in
 * the fan and animated in from the pile's top card, so they are seen
 * to come off the deck rather than appear. Transform and opacity only.
 */
export function CardFan({ cards, size, deckRef, selected, verb, onPick }: Props) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const top = deckRef.current?.querySelector('article')?.getBoundingClientRect();
    if (!top) return undefined;
    const anims = refs.current.map((el, i) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const dx = (top.left + top.width / 2) - (r.left + r.width / 2);
      const dy = (top.top + top.height / 2) - (r.top + r.height / 2);
      const s = r.width > 0 ? top.width / r.width : 1;
      return el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        { duration: MOTION.deal + 80, delay: i * MOTION.dealStagger, easing: MOTION.overshoot, fill: 'backwards' },
      );
    });
    return () => { for (const a of anims) a?.cancel(); };
    // Once, as the fan opens.
  }, []);

  const mid = (cards.length - 1) / 2;
  return (
    <div className="t-fan" role="group" aria-label="Cards drawn off the deck">
      <MazeDeckProvider size={size} background="transparent" className="t-fan__row">
        {cards.map((card, i) => (
          <button
            key={`${card}-${i}`}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            className="t-fan__card"
            data-choice=""
            aria-pressed={selected === i}
            aria-label={`${verb}: ${getCategory(card).title}, the ${ordinal(i)} drawn`}
            style={{ '--off': i - mid } as React.CSSProperties}
            autoFocus={i === 0}
            onClick={(e) => onPick(i, e.currentTarget)}
          >
            <DeckCard category={card} showCount={false} />
          </button>
        ))}
      </MazeDeckProvider>
    </div>
  );
}

function ordinal(i: number): string {
  return ['first', 'second', 'third', 'fourth'][i] ?? `${i + 1}th`;
}
