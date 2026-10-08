import * as React from 'react';
import { DeckCard, MazeDeckProvider } from '@maze-deck/ui';
import type { CardCategory, CardSize } from '@maze-deck/ui';
import { MOTION, reducedMotion } from '../stage/motion';

/** One card on its way somewhere the stage does not already animate. */
export interface Ghost {
  id: number;
  category: CardCategory;
  size: CardSize;
  from: DOMRect;
  to: DOMRect;
}

/**
 * Cards in flight from a decision made on the table: a scouted card
 * going back onto the deck, a drawn card going into the river slot it
 * replaces.
 *
 * The stage's beats only see what changes between two views, and a
 * face-down card replaced by another face-down card does not change at
 * all — the redaction is doing its job. So a decision the table can see
 * being made flies its card itself, from where it was chosen to where
 * it went, while the dispatch has already gone: a fast GM is never made
 * to wait for it. Transform and opacity only.
 */
export function Ghosts({ ghosts, onDone }: { ghosts: Ghost[]; onDone: (id: number) => void }) {
  return (
    <>
      {ghosts.map((g) => <GhostCard key={g.id} ghost={g} onDone={onDone} />)}
    </>
  );
}

function GhostCard({ ghost, onDone }: { ghost: Ghost; onDone: (id: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) { onDone(ghost.id); return undefined; }
    const { from, to } = ghost;
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    const s = from.width > 0 ? to.width / from.width : 1;
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 24}px) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
      ],
      { duration: MOTION.fly, easing: MOTION.flyEase, fill: 'forwards' },
    );
    anim.onfinish = () => onDone(ghost.id);
    return () => anim.cancel();
  }, []);

  return (
    <div
      ref={ref}
      className="t-ghost"
      aria-hidden="true"
      style={{ left: ghost.from.left, top: ghost.from.top, width: ghost.from.width, height: ghost.from.height }}
    >
      <MazeDeckProvider size={ghost.size} background="transparent">
        <DeckCard category={ghost.category} showCount={false} />
      </MazeDeckProvider>
    </div>
  );
}
