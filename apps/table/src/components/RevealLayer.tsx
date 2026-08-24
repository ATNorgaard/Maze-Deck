import * as React from 'react';
import { DeckCard } from '@maze-deck/ui';
import type { Revealed } from '@maze-deck/rules';

interface Props {
  revealed: Revealed | null;
  riverRef: React.RefObject<HTMLDivElement>;
  discardRef: React.RefObject<HTMLDivElement>;
  /** Fired when the beat is over and the card may resolve. */
  onDone: () => void;
  /** The slot whose card has lifted out, so the board can mask it. */
  onLift: (slot: number | null) => void;
}

const HOLD_MS = 900;
const FLY_MS = 620;

interface Flight { from: DOMRect; to: DOMRect; }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The beat between committing to a path and the card resolving.
 *
 * The card is already face up in the river — the River component draws
 * it, because the engine flipped the slot. This layer adds the second
 * half: a clone lifts out of the slot and flies to the discard while
 * the original is masked, then the reveal advances on its own. Nobody
 * has to dismiss anything.
 *
 * It reads `.md-river__slot` to find the slot's position. That is the
 * library's internal markup, so this is a read-only query and the one
 * place the app knows anything about River's DOM.
 */
export function RevealLayer({ revealed, riverRef, discardRef, onDone, onLift }: Props) {
  const [flight, setFlight] = React.useState<Flight | null>(null);
  const [moving, setMoving] = React.useState(false);
  const done = React.useRef(onDone);
  done.current = onDone;
  const lift = React.useRef(onLift);
  lift.current = onLift;

  React.useEffect(() => {
    setFlight(null);
    setMoving(false);
    if (!revealed) return;

    if (prefersReducedMotion()) {
      const t = window.setTimeout(() => done.current(), 220);
      return () => window.clearTimeout(t);
    }

    const hold = window.setTimeout(() => {
      // Blockers stay where they are — no flight, just the held beat.
      if (!revealed.leavesRiver) { done.current(); return; }

      const slots = riverRef.current?.querySelectorAll('.md-river__slot');
      const card = slots?.[revealed.slot]?.querySelector('article');
      const target = discardRef.current;
      if (!card || !target) { done.current(); return; }

      setFlight({
        from: card.getBoundingClientRect(),
        to: target.getBoundingClientRect(),
      });
      lift.current(revealed.slot);
    }, HOLD_MS);

    return () => { window.clearTimeout(hold); lift.current(null); };
  }, [revealed, riverRef, discardRef]);

  // Start the transition one frame after the clone is placed, so the
  // browser has a "from" to animate out of.
  React.useEffect(() => {
    if (!flight) return;
    const frame = window.requestAnimationFrame(() => setMoving(true));
    const land = window.setTimeout(() => done.current(), FLY_MS);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(land); };
  }, [flight]);

  if (!revealed || !flight) return null;

  const { from, to } = flight;
  const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
  const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
  const scale = from.width > 0 ? to.width / from.width : 0.4;

  return (
    <div
      className="t-fly"
      aria-hidden="true"
      style={{
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        transition: `transform ${FLY_MS}ms cubic-bezier(.4,.05,.35,1), opacity ${FLY_MS}ms ease-in`,
        transform: moving ? `translate(${dx}px, ${dy}px) scale(${scale})` : 'none',
        opacity: moving ? 0.1 : 1,
      }}
    >
      <DeckCard category={revealed.category} size="lg" showCount={false} />
    </div>
  );
}
