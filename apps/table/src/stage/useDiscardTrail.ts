import * as React from 'react';
import type { CardCategory, GameView } from '@maze-deck/rules';

/**
 * The last three cards seen to land on the discard, newest first, for a
 * pile that shows its top three slightly scattered (docs/overhaul.md,
 * phase 6).
 *
 * The view names only the discard's top card, so this is what this
 * screen watched arrive, read off the PRESENTED view as each beat lands:
 * a pile that grew takes the new top; one that shrank (a reshuffle, a
 * Monster put out of the game) starts again from its top. A screen
 * opened mid-crossing knows the top card and nothing under it, which is
 * all a table would have seen either.
 */
export function useDiscardTrail(view: GameView): CardCategory[] {
  const { discardCount: count, discardTop: top } = view;
  const [trail, setTrail] = React.useState<CardCategory[]>(() => (top ? [top] : []));
  const last = React.useRef({ count, top });
  React.useEffect(() => {
    const was = last.current;
    last.current = { count, top };
    if (!top || count === 0) setTrail([]);
    else if (count > was.count) setTrail((t) => [top, ...t].slice(0, 3));
    else if (count < was.count) setTrail([top]);
    else if (top !== was.top) setTrail((t) => [top, ...t.slice(1)]);
  }, [count, top]);
  return trail;
}
